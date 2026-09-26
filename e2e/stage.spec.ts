import { expect, test, type Page } from "@playwright/test";
import { chapterIds } from "./pages";

/*
 * 3D-сцена (CLAUDE.md, разделы 6–7). В headless Chromium WebGL программный (SwiftShader) —
 * сайт честно выбирает fallback, поэтому здесь уровень задаётся явно: ?quality=high.
 */

type Stage = {
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

/** Прокрутить так, чтобы верх главы оказался на середине экрана (глава стала текущей). */
async function scrollToChapter(page: Page, id: string, extra = 40) {
  await page.evaluate(
    ({ id, extra }) => {
      const top = document.getElementById(id)!.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top - window.innerHeight / 2 + extra);
    },
    { id, extra },
  );
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
    await expect(page.locator("#dawn [data-scene-slot]")).toHaveCSS("visibility", "hidden");
    // Текст — над холстом: клик по CTA доходит до ссылки.
    await expect(
      page.locator("#dawn").getByRole("link", { name: "Смотреть фазенду" }),
    ).toBeVisible();
    const s = await stage(page);
    expect(s.quality).toBe("high");
    expect(s.current).toBe("dawn");
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

  test("камера проходит весь сайт: каждая глава — своя сцена и своя точка пути", async ({
    page,
  }) => {
    await openStage(page);
    for (const [i, id] of chapterIds.entries()) {
      await scrollToChapter(page, id);
      await expect.poll(async () => (await stage(page)).current, { timeout: 10_000 }).toBe(id);
      // Программный WebGL под параллельной нагрузкой — медленный: запас по времени.
      await expect.poll(async () => (await stage(page)).loaded, { timeout: 15_000 }).toContain(id);
      // Камера у своей главы (якоря глав через 60 м по −Z).
      await expect
        .poll(async () => Math.abs((await stage(page)).camera.z + i * CHAPTER_SPACING), {
          timeout: 10_000,
        })
        .toBeLessThan(CHAPTER_SPACING * 0.6);
      const s = await stage(page);
      expect(s.camera.roll).toBe(0);
      expect(s.camera.y).toBeLessThanOrEqual(1.8);
      // Дальше двух глав ничего не держим.
      for (const loaded of s.loaded) {
        expect(
          Math.abs(chapterIds.indexOf(loaded as (typeof chapterIds)[number]) - i),
        ).toBeLessThanOrEqual(2);
      }
    }
  });

  test("обновление посреди страницы: сразу нужная сцена и камера, интро пропущено", async ({
    page,
  }) => {
    await openStage(page);
    await scrollToChapter(page, "fire", 200);
    await expect.poll(async () => (await stage(page)).current).toBe("fire");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 15_000 });
    const s = await stage(page);
    expect(s.current).toBe("fire");
    expect(s.loaded).toContain("fire");
    expect(s.loaded).not.toContain("dawn");
    expect(s.introSkipped).toBe(true);
    // Камера уже у «Огня» с первого кадра — без облёта от начала сайта.
    expect(Math.abs(s.camera.z + 3 * CHAPTER_SPACING)).toBeLessThan(CHAPTER_SPACING * 0.6);
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
    await expect(page.locator("#dawn [data-scene-slot]")).toHaveCSS("visibility", "visible");
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
  test("программный WebGL (headless) → fallback: Canvas не монтируется", async ({ page }) => {
    await page.goto("/ru");
    await expect(page.locator("html")).toHaveAttribute("data-quality", "fallback", {
      timeout: 10_000,
    });
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "off");
    await expect(page.locator("[data-canvas-root] canvas")).toHaveCount(0);
  });

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
