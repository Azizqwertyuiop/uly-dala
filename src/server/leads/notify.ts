import nodemailer from "nodemailer";
import type { LeadsConfig } from "./config";
import { formatLeadForManagers } from "./format";
import type { LeadStore } from "./store";
import type { StoredLead } from "./types";

/*
 * Фоновые уведомления менеджерам (CLAUDE.md, раздел 9, шаги 4–5):
 * Telegram-бот + email, по 3 попытки с экспоненциальной задержкой; все неудачны — алерт.
 */

export type Notifier = { channel: string; send: (lead: StoredLead) => Promise<void> };

export type Alerter = (alert: {
  leadId: string | null;
  kind: string;
  message: string;
}) => Promise<void>;

export function telegramNotifier(
  config: { token: string; chatId: string; apiBase: string },
  fetchImpl: typeof fetch = fetch,
): Notifier {
  return {
    channel: "telegram",
    async send(lead) {
      const response = await fetchImpl(`${config.apiBase}/bot${config.token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: config.chatId, text: formatLeadForManagers(lead) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`Telegram ответил ${response.status}`);
    },
  };
}

export function emailNotifier(config: { smtpUrl: string; from: string; to: string }): Notifier {
  const transport = nodemailer.createTransport(config.smtpUrl);
  return {
    channel: "email",
    async send(lead) {
      await transport.sendMail({
        from: config.from,
        to: config.to,
        subject: `Новая заявка ULY DALA (${lead.source})`,
        text: formatLeadForManagers(lead),
      });
    },
  };
}

/** Мок для разработки и e2e: «отправка» — запись в базу, наружу ничего не уходит. */
export function mockNotifier(channel: string): Notifier {
  return { channel, send: async () => {} };
}

export function buildNotifiers(config: LeadsConfig["notify"]): Notifier[] {
  if (config.transport === "mock") return [mockNotifier("telegram"), mockNotifier("email")];
  const notifiers: Notifier[] = [];
  if (config.telegram) notifiers.push(telegramNotifier(config.telegram));
  if (config.email) notifiers.push(emailNotifier(config.email));
  return notifiers;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Доставка одной заявки во все каналы. Каждая попытка пишется в базу.
 * Канал, не доставленный за все попытки, и отсутствие каналов вообще — алерт.
 */
export async function deliverLead(
  lead: StoredLead,
  deps: {
    notifiers: Notifier[];
    store: LeadStore;
    alert: Alerter;
    attempts: number;
    baseDelayMs: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<{ delivered: string[]; failed: string[] }> {
  const sleep = deps.sleep ?? defaultSleep;
  const delivered: string[] = [];
  const failed: string[] = [];

  if (deps.notifiers.length === 0) {
    await deps.alert({
      leadId: lead.id,
      kind: "notify-not-configured",
      message: "Нет ни одного канала уведомлений (Telegram/email) — заявка только в базе.",
    });
    return { delivered, failed };
  }

  await Promise.all(
    deps.notifiers.map(async (notifier) => {
      for (let attempt = 1; attempt <= deps.attempts; attempt++) {
        try {
          await notifier.send(lead);
          deps.store.logNotification({
            leadId: lead.id,
            channel: notifier.channel,
            attempt,
            status: "sent",
          });
          delivered.push(notifier.channel);
          return;
        } catch (error) {
          deps.store.logNotification({
            leadId: lead.id,
            channel: notifier.channel,
            attempt,
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
          if (attempt < deps.attempts) await sleep(deps.baseDelayMs * 2 ** (attempt - 1));
        }
      }
      failed.push(notifier.channel);
    }),
  );

  if (failed.length > 0) {
    await deps.alert({
      leadId: lead.id,
      kind: delivered.length === 0 ? "notify-all-failed" : "notify-channel-failed",
      message: `Не доставлено после ${deps.attempts} попыток: ${failed.join(", ")}`,
    });
  }
  return { delivered, failed };
}
