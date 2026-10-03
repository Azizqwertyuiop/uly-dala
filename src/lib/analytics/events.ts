/*
 * Словарь событий аналитики (CLAUDE.md, раздел 14: персональных данных нет в событиях).
 * Общий для браузера и сервера, без zod (клиентский бандл). Серверная схема — src/server/telemetry/schema.ts.
 *
 * Правило: в свойствах — только значения из закрытых списков, числа и флаги.
 * Никаких имён, телефонов, email, комментариев, дат, свободного текста и идентификаторов людей.
 */

import { eventTypes, sources } from "@/lib/brief/model";

export const audiences = ["corporate", "family", "all"] as const;
export const qualityTiers = ["high", "medium", "fallback"] as const;
export type QualityTier = (typeof qualityTiers)[number];

/** Где на странице было действие: глава или общий элемент интерфейса. */
export const places = [
  "dawn",
  "assembly",
  "day",
  "fire",
  "world",
  "return",
  "header",
  "menu",
  "footer",
  "float",
  "modal",
  "page",
] as const;
export type Place = (typeof places)[number];

/** Какой CTA: бриф и мини-формы (source) + переходы. */
export const ctas = [...sources, "fazenda", "home", "format"] as const;

/** Поля брифа, о заполнении которых сообщается (только имя поля). */
export const briefFields = [
  "eventType",
  "dateMode",
  "month",
  "date",
  "guests",
  "venue",
  "name",
  "phone",
  "channel",
  "email",
  "comment",
  "consent",
] as const;
export type BriefField = (typeof briefFields)[number];

/** Значение передаётся только у полей с закрытым списком вариантов. */
export const enumBriefFields = ["eventType", "dateMode", "guests", "venue", "channel"] as const;

export const briefErrorKinds = ["invalid", "error", "rateLimited"] as const;
export const vitals = ["LCP", "INP", "CLS", "FCP", "TTFB"] as const;
export const vitalRatings = ["good", "needs-improvement", "poor"] as const;
export const qualityReasons = [
  "auto",
  "override",
  "firefox-fps",
  "webglcontextlost",
  "shader",
] as const;

type Of<T extends readonly string[]> = T[number];

/** Событие → его свойства. */
export type EventMap = {
  fork: { audience: Of<typeof audiences> };
  cta: { cta: Of<typeof ctas>; place: Place; format?: Of<typeof eventTypes> };
  brief_start: { form: Of<typeof sources> };
  brief_field: { form: Of<typeof sources>; field: BriefField; value?: string };
  brief_submit: { form: Of<typeof sources>; eventType?: Of<typeof eventTypes> };
  brief_error: { form: Of<typeof sources>; kind: Of<typeof briefErrorKinds>; fields?: string };
  whatsapp: { place: Place };
  call: { place: Place };
  presentation_download: { place: Place };
  visit_request: { place: Place };
  menu_open: Record<string, never>;
  brief_mode: { on: boolean };
  sound: { on: boolean };
  scroll_depth: { chapter: Place; index: number; of: number };
  quality: { tier: QualityTier; reason: Of<typeof qualityReasons> };
  web_vital: { metric: Of<typeof vitals>; value: number; rating: Of<typeof vitalRatings> };
};
export type EventName = keyof EventMap;

/** Общие свойства каждого события — подставляются модулем track. */
export type EventContext = {
  /** Язык страницы. */
  locale: string;
  /** Путь без query и hash. */
  path: string;
  /** Уровень качества на момент события («pending» — ещё не определён). */
  quality: QualityTier | "pending";
  /** Режим: кино или «Коротко». */
  mode: "cinematic" | "brief";
};

export type TrackedEvent<N extends EventName = EventName> = {
  name: N;
  props: EventMap[N];
  /** Мс от начала загрузки страницы. */
  t: number;
} & EventContext;

/** Пакет событий одного просмотра страницы. pv — случайный id просмотра, не хранится на устройстве. */
export type EventBatch = { pv: string; events: TrackedEvent[] };

export const ANALYTICS_ENDPOINT = "/api/t";
export const MONITORING_ENDPOINT = "/api/m";
export const CSP_REPORT_ENDPOINT = "/api/csp";
