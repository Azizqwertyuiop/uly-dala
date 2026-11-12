import { expect, test } from "@playwright/test";

/*
 * Ядро движения (CLAUDE.md, раздел 5): один rAF, проявление светом, Lenis только на десктопе.
 */

/** Считает вызовы нативного rAF: скрипт выполняется до кода страницы, ticker получает обёртку. */
const countNativeRaf = () => {
  const native = window.requestAnimationFrame.bind(window);
  (window as unknown as { __nativeRafCalls: number }).__nativeRafCalls = 0;
  window.requestAnimationFrame = (cb) => {
    (window as unknown as { __nativeRafCalls: number }).__nativeRafCalls++;
    return native(cb);
  };
};

type Stats = { calls: number; frames: number; lenis: boolean };
const readStats = (): Stats => {
  const w = window as unknown as { __nativeRafCalls: number; __ticker?: { frames: number } };
  return {
    calls: w.__nativeRafCalls,
    frames: w.__ticker?.frames ?? 0,
    lenis: document.documentElement.classList.contains("lenis"),
  };
};

for (const [label, path] of [
  ["без 3D", "/ru"],
  ["с 3D-сценой (three.js, R3F)", "/ru?quality=high"],
] as const) {
  test(`ровно один requestAnimationFrame на кадр — Lenis, GSAP, ScrollTrigger, ${label}`, async ({
    page,
  }) => {
    await page.addInitScript(countNativeRaf);
    await page.goto(path);
    // Дождаться ленивой загрузки Lenis/GSAP (и сцены, если она есть).
    await expect.poll(() => page.evaluate(readStats).then((s) => s.lenis)).toBe(true);
    if (path.includes("quality=high")) {
      await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", {
        timeout: 15_000,
      });
    }

    const before = await page.evaluate(readStats);
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(500);
    const after = await page.evaluate(readStats);

    const frames = after.frames - before.frames;
    const calls = after.calls - before.calls;
    expect(frames).toBeGreaterThan(20);
    // Каждый кадр — ровно один нативный вызов (±1 на границах замера).
    expect(Math.abs(calls - frames)).toBeLessThanOrEqual(1);
  });
}

test("Lenis — только на десктопе; на тач — нативный скролл", async ({ browser }) => {
  const touch = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await touch.newPage();
  await page.goto("/ru");
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => document.documentElement.classList.contains("lenis"))).toBe(
    false,
  );
  await touch.close();
});

test.describe("проявление светом", () => {
  test("prefers-reduced-motion — текст сразу виден, без градиента", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/ru");
    await expect(page.locator("html")).not.toHaveAttribute("data-reveal", /.*/);
    const h1 = page.getByRole("heading", { level: 1 });
    expect(await h1.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe("none");
  });

  test("режим «Коротко» — без проявления", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("uly-dala:ui-mode", "brief"));
    await page.goto("/ru");
    await expect(page.locator("html")).not.toHaveAttribute("data-reveal", /.*/);
  });

  test("страховка: если приложение не запустилось, через 1,5 с текст полностью виден", async ({
    page,
  }) => {
    // Блокируем JS-чанки приложения: работает только скрипт в <head>.
    await page.route("**/_next/static/chunks/**/*.js", (route) => route.abort());
    await page.goto("/ru");
    await expect(page.locator("html")).toHaveAttribute("data-reveal", "on");
    await page.waitForTimeout(1700);
    const h1 = page.getByRole("heading", { level: 1 });
    expect(await h1.evaluate((el) => getComputedStyle(el).backgroundImage)).toBe("none");
  });
});
