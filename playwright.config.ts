import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
/** Второй сервер: уведомления «падают» (Telegram на закрытом порту) — для теста алерта. */
export const FAILING_PORT = 3101;

export const E2E_DB = ".data/e2e.sqlite";
export const E2E_FAILING_DB = ".data/e2e-failing.sqlite";

const serverEnv = {
  NOTIFY_TRANSPORT: "mock",
  LEADS_SQLITE_PATH: E2E_DB,
  // Тесты шлют много заявок с одного IP.
  RATE_LIMIT_MAX: "10000",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    // Браузер — на русском, как у основной аудитории: на /ru плашки языка нет
    // (англоязычный сценарий — отдельный тест в e2e/seo.spec.ts).
    locale: "ru-RU",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], locale: "ru-RU" } }],
  // e2e проверяет production-сборку: перед запуском нужен `npm run build`.
  webServer: [
    {
      command: `npm run start -- --port ${PORT}`,
      url: `http://localhost:${PORT}/ru`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: serverEnv,
    },
    {
      command: `npm run start -- --port ${FAILING_PORT}`,
      url: `http://localhost:${FAILING_PORT}/ru`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...serverEnv,
        NOTIFY_TRANSPORT: "live",
        LEADS_SQLITE_PATH: E2E_FAILING_DB,
        TELEGRAM_BOT_TOKEN: "test",
        TELEGRAM_CHAT_ID: "test",
        TELEGRAM_API_BASE: "http://127.0.0.1:9",
        NOTIFY_BASE_DELAY_MS: "50",
      },
    },
  ],
});
