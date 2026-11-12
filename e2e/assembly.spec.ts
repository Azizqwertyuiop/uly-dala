import { expect, test, type Page } from "@playwright/test";

/*
 * Глава 2 «Сборка» (CLAUDE.md, раздел 2): порядок сборки при быстром скролле и обратимость,
 * мягкое притяжение (сцена, не скролл), подписи этапов, вращение с клавиатуры (крен 0),
 * развилка — оба пути, режим «Коротко» — четыре статичных кадра.
 * 3D в headless — программный WebGL; уровень задаётся явно (?quality=high), как в stage.spec.
 */

type Assembly = {
  p: number;
  phase: string;
  snapping: boolean;
  yaw: number;
  kerege: number;
  uyki: number;
  shanyrak: number;
  kiiz: number;
  pillar: number;
};

const assembly = (page: Page) =>
  page.evaluate(() => (window as unknown as { __stage: { assembly: Assembly } }).__stage.assembly);
const roll = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __stage: { camera: { roll: number } } }).__stage.camera.roll,
  );

async function openStage(page: Page) {
  await page.goto("/ru?quality=high");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 15_000 });
}

/** Прокрутка к прогрессу дорожки «Сборки» p (0 — экран прилип, 1 — отлип) — мгновенно. */
async function scrollTrack(page: Page, p: number) {
  await page.evaluate((p) => {
    const track = document.querySelector<HTMLElement>("[data-track='assembly']")!;
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (track.offsetHeight - window.innerHeight) * p);
  }, p);
}

test.describe("сборка юрты (3D)", () => {
  test.setTimeout(90_000);

  test("быстрый скролл не ломает порядок; скролл назад разбирает юрту", async ({ page }) => {
    await openStage(page);
    const violations: string[] = [];
    const check = (a: Assembly) => {
      if (a.uyki > 0 && a.kerege < 1) violations.push(`уықи раньше кереге: ${JSON.stringify(a)}`);
      if (a.shanyrak > 0 && a.uyki < 1)
        violations.push(`шаңырақ раньше уықи: ${JSON.stringify(a)}`);
      if (a.kiiz > 0 && a.shanyrak < 1)
        violations.push(`кийиз раньше шаңырақа: ${JSON.stringify(a)}`);
    };
    // Прыжки через этапы — сцена догоняет скролл, по дороге порядок соблюдается.
    for (const p of [0.7, 0.05, 0.95, 0.3, 0.8]) {
      await scrollTrack(page, p);
      for (let i = 0; i < 12; i++) {
        check(await assembly(page));
        await page.waitForTimeout(80);
      }
    }
    expect(violations).toEqual([]);

    // Середина шаңырақа: кереге и уықи стоят, войлока ещё нет.
    await scrollTrack(page, 0.6);
    await expect
      .poll(async () => (await assembly(page)).phase, { timeout: 10_000 })
      .toBe("shanyrak");
    await expect.poll(async () => (await assembly(page)).uyki, { timeout: 10_000 }).toBe(1);
    const mid = await assembly(page);
    expect(mid.kerege).toBe(1);
    expect(mid.kiiz).toBe(0);

    // Назад — к началу: юрта разобрана (обратимость).
    await scrollTrack(page, 0.02);
    await expect.poll(async () => (await assembly(page)).uyki, { timeout: 10_000 }).toBe(0);
    const back = await assembly(page);
    expect(back.shanyrak).toBe(0);
    expect(back.phase).toBe("kerege");
  });

  test("мягкое притяжение: остановка у конца этапа — сцена доезжает, скролл не двигается", async ({
    page,
  }) => {
    await openStage(page);
    // 96% первого этапа (в пределах 6% от конца).
    await scrollTrack(page, 0.25 * 0.96);
    const scrollY = await page.evaluate(() => window.scrollY);
    await expect
      .poll(async () => (await assembly(page)).p, { timeout: 10_000 })
      .toBeGreaterThan(0.249);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    // Вне зоны — не притягивает.
    await scrollTrack(page, 0.25 * 0.8);
    await expect
      .poll(async () => (await assembly(page)).p, { timeout: 10_000 })
      .toBeCloseTo(0.2, 2);
  });

  test("подписи этапов: этап и позиция приходят из сцены", async ({ page }) => {
    await openStage(page);
    const stage = page.locator("[data-assembly-stage]");
    await scrollTrack(page, 0.35);
    await expect(stage).toHaveAttribute("data-phase", "uyki", { timeout: 10_000 });
    await expect
      .poll(() => stage.evaluate((el) => el.style.getPropertyValue("--caption-xy")))
      .toMatch(/^\d+px, \d+px$/);
    await expect(page.locator("[data-part='uyki']")).toHaveCSS("opacity", "1");
    await scrollTrack(page, 1);
    await expect(stage).toHaveAttribute("data-phase", "pillar", { timeout: 10_000 });
    await expect(page.getByText("Шаңырақ был первым прожектором.")).toBeVisible();
  });

  test("вращение юрты стрелками: только вокруг вертикали, крен 0; внутри юрты — недоступно", async ({
    page,
  }) => {
    await openStage(page);
    await scrollTrack(page, 0.3);
    const slider = page.getByRole("slider", { name: "Повернуть юрту" });
    await expect(slider).toHaveAttribute("aria-disabled", "false", { timeout: 10_000 });
    await slider.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveAttribute("aria-valuenow", "30");
    await expect
      .poll(async () => (await assembly(page)).yaw, { timeout: 5_000 })
      .toBeCloseTo(Math.PI / 6, 2);
    expect(await roll(page)).toBe(0);
    await page.keyboard.press("Home");
    await expect(slider).toHaveAttribute("aria-valuenow", "0");

    await scrollTrack(page, 1);
    await expect(slider).toHaveAttribute("aria-disabled", "true", { timeout: 10_000 });
  });
});

test("первый экран: кто мы и заявка видны сразу; подписи этапов — когда юрта начала собираться", async ({
  page,
}) => {
  await page.goto("/ru?quality=high");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 20_000 });
  const hero = page.locator("[data-home-hero]");
  await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(hero.getByRole("link", { name: "Обсудить мероприятие" })).toBeVisible();
  const stage = page.locator("[data-assembly-stage]");
  await expect(stage).toHaveAttribute("data-building", "false");
  await expect(page.locator("[data-part='kerege']")).toHaveCSS("opacity", "0");
  await scrollTrack(page, 0.2);
  await expect(stage).toHaveAttribute("data-building", "true", { timeout: 10_000 });
});

test("режим «Коротко»: четыре статичных кадра этапов, без закреплённого экрана", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("uly-dala:ui-mode", "brief"));
  await page.goto("/ru");
  const frames = page.locator("#assembly [data-part] img");
  await expect(frames).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    await frames.nth(i).scrollIntoViewIfNeeded();
    await expect(frames.nth(i)).toBeVisible();
    expect(await frames.nth(i).getAttribute("alt")).toBeTruthy();
  }
  const stage = page.locator("[data-assembly-stage]");
  await expect(stage).not.toHaveCSS("position", "sticky");
  // Вращать нечего — элемента управления нет.
  await expect(page.getByRole("slider", { name: "Повернуть юрту" })).toBeHidden();
});
