/*
 * Конфигурация приёма заявок. Все ключи и адреса — только из env (CLAUDE.md, раздел 14).
 *
 * МЕСТО ХРАНЕНИЯ ЗАЯВОК — решение юриста заказчика (закон РК «О персональных данных и их защите»,
 * вероятно, требуется база на территории РК). TODO(legal): до запуска выбрать хранилище и
 * добавить его драйвер в store.ts. Сейчас поддерживается только SQLite — для разработки и тестов.
 */

export type LeadsConfig = {
  storage: { driver: "sqlite"; path: string };
  rateLimit: { max: number; windowMs: number; salt: string };
  notify: {
    transport: "live" | "mock";
    telegram: { token: string; chatId: string; apiBase: string } | null;
    email: { smtpUrl: string; from: string; to: string } | null;
    attempts: number;
    baseDelayMs: number;
  };
  alertWebhookUrl: string | null;
};

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function readLeadsConfig(
  env: Record<string, string | undefined> = process.env,
): LeadsConfig {
  const driver = env.LEADS_STORAGE ?? "sqlite";
  if (driver !== "sqlite") {
    throw new Error(`LEADS_STORAGE=${driver} не поддерживается. TODO(legal): выбрать хранилище.`);
  }

  const production = env.NODE_ENV === "production";
  const telegram =
    env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID
      ? {
          token: env.TELEGRAM_BOT_TOKEN,
          chatId: env.TELEGRAM_CHAT_ID,
          // Переопределяется только в тестах (сбой доставки).
          apiBase: env.TELEGRAM_API_BASE ?? "https://api.telegram.org",
        }
      : null;
  const email =
    env.SMTP_URL && env.NOTIFY_EMAIL_TO
      ? {
          smtpUrl: env.SMTP_URL,
          to: env.NOTIFY_EMAIL_TO,
          from: env.NOTIFY_EMAIL_FROM ?? env.NOTIFY_EMAIL_TO,
        }
      : null;

  return {
    storage: { driver, path: env.LEADS_SQLITE_PATH ?? ".data/leads.sqlite" },
    rateLimit: {
      max: int(env.RATE_LIMIT_MAX, 5),
      windowMs: int(env.RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000),
      salt: env.RATE_LIMIT_SALT ?? "dev-only-salt",
    },
    notify: {
      // В разработке по умолчанию — мок: уведомления пишутся в базу, никуда не уходят.
      transport:
        env.NOTIFY_TRANSPORT === "mock" || env.NOTIFY_TRANSPORT === "live"
          ? env.NOTIFY_TRANSPORT
          : production
            ? "live"
            : "mock",
      telegram,
      email,
      attempts: 3,
      baseDelayMs: int(env.NOTIFY_BASE_DELAY_MS, 1000),
    },
    alertWebhookUrl: env.ALERT_WEBHOOK_URL || null,
  };
}
