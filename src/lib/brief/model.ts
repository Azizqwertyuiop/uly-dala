/*
 * Модель брифа (CLAUDE.md, раздел 9). Общая для браузера и сервера — без zod,
 * чтобы не тянуть валидатор в клиентский бандл. Серверная схема — src/server/leads/schema.ts.
 */

/** Тип события: шесть форматов + «другое» — 7 вариантов. */
export const eventTypes = [
  "conference",
  "coffee-break",
  "team-building",
  "kudalyk",
  "wedding",
  "private-party",
  "other",
] as const;
export type EventType = (typeof eventTypes)[number];

export const dateModes = ["month", "date", "unknown"] as const;
export type DateMode = (typeof dateModes)[number];

export const months = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
export type Month = (typeof months)[number];

export const guestRanges = ["upTo50", "50to150", "150to500", "500plus"] as const;
export type GuestRange = (typeof guestRanges)[number];

export const venues = ["ours", "have", "help"] as const;
export type Venue = (typeof venues)[number];

export const channels = ["whatsapp", "call", "telegram", "email"] as const;
export type Channel = (typeof channels)[number];

/** Откуда пришла заявка: большой бриф или мини-формы (раздел 9). */
export const sources = ["brief", "menu", "visit"] as const;
export type Source = (typeof sources)[number];

/** Имена полей формы — одни и те же в HTML, в черновике и на сервере. */
export const FIELD = {
  eventType: "eventType",
  dateMode: "dateMode",
  month: "month",
  date: "date",
  guests: "guests",
  venue: "venue",
  name: "name",
  phone: "phone",
  channel: "channel",
  email: "email",
  comment: "comment",
  consent: "consent",
  source: "source",
  locale: "locale",
  /** Ловушка для ботов: людям поле не видно. */
  honeypot: "website",
} as const;

export type BriefValues = {
  eventType?: EventType;
  dateMode?: DateMode;
  month?: Month;
  date?: string;
  guests?: GuestRange;
  venue?: Venue;
  name?: string;
  phone?: string;
  channel?: Channel;
  email?: string;
  comment?: string;
};

/**
 * Телефон РК → +7XXXXXXXXXX. Принимает «+7 701 123 45 67», «8 (701) 123-45-67», «7011234567».
 * Возвращает null, если это не 10 цифр после кода страны.
 */
export function normalizePhone(input: string): string | null {
  const local = localDigits(input);
  return local.length === 10 ? `+7${local}` : null;
}

/**
 * Цифры номера без кода страны. Мобильные номера РК сами начинаются на 7, поэтому код страны
 * считается введённым, только если есть «+», номер начинается с 8 или в нём 11 цифр.
 */
function localDigits(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return digits.startsWith("7") ? digits.slice(1) : "";
  if (digits.length === 11 && /^[78]/.test(digits)) return digits.slice(1);
  if (digits.startsWith("8")) return digits.slice(1);
  return digits;
}

/** Маска ввода: «+7 (701) 123-45-67». Частичный ввод форматируется по мере набора. */
export function formatPhoneMask(input: string): string {
  const digits = localDigits(input).slice(0, 10);
  if (!digits) return input.trim() === "" ? "" : "+7 ";
  const [a, b, c, d] = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 8),
    digits.slice(8, 10),
  ];
  let out = `+7 (${a}`;
  if (a.length === 3) out += ")";
  if (b) out += ` ${b}`;
  if (c) out += `-${c}`;
  if (d) out += `-${d}`;
  return out;
}

/** Формат, соответствующий формату брифа: из какого CTA открыли — тот тип и подставляем. */
export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && (eventTypes as readonly string[]).includes(value);
}
