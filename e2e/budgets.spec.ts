import { expect, test, type Page } from "@playwright/test";
import { BUDGETS, MB } from "../src/canvas/budgets";

/*
 * Бюджеты по реальному трафику (раздел 12): байты по сети (encodedDataLength, со сжатием).
 * CI падает, если первая загрузка, первая сцена или любая глава больше бюджета.
 */

type Meter = { total: () => number; since: (mark: number) => number; idle: () => Promise<void> };

async function meter(page: Page): Promise<Meter> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  let bytes = 0;
  // Байты считаем по мере получения (dataReceived), а не только по завершении запроса:
  // видео с альфой держит медиазапрос открытым.
  cdp.on("Network.dataReceived", (e) => {
    bytes += e.encodedDataLength;
  });
  cdp.on("Network.responseReceived", () => {});
  return {
    total: () => bytes,
    since: (mark) => bytes - mark,
    // Трафик не растёт 1 с (не дольше 20 с).
    idle: async () => {
      let last = -1;
      let quiet = 0;
      for (let i = 0; i < 200 && quiet < 10; i++) {
        await page.waitForTimeout(100);
        quiet = bytes === last ? quiet + 1 : 0;
        last = bytes;
      }
    },
  };
}

const kb = (b: number) => `${(b / 1024).toFixed(0)} КБ`;

for (const [tier, viewport] of [
  ["high", { width: 1440, height: 900 }],
  ["medium", { width: 390, height: 844 }],
] as const) {
  test(`бюджеты загрузки (${tier})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    const net = await meter(page);
    await page.goto(`/ru?quality=${tier}`, { waitUntil: "load" });
    const atLoad = net.total();
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 20_000 });
    await net.idle();
    const firstLoad = net.total();
    const firstScene = net.since(atLoad);
    console.log(`[${tier}] первая загрузка ${kb(firstLoad)}, первая сцена ${kb(firstScene)}`);
    expect(firstLoad, "первая загрузка").toBeLessThanOrEqual(BUDGETS.firstLoad);
    expect(firstScene, "первая сцена").toBeLessThanOrEqual(BUDGETS.firstScene);

    // Остальная главная-визитка (услуги, галерея, фазенда, команда…) — без 3D:
    // всё, что догружается при прокрутке до конца, — в бюджете главы.
    const mark = net.total();
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += viewport.height) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(150);
    }
    await net.idle();
    const rest = net.since(mark);
    console.log(`[${tier}] остальная страница: ${kb(rest)}`);
    expect(rest, "остальная страница").toBeLessThanOrEqual(BUDGETS.chapter);
    expect(MB).toBe(1048576);
  });
}
