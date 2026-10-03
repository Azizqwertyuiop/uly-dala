import { sendToSentry, type SentryEvent } from "./sentry";

/*
 * Журнал телеметрии: одна строка JSON на запись (stdout/stderr сервера → сборщик логов хостинга).
 * IP, User-Agent, cookie сюда не попадают никогда.
 */

export type LogLine = { level: "info" | "warn" | "error" | "alert"; scope: string } & Record<
  string,
  unknown
>;

let writer: (line: string, level: LogLine["level"]) => void = (line, level) => {
  if (level === "info") console.log(line);
  else console.error(line);
};

export function logLine(line: LogLine): void {
  writer(JSON.stringify({ time: new Date().toISOString(), ...line }), line.level);
}

/** Ошибка: лог + Sentry (если задан SENTRY_DSN). Не бросает. */
export async function captureError(event: SentryEvent): Promise<void> {
  logLine({
    level: event.level === "warning" ? "warn" : "error",
    scope: event.scope,
    message: event.message,
    ...event.tags,
    ...(event.extra ? { extra: event.extra } : {}),
    ...(event.stack ? { stack: event.stack } : {}),
  });
  await sendToSentry(event);
}

/** Только для тестов. */
export function setLogWriter(next: typeof writer): void {
  writer = next;
}
