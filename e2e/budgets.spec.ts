import { expect, test, type Page } from "@playwright/test";
import { BUDGETS, MB } from "../src/canvas/budgets";
import { chapterIds } from "./pages";

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

    for (const id of chapterIds.slice(1)) {
      const mark = net.total();
      await page.evaluate((id) => {
        const top = document.getElementById(id)!.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, top - window.innerHeight / 2 + 80);
      }, id);
      await expect
        .poll(() =>
          page.evaluate(
            () => (window as unknown as { __stage: { loaded: string[] } }).__stage.loaded,
          ),
        )
        .toContain(id);
      await net.idle();
      const bytes = net.since(mark);
      console.log(`[${tier}] ${id}: ${kb(bytes)}`);
      expect(bytes, id).toBeLessThanOrEqual(BUDGETS.chapter);
    }
    expect(MB).toBe(1048576);
  });
}
