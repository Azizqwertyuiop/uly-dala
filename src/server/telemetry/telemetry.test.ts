import { describe, expect, it, vi } from "vitest";
import { CSP_REPORT_ENDPOINT as EVENTS_CSP } from "@/lib/analytics/events";
import { scrub } from "@/lib/monitoring/report";
import {
  contentSecurityPolicy,
  CSP_REPORT_ENDPOINT,
  KTX2_WORKER_CSP,
  securityHeaders,
} from "@/lib/security/headers";
import { handleAnalytics, handleClientError, handleCspReport } from "./handlers";
import { setLogWriter } from "./log";
import { errorReportSchema, eventBatchSchema } from "./schema";
import { buildEnvelope, parseDsn, sendToSentry } from "./sentry";

const ctx = { t: 1200, locale: "ru", path: "/ru", quality: "high", mode: "cinematic" } as const;
const batch = (events: object[]) => ({
  pv: "pv-123456",
  events: events.map((e) => ({ ...ctx, ...e })),
});

describe("схема событий: только закрытые списки, никаких персональных данных", () => {
  it("принимает события модуля track", () => {
    const ok = batch([
      { name: "fork", props: { audience: "family" } },
      { name: "cta", props: { cta: "brief", place: "day", format: "kudalyk" } },
      { name: "brief_start", props: { form: "brief" } },
      { name: "brief_field", props: { form: "brief", field: "eventType", value: "wedding" } },
      { name: "brief_field", props: { form: "brief", field: "phone" } },
      { name: "brief_submit", props: { form: "visit" } },
      { name: "brief_error", props: { form: "brief", kind: "invalid", fields: "name,phone" } },
      { name: "whatsapp", props: { place: "float" } },
      { name: "presentation_download", props: { place: "day" } },
      { name: "visit_request", props: { place: "modal" } },
      { name: "menu_open", props: {} },
      { name: "brief_mode", props: { on: true } },
      { name: "sound", props: { on: false } },
      { name: "scroll_depth", props: { chapter: "fire", index: 3, of: 6 } },
      { name: "quality", props: { tier: "fallback", reason: "webglcontextlost" } },
      { name: "web_vital", props: { metric: "LCP", value: 1830, rating: "good" } },
    ]);
    expect(eventBatchSchema.safeParse(ok).success).toBe(true);
  });

  it.each([
    [
      "значение текстового поля",
      { name: "brief_field", props: { form: "brief", field: "name", value: "Айгерим" } },
    ],
    [
      "телефон в значении",
      { name: "brief_field", props: { form: "brief", field: "phone", value: "+77011234567" } },
    ],
    ["лишнее свойство", { name: "cta", props: { cta: "brief", place: "day", email: "a@b.kz" } }],
    ["неизвестное событие", { name: "identify", props: { user: "x" } }],
    [
      "поле с ошибкой — не из списка",
      { name: "brief_error", props: { form: "brief", kind: "invalid", fields: "Айгерим" } },
    ],
  ])("отклоняет: %s", (_, event) => {
    expect(eventBatchSchema.safeParse(batch([event])).success).toBe(false);
  });

  it("отклоняет query в пути и лишние общие поля", () => {
    const e = { name: "menu_open", props: {} };
    expect(eventBatchSchema.safeParse(batch([{ ...e, path: "/ru?phone=7701" }])).success).toBe(
      false,
    );
    expect(eventBatchSchema.safeParse(batch([{ ...e, ip: "1.2.3.4" }])).success).toBe(false);
  });
});

describe("эндпоинты телеметрии", () => {
  const post = (body: unknown, type = "application/json") =>
    new Request("http://x/api", {
      method: "POST",
      headers: { "content-type": type, "x-forwarded-for": "10.0.0.1" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("/api/t: 204 и строка лога без IP; мусор — 400", async () => {
    const lines: string[] = [];
    setLogWriter((l) => lines.push(l));
    const r = await handleAnalytics(post(batch([{ name: "sound", props: { on: true } }])));
    expect(r.status).toBe(204);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      level: "info",
      scope: "analytics",
      name: "sound",
    });
    expect(lines[0]).not.toContain("10.0.0.1");
    expect((await handleAnalytics(post("{oops"))).status).toBe(400);
    expect((await handleAnalytics(post({ pv: "x", events: [] }))).status).toBe(400);
  });

  it("/api/m: ошибка WebGL → лог с тегом webgl", async () => {
    const lines: string[] = [];
    setLogWriter((l) => lines.push(l));
    const report = {
      tag: "webgl",
      kind: "context_lost",
      message: "webglcontextlost",
      pv: "pv-123456",
      ...ctx,
    };
    expect(errorReportSchema.safeParse(report).success).toBe(true);
    expect((await handleClientError(post(report))).status).toBe(204);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      level: "error",
      scope: "frontend",
      tag: "webgl",
      kind: "context_lost",
    });
  });

  it("/api/csp: оба формата отчёта; адрес — только origin", async () => {
    const lines: string[] = [];
    setLogWriter((l) => lines.push(l));
    const legacy = {
      "csp-report": {
        "document-uri": "http://x/ru?utm=1",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/a.js?token=secret",
      },
    };
    expect((await handleCspReport(post(legacy, "application/csp-report"))).status).toBe(204);
    const modern = [
      {
        type: "csp-violation",
        body: { effectiveDirective: "worker-src", blockedURL: "blob", documentURL: "http://x/ru" },
      },
    ];
    expect((await handleCspReport(post(modern, "application/reports+json"))).status).toBe(204);
    expect(lines.join("\n")).not.toContain("secret");
    expect(JSON.parse(lines[0]!)).toMatchObject({
      scope: "csp",
      blocked: "https://evil.example",
      path: "/ru",
    });
  });
});

describe("Sentry без SDK", () => {
  it("DSN → адрес envelope; конверт из трёх строк", () => {
    const dsn = parseDsn("https://abc123@o1.ingest.sentry.io/42")!;
    expect(dsn.endpoint).toBe("https://o1.ingest.sentry.io/api/42/envelope/");
    const lines = buildEnvelope(dsn, {
      level: "error",
      scope: "frontend",
      message: "boom",
      tags: { tag: "webgl" },
    }).split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[2]!)).toMatchObject({ level: "error", tags: { tag: "webgl" } });
    expect(parseDsn("")).toBeNull();
    expect(parseDsn("not a url")).toBeNull();
  });

  it("без SENTRY_DSN ничего не отправляется", async () => {
    const fetchImpl = vi.fn();
    expect(
      await sendToSentry({ level: "error", scope: "s", message: "m", tags: {} }, {}, fetchImpl),
    ).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("заголовки безопасности", () => {
  it("CSP: всё своё, без eval на странице, WebAssembly и воркеры декодеров разрешены", () => {
    const csp = contentSecurityPolicy({ dev: false, https: true });
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("'wasm-unsafe-eval'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toMatch(/worker-src 'self' blob: data:/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy({ dev: true, https: false })).toContain("'unsafe-eval'");
    expect(CSP_REPORT_ENDPOINT).toBe(EVENTS_CSP);
    // eval — только у воркера KTX2, и он ничего не грузит.
    expect(KTX2_WORKER_CSP).toContain("default-src 'none'");
    const keys = securityHeaders({ dev: false, https: true }).map((h) => h.key);
    for (const k of [
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ])
      expect(keys).toContain(k);
  });
});

describe("scrub: из ошибок вырезается лишнее", () => {
  it("query, email, телефон", () => {
    const s = scrub("at https://site.kz/ru?name=Ivan#x (a@b.kz, +7 701 123 45 67)");
    expect(s).toBe("at https://site.kz/ru ([email], [number])");
  });
});
