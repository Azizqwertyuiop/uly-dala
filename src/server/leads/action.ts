"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { FIELD, sources, type BriefValues, type Source } from "@/lib/brief/model";
import type { BriefFormState } from "@/lib/brief/state";
import { deliverLead } from "./notify";
import { acceptLead } from "./pipeline";
import { getLeadsRuntime } from "./runtime";

/** Поля, которые возвращаются в форму при ошибке (согласие — никогда: только явная галочка). */
const ECHO_FIELDS = [
  FIELD.eventType,
  FIELD.dateMode,
  FIELD.month,
  FIELD.date,
  FIELD.guests,
  FIELD.venue,
  FIELD.name,
  FIELD.phone,
  FIELD.channel,
  FIELD.email,
  FIELD.comment,
] as const;

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/*
 * Эндпоинт заявок — один для брифа и мини-форм (source: brief | menu | visit).
 * Работает и как обычный POST без JS (прогрессивное улучшение Server Actions).
 * Порядок шагов — в pipeline.ts; уведомления — после ответа, через after().
 */
export async function submitBrief(
  prev: BriefFormState,
  formData: FormData,
): Promise<BriefFormState> {
  const raw: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("$ACTION") && typeof value === "string") raw[key] = value;
  }
  const source = (sources as readonly string[]).includes(raw[FIELD.source] ?? "")
    ? (raw[FIELD.source] as Source)
    : prev.source;

  const runtime = getLeadsRuntime();
  const result = acceptLead(raw, { ip: await clientIp(), now: new Date() }, runtime);
  const submittedAt = Date.now();

  if (result.status === "success") {
    const lead = result.lead;
    if (lead) {
      after(() =>
        deliverLead(lead, {
          notifiers: runtime.notifiers,
          store: runtime.store,
          alert: runtime.alert,
          attempts: runtime.config.notify.attempts,
          baseDelayMs: runtime.config.notify.baseDelayMs,
        }),
      );
    }
    return { status: "success", source, submittedAt };
  }

  const values: BriefValues = {};
  for (const field of ECHO_FIELDS) {
    const value = raw[field];
    if (value) (values as Record<string, string>)[field] = value.slice(0, 1000);
  }

  return result.status === "invalid"
    ? { status: "invalid", source, errors: result.errors, values, submittedAt }
    : { status: result.status, source, values, submittedAt };
}
