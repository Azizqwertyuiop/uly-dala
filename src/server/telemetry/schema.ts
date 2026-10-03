import { z } from "zod";
import {
  audiences,
  briefErrorKinds,
  briefFields,
  ctas,
  places,
  qualityReasons,
  qualityTiers,
  vitalRatings,
  vitals,
} from "@/lib/analytics/events";
import { eventTypes, sources } from "@/lib/brief/model";
import { errorTags } from "@/lib/monitoring/report";

/*
 * Серверная проверка телеметрии (CLAUDE.md, раздел 14). Строго: неизвестное событие или свойство —
 * весь пакет отклоняется. Так в журнал не попадёт ничего, кроме закрытых списков и чисел.
 */

const form = z.enum(sources);
const place = z.enum(places);
const strict = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape);

const fieldList = z
  .string()
  .max(200)
  .refine(
    (v) => v === "" || v.split(",").every((f) => (briefFields as readonly string[]).includes(f)),
  );

/** Значение поля брифа — только из закрытых списков вариантов. */
const enumValue = z.enum([
  ...eventTypes,
  "month",
  "date",
  "unknown",
  "upTo50",
  "50to150",
  "150to500",
  "500plus",
  "ours",
  "have",
  "help",
  "whatsapp",
  "call",
  "telegram",
  "email",
]);

const locale = z.enum(["kk", "ru", "en"]);
/** Путь страницы: только символы адресов сайта, без query. */
const path = z
  .string()
  .max(120)
  .regex(/^\/[\w\-/.]*$/);
const quality = z.enum([...qualityTiers, "pending"]);
const mode = z.enum(["cinematic", "brief"]);
const pv = z
  .string()
  .min(6)
  .max(64)
  .regex(/^[\w-]+$/);

const common = {
  t: z.number().min(0).max(86_400_000),
  locale,
  path,
  quality,
  mode,
};

/** Событие: имя, свойства и общие поля — ничего сверх. */
const ev = <N extends string, P extends z.ZodType>(name: N, props: P) =>
  z.strictObject({ name: z.literal(name), props, ...common });

const events = z.discriminatedUnion("name", [
  ev("fork", strict({ audience: z.enum(audiences) })),
  ev("cta", strict({ cta: z.enum(ctas), place, format: z.enum(eventTypes).optional() })),
  ev("brief_start", strict({ form })),
  ev("brief_field", strict({ form, field: z.enum(briefFields), value: enumValue.optional() })),
  ev("brief_submit", strict({ form, eventType: z.enum(eventTypes).optional() })),
  ev("brief_error", strict({ form, kind: z.enum(briefErrorKinds), fields: fieldList.optional() })),
  ev("whatsapp", strict({ place })),
  ev("call", strict({ place })),
  ev("presentation_download", strict({ place })),
  ev("visit_request", strict({ place })),
  ev("menu_open", strict({})),
  ev("brief_mode", strict({ on: z.boolean() })),
  ev("sound", strict({ on: z.boolean() })),
  ev(
    "scroll_depth",
    strict({
      chapter: place,
      index: z.number().int().min(0).max(20),
      of: z.number().int().min(0).max(20),
    }),
  ),
  ev("quality", strict({ tier: z.enum(qualityTiers), reason: z.enum(qualityReasons) })),
  ev(
    "web_vital",
    strict({
      metric: z.enum(vitals),
      value: z.number().min(0).max(600_000),
      rating: z.enum(vitalRatings),
    }),
  ),
]);

export const eventBatchSchema = z.strictObject({
  pv,
  events: z.array(events).min(1).max(20),
});
export type ValidEventBatch = z.infer<typeof eventBatchSchema>;

const detailValue = z.union([z.string().max(200), z.number(), z.boolean()]);

export const errorReportSchema = z.strictObject({
  tag: z.enum(errorTags),
  kind: z
    .string()
    .max(40)
    .regex(/^[\w-]+$/),
  message: z.string().max(300),
  stack: z.string().max(2000).optional(),
  source: z.string().max(200).optional(),
  detail: z.record(z.string().max(40), detailValue).optional(),
  pv,
  t: z.number().min(0).max(86_400_000),
  locale,
  path,
  quality,
  mode,
});
export type ValidErrorReport = z.infer<typeof errorReportSchema>;
