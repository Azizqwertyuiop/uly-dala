import { expect, test, type Page } from "@playwright/test";

/*
 * Глава 1 «Рассвет» (CLAUDE.md, раздел 2): интро, серебряная волна один раз, ветер от курсора,
 * CTA с первой секунды, текст hero — HTML, статичный кадр при reduced motion.
 * WebGL в headless программный — уровень задаётся явно (?quality=high), как в stage.spec.
 */

type Dawn = { introTime: number | null; wave: boolean; clip: string; textOut: boolean };

const dawn = (page: Page) =>
  page.evaluate(() => (window as unknown as { __stage: { dawn: Dawn } }).__stage.dawn);
const wind = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as { __stage: { windProbe: null | (() => number) } }
      ).__stage.windProbe?.() ?? 0,
  );

async function openDawn(page: Page, path = "/ru?quality=high") {
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 15_000 });
}

test("текст hero — в HTML без JS: заголовок, подзаголовок, CTA", async ({ request }) => {
  const html = (await (await request.get("/ru")).text()).replace(/\u00a0|&nbsp;/g, " ");
  expect(html).toContain("Мы ставим мир.");
  expect(html).toContain("Ивент-агентство полного цикла");
  expect(html).toMatch(/<h1[^>]*>[^<]*Мы ставим/);
  expect(html).toContain("data-hero-text");
});

test("CTA кликабельны с первой секунды — не ждут интро и 3D", async ({ page }) => {
  await page.goto("/ru?quality=high", { waitUntil: "domcontentloaded" });
  const cta = page.locator("[data-dawn-hover]").first();
  await expect(cta).toBeVisible({ timeout: 1_000 });
  // Ничего не перекрывает кнопку (интро, прелоадер, подложка текста).
  const onTop = await cta.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return hit === el || el.contains(hit);
  });
  expect(onTop).toBe(true);
  await cta.click({ timeout: 1_000, trial: true });
});

test("серебряная волна — только при первом визите (флаг в localStorage)", async ({ page }) => {
  test.setTimeout(60_000);
  await openDawn(page);
  await expect.poll(async () => (await dawn(page)).wave, { timeout: 15_000 }).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("uly-dala:wave-seen"))).not.toBeNull();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 15_000 });
  // Интро идёт, но волны нет — на всём её отрезке (2–3,5 с) и после.
  let sawWave = false;
  await expect
    .poll(
      async () => {
        const d = await dawn(page);
        sawWave ||= d.wave;
        return d.introTime ?? 0;
      },
      { timeout: 20_000 },
    )
    .toBeGreaterThan(4);
  expect(sawWave).toBe(false);
});

test("ветер от курсора виден и затухает", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await openDawn(page);
  await expect
    .poll(
      () =>
        page.evaluate(
          () => typeof (window as unknown as { __stage: { windProbe: unknown } }).__stage.windProbe,
        ),
      { timeout: 10_000 },
    )
    .toBe("function");
  const calm = await wind(page);
  // Быстрое движение мыши над полем (нижняя треть кадра — трава).
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(200 + i * 70, 620 + (i % 2) * 30, { steps: 2 });
  }
  // Пик порыва — в ближайшие кадры (в headless кадр программный и медленный).
  let gust = 0;
  for (let k = 0; k < 6; k++) {
    gust = Math.max(gust, await wind(page));
    await page.waitForTimeout(150);
  }
  expect(gust).toBeGreaterThan(calm * 2 + 0.01);
  // Без движения порыв затухает (по delta, ~1,2 с); программные порывы слабее курсора.
  await expect.poll(() => wind(page), { timeout: 20_000 }).toBeLessThan(gust * 0.5);
});

test("reduced motion: статичный кадр, без интро и волны, текст виден сразу", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/ru");
  await expect(page.locator("[data-scene-slot]").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const opacity = await page
    .locator("[data-hero-text]")
    .evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBe(1);
});
