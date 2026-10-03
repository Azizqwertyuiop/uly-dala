import { eventContext, pageViewId, postJson } from "@/lib/analytics/track";
import { MONITORING_ENDPOINT } from "@/lib/analytics/events";

/*
 * Мониторинг ошибок фронта (CLAUDE.md, раздел 14): ошибка → собственный эндпоинт /api/m →
 * структурированный лог сервера (+ Sentry, если на сервере задан SENTRY_DSN).
 * Тег webgl — отдельно: потеря контекста, падение шейдера, уход в fallback.
 * Без персональных данных: из адресов в тексте и стеке вырезаются query и hash.
 */

export const errorTags = ["js", "webgl", "csp", "media"] as const;
export type ErrorTag = (typeof errorTags)[number];

export type ClientError = {
  tag: ErrorTag;
  /** Короткий код: context_lost, shader_link, fallback, uncaught, unhandled_rejection, … */
  kind: string;
  message: string;
  stack?: string;
  /** Файл без query, строка, колонка. */
  source?: string;
  /** Доп. поля из закрытых списков (имя материала, директива CSP). */
  detail?: Record<string, string | number | boolean>;
};

export type ErrorReport = ClientError & {
  pv: string;
  t: number;
  locale: string;
  path: string;
  quality: string;
  mode: string;
};

const MAX_PER_PAGE = 20;
const sent = new Set<string>();

type DebugWindow = Window & { __errors?: ErrorReport[] };

/** Вырезать query/hash из адресов и ограничить длину. */
export function scrub(text: string, max = 300): string {
  return text
    .replace(/(https?:\/\/[^\s?#)'"]*)[?#][^\s)'"]*/g, "$1")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s()-]{8,}\d/g, "[number]")
    .slice(0, max);
}

export function reportError(error: ClientError): void {
  if (typeof window === "undefined") return;
  const key = `${error.tag}|${error.kind}|${error.message.slice(0, 120)}`;
  if (sent.has(key) || sent.size >= MAX_PER_PAGE) return;
  sent.add(key);

  const report: ErrorReport = {
    ...error,
    message: scrub(error.message),
    stack: error.stack ? scrub(error.stack.split("\n").slice(0, 10).join("\n"), 2000) : undefined,
    source: error.source ? scrub(error.source, 200) : undefined,
    pv: pageViewId(),
    t: Math.round(performance.now()),
    ...eventContext(),
  };
  const w = window as DebugWindow;
  (w.__errors ??= []).push(report);
  if (new URLSearchParams(window.location.search).has("debug"))
    console.debug("[monitoring]", report.tag, report.kind, report.message);
  // Ошибки отправляются всегда (не аналитика): без них сайт нельзя чинить. Данных о человеке нет.
  postJson(MONITORING_ENDPOINT, report);
}

/** Сообщение и стек из чего угодно, что выбросили. */
export function describe(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error)
    return { message: `${reason.name}: ${reason.message}`, stack: reason.stack };
  return { message: typeof reason === "string" ? reason : "non-error rejection" };
}
