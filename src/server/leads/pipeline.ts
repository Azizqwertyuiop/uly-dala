import { createHash, randomUUID } from "node:crypto";
import type { LeadsConfig } from "./config";
import type { Alerter } from "./notify";
import { parseBrief } from "./schema";
import type { LeadStore } from "./store";
import type { FieldErrors, StoredLead } from "./types";

export type AcceptResult =
  | { status: "success"; lead: StoredLead | null }
  | { status: "invalid"; errors: FieldErrors }
  | { status: "rateLimited" }
  | { status: "error" };

/*
 * Приём заявки — СТРОГО в порядке CLAUDE.md, раздел 9:
 * 1. zod → honeypot → rate limit по IP;
 * 2. запись в базу;
 * 3. ответ пользователю (возврат из функции);
 * 4–5. уведомления и алерты — отдельно, в фоне (deliverLead через after()).
 */
export function acceptLead(
  raw: Record<string, unknown>,
  ctx: { ip: string; now: Date },
  deps: { store: LeadStore; config: LeadsConfig; alert: Alerter },
): AcceptResult {
  // 1a. Валидация.
  const parsed = parseBrief(raw);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };

  // 1b. Honeypot: бот получает «успех», в базу ничего не пишется.
  if (parsed.data.honeypot.trim() !== "") return { status: "success", lead: null };

  // 1c. Rate limit: IP хранится только в виде хэша с солью.
  const { max, windowMs, salt } = deps.config.rateLimit;
  const key = createHash("sha256").update(`${salt}:${ctx.ip}`).digest("hex");
  try {
    if (!deps.store.hitRateLimit(key, ctx.now.getTime(), windowMs, max)) {
      return { status: "rateLimited" };
    }
  } catch {
    // Сбой лимитера не должен терять заявку — пропускаем проверку.
  }

  // 2. Запись в базу.
  try {
    const lead = deps.store.insertLead(parsed.data.lead, { id: randomUUID(), createdAt: ctx.now });
    return { status: "success", lead };
  } catch (error) {
    void deps.alert({
      leadId: null,
      kind: "store-failed",
      message: `Заявка не записана в базу: ${error instanceof Error ? error.message : String(error)}`,
    });
    return { status: "error" };
  }
}
