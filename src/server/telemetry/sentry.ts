import { randomUUID } from "node:crypto";

/*
 * Пересылка ошибок в Sentry без SDK (CLAUDE.md, раздел 14: мониторинг, например Sentry).
 * Почему без @sentry/nextjs: SDK добавляет в клиентский бандл десятки КБ и оборачивает сборку,
 * а нам нужна только доставка событий — это один HTTP-запрос (envelope API).
 * Включается, когда на сервере задан SENTRY_DSN; иначе — только структурированный лог.
 */

export type SentryEvent = {
  level: "error" | "warning" | "fatal";
  /** frontend | server | leads | csp */
  scope: string;
  message: string;
  tags: Record<string, string>;
  extra?: Record<string, unknown>;
  stack?: string;
  platform?: "javascript" | "node";
};

type Dsn = { endpoint: string; publicKey: string; raw: string };

export function parseDsn(dsn: string | undefined): Dsn | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const project = url.pathname.replace(/^\/+/, "");
    if (!url.username || !project) return null;
    return {
      endpoint: `${url.protocol}//${url.host}/api/${project}/envelope/`,
      publicKey: url.username,
      raw: dsn,
    };
  } catch {
    return null;
  }
}

export function buildEnvelope(dsn: Dsn, event: SentryEvent, now = new Date()): string {
  const id = randomUUID().replace(/-/g, "");
  const body = {
    event_id: id,
    timestamp: now.getTime() / 1000,
    platform: event.platform ?? "javascript",
    level: event.level,
    logger: event.scope,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    message: { formatted: event.message },
    tags: { scope: event.scope, ...event.tags },
    extra: { ...event.extra, ...(event.stack ? { stack: event.stack } : {}) },
  };
  return [
    JSON.stringify({ event_id: id, sent_at: now.toISOString(), dsn: dsn.raw }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(body),
  ].join("\n");
}

export async function sendToSentry(
  event: SentryEvent,
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const dsn = parseDsn(env.SENTRY_DSN);
  if (!dsn) return false;
  try {
    const response = await fetchImpl(dsn.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
        "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=uly-dala/1.0`,
      },
      body: buildEnvelope(dsn, event),
      signal: AbortSignal.timeout(5_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
