import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
/** Второй сервер: уведомления «падают» (Telegram на закрытом порту) — для теста алерта. */
export const FAILING_PORT = 3101;

export const E2E_DB = ".data/e2e.sqlite";
export const E2E_FAILING_DB = ".data/e2e-failing.sqlite";

const serverEnv = {
  NOTIFY_TRANSPORT: "mock",
  // Абсолютный путь: сервер релиза (.next/standalone/server.js) работает из своей папки.
  LEADS_SQLITE_PATH: resolve(E2E_DB),
  // Тесты шлют много заявок с одного IP.
  RATE_LIMIT_MAX: "10000",
};

/*
 * Группы e2e для CI (.github/workflows/ci.yml). Локально (без E2E_GROUP) — все тесты.
 * gpu — файлы с живым 3D (?quality=high/medium): по правилу «шаг анимации ≤ 0,1 с» при 1–3 кадрах
 * в секунду сцена живёт в разы медленнее часов, а у Linux-серверов GitHub нет видеокарты
 * (3D на процессоре) — эти файлы идут на macOS-сервере. dom — остальное, на Linux.
 */
export const GPU_SPECS = [
  "a11y-flows",
  "assembly",
  "budgets",
  "dawn",
  "day",
  "finale",
  "fire",
  "mobile",
  "motion",
  "perf",
  "stage",
  "telemetry",
  "world",
];
const gpuFiles = GPU_SPECS.map((name) => `**/${name}.spec.ts`);
const group = process.env.E2E_GROUP;

export default defineConfig({
  testDir: "./e2e",
  ...(group === "gpu" ? { testMatch: gpuFiles } : group === "dom" ? { testIgnore: gpuFiles } : {}),
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
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        locale: "ru-RU",
        // E2E_GPU=1 (macOS): headless Chromium рисует через видеокарту (Metal), а не процессором.
        ...(process.env.E2E_GPU ? { launchOptions: { args: ["--use-angle=metal"] } } : {}),
      },
    },
  ],
  // e2e проверяет сам релиз (.next/standalone, как на сервере): перед запуском — `npm run build`.
  webServer: [
    {
      command: "npm run start",
      url: `http://localhost:${PORT}/ru`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { ...serverEnv, PORT: String(PORT), HOSTNAME: "localhost" },
    },
    {
      command: "npm run start",
      url: `http://localhost:${FAILING_PORT}/ru`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...serverEnv,
        PORT: String(FAILING_PORT),
        HOSTNAME: "localhost",
        NOTIFY_TRANSPORT: "live",
        LEADS_SQLITE_PATH: resolve(E2E_FAILING_DB),
        TELEGRAM_BOT_TOKEN: "test",
        TELEGRAM_CHAT_ID: "test",
        TELEGRAM_API_BASE: "http://127.0.0.1:9",
        NOTIFY_BASE_DELAY_MS: "50",
      },
    },
  ],
});
