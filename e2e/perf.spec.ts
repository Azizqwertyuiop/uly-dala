import { expect, test, type Page } from "@playwright/test";

/*
 * Производительность (CLAUDE.md, раздел 12) — правила, которые можно проверить в headless:
 * - рендер стоит в статике: сцены на экране нет (бриф, футер) — кадры не рисуются;
 * - неактивные главы не считают циклы: видео коня не декодируется, когда коня не видно;
 * - INP ≤ 200 мс на медленном процессоре (CPU ×4) сразу после загрузки — с тем уровнем, который
 *   сайт сам выбирает такому устройству. В CI нет видеокарты (программный WebGL → fallback);
 *   INP во время запуска 3D на видеокарте (80–112 мс) — docs/performance.md.
 * Цифры fps / GPU / LCP по главам — docs/performance.md (замеры на реальной видеокарте).
 */

type Stage = { idle: boolean; current: string | null; dawn: { decoding: boolean } };
const stage = (page: Page) =>
  page.evaluate(() => (window as unknown as { __stage: Stage }).__stage);

async function openStage(page: Page) {
  await page.goto("/ru?quality=high");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 20_000 });
}

test.describe("производительность", () => {
  test.setTimeout(120_000);

  test("статика: без сцены на экране рендер стоит, со сценой — идёт", async ({ page }) => {
    await openStage(page);
    await expect.poll(async () => (await stage(page)).idle).toBe(false);
    await page.evaluate(() =>
      document.querySelector("#brief")!.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await expect.poll(async () => (await stage(page)).idle, { timeout: 10_000 }).toBe(true);
    await page.evaluate(() => {
      const t = document.querySelector<HTMLElement>("[data-track='fire']")!;
      window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY);
    });
    await expect.poll(async () => (await stage(page)).idle, { timeout: 10_000 }).toBe(false);
  });

  test("видео коня декодируется, только пока коня видно", async ({ page }) => {
    await openStage(page);
    await expect
      .poll(async () => (await stage(page)).dawn.decoding, { timeout: 15_000 })
      .toBe(true);
    await page.evaluate(() => {
      // «День» — фото, без 3D: коня там нет.
      const t = document.getElementById("day")!;
      window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY);
    });
    await expect
      .poll(async () => (await stage(page)).dawn.decoding, { timeout: 15_000 })
      .toBe(false);
  });

  test("INP ≤ 200 мс сразу после загрузки (телефон, CPU ×4)", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      const w = window as unknown as { __inp: number };
      w.__inp = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as (PerformanceEntry & { interactionId?: number })[])
          if (e.interactionId) w.__inp = Math.max(w.__inp, e.duration);
      }).observe({
        type: "event",
        durationThreshold: 16,
        buffered: true,
      } as PerformanceObserverInit);
    });
    await page.goto("/ru", { waitUntil: "load" });
    const menu = page.locator('header button[aria-haspopup="dialog"]');
    for (let i = 0; i < 12; i++) {
      await menu.tap();
      await page.waitForTimeout(80);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(80);
    }
    const inp = await page.evaluate(() => (window as unknown as { __inp: number }).__inp);
    expect(inp).toBeGreaterThan(0);
    expect(inp).toBeLessThanOrEqual(200);
    await context.close();
  });
});
