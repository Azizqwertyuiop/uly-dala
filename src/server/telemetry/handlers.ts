import { captureError, logLine } from "./log";
import { createLimiter } from "./limit";
import { errorReportSchema, eventBatchSchema } from "./schema";

/*
 * Обработчики эндпоинтов телеметрии (route.ts только вызывают их — так их проще тестировать).
 * /api/t — события аналитики, /api/m — ошибки фронта, /api/csp — отчёты о нарушениях CSP.
 * Ответ — сразу 204/400/413/429; тело не возвращается.
 */

const MAX_BODY = 16 * 1024;
const salt = () => process.env.RATE_LIMIT_SALT ?? "dev-only-salt";
const limits = {
  analytics: createLimiter({ max: 120, windowMs: 60_000, salt: salt() }),
  errors: createLimiter({ max: 30, windowMs: 60_000, salt: salt() }),
  csp: createLimiter({ max: 30, windowMs: 60_000, salt: salt() }),
};

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown"
  );
}

const status = (code: number) => new Response(null, { status: code });

async function readJson(request: Request): Promise<unknown | Response> {
  const text = await request.text();
  if (text.length > MAX_BODY) return status(413);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return status(400);
  }
}

export async function handleAnalytics(request: Request): Promise<Response> {
  if (!limits.analytics(clientIp(request.headers))) return status(429);
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const parsed = eventBatchSchema.safeParse(body);
  if (!parsed.success) return status(400);
  for (const event of parsed.data.events)
    logLine({ level: "info", scope: "analytics", pv: parsed.data.pv, ...event });
  return status(204);
}

export async function handleClientError(request: Request): Promise<Response> {
  if (!limits.errors(clientIp(request.headers))) return status(429);
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const parsed = errorReportSchema.safeParse(body);
  if (!parsed.success) return status(400);
  const r = parsed.data;
  await captureError({
    level: "error",
    scope: "frontend",
    message: r.message,
    stack: r.stack,
    tags: {
      tag: r.tag,
      kind: r.kind,
      quality: r.quality,
      locale: r.locale,
      path: r.path,
      mode: r.mode,
    },
    extra: { pv: r.pv, t: r.t, ...(r.source ? { source: r.source } : {}), ...(r.detail ?? {}) },
  });
  return status(204);
}

type CspBody = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 200) : "");
/** Только origin или схема (inline, eval, data, blob) — без пути и query. */
function originOnly(v: unknown): string {
  const s = str(v);
  try {
    return /^https?:/.test(s) ? new URL(s).origin : s.split(":")[0]!;
  } catch {
    return "";
  }
}
function pathOnly(v: unknown): string {
  try {
    return new URL(str(v)).pathname.slice(0, 120);
  } catch {
    return "";
  }
}

/** Формат report-uri (application/csp-report) и Reporting API (application/reports+json). */
export async function handleCspReport(request: Request): Promise<Response> {
  if (!limits.csp(clientIp(request.headers))) return status(429);
  const body = await readJson(request);
  if (body instanceof Response) return body;
  const reports: CspBody[] = Array.isArray(body)
    ? body.filter((r) => r?.type === "csp-violation").map((r) => r.body as CspBody)
    : body && typeof body === "object" && "csp-report" in body
      ? [(body as { "csp-report": CspBody })["csp-report"]]
      : [];
  if (reports.length === 0) return status(400);
  for (const r of reports.slice(0, 10)) {
    if (!r || typeof r !== "object") continue;
    const directive = str(
      r.effectiveDirective ?? r["effective-directive"] ?? r["violated-directive"],
    );
    const blocked = originOnly(r.blockedURL ?? r["blocked-uri"]);
    await captureError({
      level: "warning",
      scope: "csp",
      message: `CSP: ${directive} blocked ${blocked}`,
      tags: {
        tag: "csp",
        directive,
        blocked,
        disposition: str(r.disposition) || "enforce",
        path: pathOnly(r.documentURL ?? r["document-uri"]),
      },
    });
  }
  return status(204);
}
