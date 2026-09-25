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
  test("текст hero не начинается с opacity 0, проявляется и становится обычным", async ({
    page,
  }) => {
    await page.goto("/ru");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(page.locator("html")).toHaveAttribute("data-reveal", "on");
    // Первый экран — вариант glow: текст с первой отрисовки в полном цвете (это и LCP).
    await expect(h1).toHaveAttribute("data-reveal", "glow");
    const initial = await h1.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { opacity: cs.opacity, color: cs.color, fill: cs.webkitTextFillColor };
    });
    expect(initial.opacity).toBe("1");
    expect(initial.color).not.toBe("rgba(0, 0, 0, 0)");
    expect(initial.fill).not.toBe("rgba(0, 0, 0, 0)");
    await expect(h1).toHaveAttribute("data-reveal-state", "done", { timeout: 2500 });
    // Итог — обычный цвет текста, без градиента.
    const style = await h1.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { color: cs.color, background: cs.backgroundImage };
    });
    expect(style.background).toBe("none");
    expect(style.color).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("запуск по видимости: заголовок ниже экрана ждёт, пока до него доскроллят", async ({
    page,
  }) => {
    await page.goto("/ru");
    const fire = page.locator("#fire-title");
    await page.waitForTimeout(1000);
    expect(await fire.getAttribute("data-reveal-state")).toBeNull();
    await fire.scrollIntoViewIfNeeded();
    await expect(fire).toHaveAttribute("data-reveal-state", /run|done/);
    await expect(fire).toHaveAttribute("data-reveal-state", "done", { timeout: 2000 });
  });

  test("градиент света идёт слева направо за 900 мс — на hero и ниже экрана", async ({ page }) => {
    await page.goto("/ru");
    const lightOf = (selector: string) =>
      page.locator(selector).evaluate(async (el: HTMLElement) => {
        for (let i = 0; i < 100 && el.dataset.revealState !== "run"; i++) {
          await new Promise((r) => setTimeout(r, 20));
        }
        const a = el.getAnimations({ subtree: true })[0] as CSSAnimation | undefined;
        if (!a) return null;
        // Позиция градиента в начале и в конце: свет идёт слева направо (100% → 0%).
        const target = (a.effect as KeyframeEffect).target as Element;
        const pseudo = (a.effect as KeyframeEffect).pseudoElement;
        const position = () => getComputedStyle(target, pseudo).backgroundPositionX;
        a.pause();
        a.currentTime = 0;
        const from = parseFloat(position());
        a.currentTime = 899;
        const to = Math.round(parseFloat(position()) * 100) / 100;
        a.play();
        return { name: a.animationName, duration: a.effect?.getTiming().duration, from, to };
      });
    const expected = { name: "reveal-light", duration: 900, from: 100, to: 0 };
    expect(await lightOf("#dawn-title")).toEqual(expected);
    await page.locator("#fire-title").scrollIntoViewIfNeeded();
    expect(await lightOf("#fire-title")).toEqual(expected);
  });

  test("ниже первого экрана текст до проявления приглушён, но не opacity 0", async ({ page }) => {
    await page.goto("/ru");
    const fire = page.locator("#fire-title");
    const style = await fire.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { opacity: cs.opacity, background: cs.backgroundImage, clip: cs.backgroundClip };
    });
    expect(style.opacity).toBe("1");
    expect(style.background).toContain("linear-gradient");
    expect(style.clip).toBe("text");
  });

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
