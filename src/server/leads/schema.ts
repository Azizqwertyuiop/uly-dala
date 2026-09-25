import { z } from "zod";
import {
  channels,
  dateModes,
  eventTypes,
  FIELD,
  guestRanges,
  months,
  normalizePhone,
  sources,
  venues,
} from "@/lib/brief/model";
import { locales } from "@/lib/i18n";
import type { FieldErrorCode, FieldErrors, Lead } from "./types";

/* Серверная валидация брифа (CLAUDE.md, раздел 9: шаг 1 — zod). */

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const trimmed = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().max(max, { error: "tooLong" }),
  );
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(empty, z.enum(values, { error: "invalid" }).optional());

const schema = z.object({
  [FIELD.source]: z.preprocess((v) => empty(v) ?? "brief", z.enum(sources, { error: "invalid" })),
  [FIELD.locale]: z.preprocess((v) => empty(v) ?? "ru", z.enum(locales, { error: "invalid" })),
  [FIELD.eventType]: optionalEnum(eventTypes),
  [FIELD.dateMode]: optionalEnum(dateModes),
  [FIELD.month]: optionalEnum(months),
  [FIELD.date]: z.preprocess(empty, z.iso.date({ error: "invalid" }).optional()),
  [FIELD.guests]: optionalEnum(guestRanges),
  [FIELD.venue]: optionalEnum(venues),
  [FIELD.name]: z.preprocess(
    empty,
    z
      .string({ error: "required" })
      .trim()
      .min(2, { error: "invalid" })
      .max(80, { error: "tooLong" }),
  ),
  [FIELD.phone]: z.preprocess(
    empty,
    z.string({ error: "required" }).transform((v, ctx) => {
      const phone = normalizePhone(v);
      if (!phone) ctx.addIssue({ code: "custom", message: "invalid" });
      return phone ?? v;
    }),
  ),
  [FIELD.channel]: optionalEnum(channels),
  [FIELD.email]: z.preprocess(empty, z.email({ error: "invalid" }).max(120).optional()),
  [FIELD.comment]: z.preprocess(empty, trimmed(1000).optional()),
  [FIELD.consent]: z.literal("on", { error: "consent" }),
  [FIELD.honeypot]: z.preprocess((v) => (typeof v === "string" ? v : ""), z.string().max(500)),
});

/** Email обязателен, если выбран канал «email». Проверяется вместе с остальными полями. */
function emailRequired(raw: Record<string, unknown>): boolean {
  const email = raw[FIELD.email];
  return raw[FIELD.channel] === "email" && (typeof email !== "string" || email.trim() === "");
}

export type ParsedBrief = { lead: Lead; honeypot: string };

export function parseBrief(
  raw: Record<string, unknown>,
): { ok: true; data: ParsedBrief } | { ok: false; errors: FieldErrors } {
  const result = schema.safeParse(raw);
  const needsEmail = emailRequired(raw);
  if (!result.success || needsEmail) {
    const errors: FieldErrors = needsEmail ? { email: "required" } : {};
    for (const issue of result.success ? [] : result.error.issues) {
      const field = String(issue.path[0]) as keyof FieldErrors;
      const code = (["required", "invalid", "tooLong", "consent"] as const).includes(
        issue.message as FieldErrorCode,
      )
        ? (issue.message as FieldErrorCode)
        : "invalid";
      errors[field] ??= code;
    }
    return { ok: false, errors };
  }
  const { website, consent: _consent, ...lead } = result.data;
  void _consent;
  // Без JS режим даты мог не выбраться — выводим его из заполненного поля.
  if (!lead.dateMode) lead.dateMode = lead.date ? "date" : lead.month ? "month" : undefined;
  // Дата и месяц имеют смысл только в своём режиме.
  if (lead.dateMode !== "month") delete lead.month;
  if (lead.dateMode !== "date") delete lead.date;
  if (lead.channel !== "email") delete lead.email;
  return { ok: true, data: { lead: lead as Lead, honeypot: website } };
}
