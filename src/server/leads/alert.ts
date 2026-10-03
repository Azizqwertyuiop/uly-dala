import type { Alerter } from "./notify";
import type { LeadStore } from "./store";
import { sendToSentry } from "../telemetry/sentry";

/*
 * Алерт в мониторинг (CLAUDE.md, раздел 9, шаг 5). Без персональных данных: только id заявки.
 * Запись в базу + структурированная ошибка в лог + вебхук, если задан ALERT_WEBHOOK_URL,
 * + Sentry, если задан SENTRY_DSN (src/server/telemetry/sentry.ts).
 */
export function createAlerter(deps: {
  store: LeadStore;
  webhookUrl: string | null;
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
  /** Sentry: по умолчанию — из env (SENTRY_DSN), в тестах — подмена. */
  sentry?: (alert: Parameters<Alerter>[0]) => Promise<unknown>;
}): Alerter {
  const log = deps.log ?? ((line) => console.error(line));
  const fetchImpl = deps.fetchImpl ?? fetch;

  return async (alert) => {
    try {
      deps.store.logAlert(alert);
    } catch {
      // База недоступна — остаются лог и вебхук.
    }
    log(JSON.stringify({ level: "alert", scope: "leads", ...alert }));
    const sentry =
      deps.sentry ??
      ((a: Parameters<Alerter>[0]) =>
        sendToSentry({
          level: "fatal",
          scope: "leads",
          platform: "node",
          message: "lead notifications failed",
          tags: { tag: "leads" },
          extra: { ...a },
        }));
    await sentry(alert);
    if (deps.webhookUrl) {
      try {
        await fetchImpl(deps.webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source: "uly-dala-leads", ...alert }),
          signal: AbortSignal.timeout(5_000),
        });
      } catch (error) {
        log(
          JSON.stringify({
            level: "error",
            scope: "leads",
            message: "alert webhook failed",
            error: String(error),
          }),
        );
      }
    }
  };
}
