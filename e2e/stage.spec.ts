import { expect, test, type Page } from "@playwright/test";

/*
 * 3D-сцена (CLAUDE.md, разделы 6–7). В headless Chromium WebGL программный (SwiftShader) —
 * сайт честно выбирает fallback, поэтому здесь уровень задаётся явно: ?quality=high.
 */

type Stage = {
  idle: boolean;
  quality: string;
  context: string;
  current: string | null;
  loaded: string[];
  introSkipped: boolean;
  frames: number;
  camera: { x: number; y: number; z: number; roll: number };
};

const stage = (page: Page) =>
  page.evaluate(() => (window as unknown as { __stage: Stage }).__stage);

async function openStage(page: Page, path = "/ru?quality=high") {
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 15_000 });
}

const CHAPTER_SPACING = 60;

test.describe("холст сцены", () => {
  test("постоянный Canvas: fixed, слой canvas, aria-hidden; статичные кадры уступают место", async ({
    page,
  }) => {
    await openStage(page);
    const root = page.locator("[data-canvas-root]");
    await expect(root).toHaveAttribute("aria-hidden", "true");
    await expect(root.locator("canvas")).toHaveCount(1);
    const style = await root.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { position: cs.position, z: cs.zIndex, events: cs.pointerEvents };
    });
    expect(style).toEqual({ position: "fixed", z: "0", events: "none" });
    // Кадр уступает место прозрачностью — описание сцены остаётся для скринридера (WCAG 1.1.1).
    await expect(page.locator("#assembly [data-scene-slot]").first()).toHaveCSS("opacity", "0");
    // Текст — над холстом: клик по CTA доходит до ссылки.
    await expect(
      page.locator("[data-home-hero]").getByRole("link", { name: "Обсудить мероприятие" }),
    ).toBeVisible();
    const s = await stage(page);
    expect(s.quality).toBe("high");
    expect(s.current).toBe("assembly");
    expect(s.camera.roll).toBe(0);
  });

  test("не пересоздаётся при навигации", async ({ page }) => {
    await openStage(page);
    await page.evaluate(() => {
      (window as unknown as { __canvasBefore: Element | null }).__canvasBefore =
        document.querySelector("[data-canvas-root] canvas");
    });
    await page.locator("footer").getByRole("link", { name: "О фазенде" }).click();
    await expect(page).toHaveURL(/\/ru\/fazenda$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Этот мир существует/);
    const same = await page.evaluate(
      () =>
        (window as unknown as { __canvasBefore: Element | null }).__canvasBefore ===
        document.querySelector("[data-canvas-root] canvas"),
    );
    expect(same).toBe(true);
    // На странице без глав сцен нет.
    await expect.poll(async () => (await stage(page)).loaded).toEqual([]);
  });

  test("камера: сборка юрты на первом экране, в конце — внутри юрты; ниже — холст стоит", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openStage(page);
    const s0 = await stage(page);
    expect(s0.current).toBe("assembly");
    expect(s0.loaded).toEqual(expect.arrayContaining(["dawn", "assembly"]));
    // Конец дорожки сборки — камера внутри юрты (якорь z = −60, радиус 3 м), крен 0.
    await page.evaluate(() => {
      const t = document.querySelector<HTMLElement>("[data-track='assembly']")!;
      window.scrollTo(
        0,
        t.getBoundingClientRect().top + window.scrollY + t.offsetHeight - innerHeight,
      );
    });
    await expect
      .poll(
        async () => {
          const c = (await stage(page)).camera;
          return Math.hypot(c.x, c.z + CHAPTER_SPACING);
        },
        { timeout: 15_000 },
      )
      .toBeLessThan(2.5);
    expect((await stage(page)).camera.roll).toBe(0);
    // Разделы визитки — без 3D: рендер стоит.
    await page.locator("#services").scrollIntoViewIfNeeded();
    await expect
      .poll(async () => ((await stage(page)) as unknown as { idle: boolean }).idle, {
        timeout: 10_000,
      })
      .toBe(true);
  });

  test("обновление посреди сборки: сразу нужная сцена и камера", async ({ page }) => {
    await openStage(page);
    await page.evaluate(() => {
      const t = document.querySelector<HTMLElement>("[data-track='assembly']")!;
      window.scrollTo(
        0,
        t.getBoundingClientRect().top + window.scrollY + (t.offsetHeight - innerHeight) * 0.6,
      );
    });
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 15_000 });
    const s = await stage(page);
    expect(s.current).toBe("assembly");
    expect(s.introSkipped).toBe(true);
    expect(s.frames).toBeLessThan(30);
  });
});

test.describe("потеря контекста WebGL", () => {
  test("не восстановился → fallback без перезагрузки: холст убран, кадры видны", async ({
    page,
  }) => {
    await openStage(page);
    await page.evaluate(() => {
      (window as unknown as { __marker: number }).__marker = 42;
      const canvas = document.querySelector("[data-canvas-root] canvas") as HTMLCanvasElement;
      const gl = (canvas.getContext("webgl2") ??
        canvas.getContext("webgl")) as WebGL2RenderingContext;
      gl.getExtension("WEBGL_lose_context")!.loseContext();
    });
    await expect.poll(async () => (await stage(page)).context).toBe("lost");
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "off", { timeout: 8_000 });
    await expect(page.locator("html")).toHaveAttribute("data-quality", "fallback");
    await expect(page.locator("[data-canvas-root] canvas")).toHaveCount(0);
    await expect(page.locator("#assembly [data-scene-slot]").first()).toHaveCSS("opacity", "1");
    // Страница не перезагружалась.
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(
      42,
    );
  });

  test("восстановился вовремя → сцена продолжает работать", async ({ page }) => {
    await openStage(page);
    await page.evaluate(async () => {
      const canvas = document.querySelector("[data-canvas-root] canvas") as HTMLCanvasElement;
      const gl = (canvas.getContext("webgl2") ??
        canvas.getContext("webgl")) as WebGL2RenderingContext;
      const ext = gl.getExtension("WEBGL_lose_context")!;
      ext.loseContext();
      await new Promise((r) => setTimeout(r, 500));
      ext.restoreContext();
    });
    await expect.poll(async () => (await stage(page)).context, { timeout: 5_000 }).toBe("ok");
    const frames = (await stage(page)).frames;
    await page.waitForTimeout(4_000);
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready");
    expect((await stage(page)).frames).toBeGreaterThan(frames);
  });
});

test.describe("уровни качества", () => {
  // «Программный WebGL → fallback» — e2e/quality-detect.spec.ts (всегда без видеокарты).

  test("?quality=fallback и режим «Коротко» — без Canvas", async ({ page }) => {
    await page.goto("/ru?quality=fallback");
    await expect(page.locator("html")).toHaveAttribute("data-quality", "fallback", {
      timeout: 10_000,
    });
    await expect(page.locator("[data-canvas-root] canvas")).toHaveCount(0);

    await page.addInitScript(() => localStorage.setItem("uly-dala:ui-mode", "brief"));
    await page.goto("/ru?quality=high");
    await page.waitForTimeout(2_000);
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "off");
    await expect(page.locator("[data-canvas-root] canvas")).toHaveCount(0);
  });

  test("?debug: fps, JS/GPU мс, draw calls, память, сплайны камеры", async ({ page }) => {
    await openStage(page, "/ru?quality=high&debug");
    const hud = page.locator("[data-debug-hud]");
    await expect(hud).toContainText("fps", { timeout: 5_000 });
    for (const label of ["JS, мс", "GPU, мс", "draw calls", "память", "камера"]) {
      await expect(hud).toContainText(label);
    }
    // Сплайны камеры — две линии в сцене: draw calls больше, чем без debug.
    await expect
      .poll(async () => Number((await hud.textContent())?.match(/draw calls (\d+)/)?.[1]))
      .toBeGreaterThan(2);
  });
});
