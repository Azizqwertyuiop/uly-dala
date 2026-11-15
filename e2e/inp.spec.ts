import { expect, test } from "@playwright/test";

/*
 * INP ≤ 200 мс на медленном процессоре (CPU ×4) сразу после загрузки (CLAUDE.md, раздел 12) —
 * с тем уровнем, который сайт сам выбирает такому устройству. Группа dom (Linux, без видеокарты:
 * программный WebGL → fallback). На виртуальной видеокарте macOS-сервера CI замер шумит
 * (224–520 мс на одном коде) — поэтому не в группе gpu. INP во время запуска 3D на настоящей
 * видеокарте (80–112 мс) — docs/performance.md.
 */
test.describe("производительность", () => {
  test.setTimeout(120_000);

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
