/*
 * Lighthouse CI с Chrome от Playwright (тот же браузер, что у e2e): npm run lhci.
 * Перед запуском нужна production-сборка (npm run build). Конфиг — lighthouserc.cjs.
 */
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";

const env = { ...process.env, CHROME_PATH: process.env.CHROME_PATH ?? chromium.executablePath() };
const run = spawnSync("npx", ["lhci", "autorun"], { stdio: "inherit", env });
process.exit(run.status ?? 1);
