import { expect, test, type Page } from "@playwright/test";

/*
 * Глава 4 «Огонь» (CLAUDE.md, раздел 2): макро у очага → dolly zoom в вид сверху без рывка,
 * закат → ночь, подписи блюд и сеты — с клавиатуры, на телефоне — список блюд, без JS — тоже работает.
 * 3D в headless — программный WebGL; уровень задаётся явно (?quality=high), как в stage.spec.
 */

type Fire = {
  p: number;
  phase: string;
  ortho: number;
  focal: number;
  set: string;
  hover: string;
  night: number;
};

const fire = (page: Page) =>
  page.evaluate(() => (window as unknown as { __stage: { fire: Fire } }).__stage.fire);
const camera = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __stage: { camera: { x: number; y: number; z: number; roll: number; fov: number } };
        }
      ).__stage.camera,
  );

async function openStage(page: Page, path = "/ru?quality=high") {
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 15_000 });
}

async function scrollFire(page: Page, p: number) {
  await page.evaluate((p) => {
    const track = document.querySelector<HTMLElement>("[data-track='fire']")!;
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (track.offsetHeight - window.innerHeight) * p);
  }, p);
}

/** Сцена «Огня» загружена (программный WebGL под нагрузкой — с запасом). */
async function waitFireReady(page: Page) {
  await expect.poll(async () => (await fire(page)).set, { timeout: 40_000 }).not.toBe("");
}

test.describe("«Огонь» — сцена", () => {
  test.setTimeout(150_000);

  test("переход перспектива → орто без рывка: плавно, монотонно, крен 0", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openStage(page);
    await scrollFire(page, 0.4);
    await waitFireReady(page);
    // Медленно через весь dolly zoom — шагами; сцена сглаживает, камера не прыгает.
    const samples: { focal: number; ortho: number; fov: number; roll: number; y: number }[] = [];
    for (let i = 0; i <= 24; i++) {
      await scrollFire(page, 0.4 + (0.36 * i) / 24);
      await page.waitForTimeout(250);
      const f = await fire(page);
      const c = await camera(page);
      samples.push({ focal: f.focal, ortho: f.ortho, fov: c.fov, roll: c.roll, y: c.y });
    }
    await expect.poll(async () => (await fire(page)).ortho, { timeout: 30_000 }).toBe(1);
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1]!;
      const b = samples[i]!;
      expect(b.roll).toBe(0);
      // Монотонно: фокусное растёт, «орто» растёт — без откатов и скачков.
      expect(b.focal).toBeGreaterThanOrEqual(a.focal - 1e-6);
      expect(b.ortho).toBeGreaterThanOrEqual(a.ortho - 1e-6);
      // Шаг скролла — 1,5% дорожки: фокусное меняется не больше чем в 1,6 раза за шаг.
      expect(b.focal / a.focal).toBeLessThan(1.6);
    }
    const end = await camera(page);
    expect(end.fov).toBeLessThan(2); // почти орто
    expect(end.y).toBeGreaterThan(50); // вид сверху
  });

  test("закат → ночь по прогрессу главы", async ({ page }) => {
    await openStage(page);
    await scrollFire(page, 0.05);
    await waitFireReady(page);
    await expect.poll(async () => (await fire(page)).night, { timeout: 20_000 }).toBeLessThan(0.1);
    await scrollFire(page, 0.95);
    await expect
      .poll(async () => (await fire(page)).night, { timeout: 30_000 })
      .toBeGreaterThan(0.95);
  });

  test("с клавиатуры: сеты, подписи блюд; фокус на плане докручивает к плану", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openStage(page);
    await scrollFire(page, 0.25);
    await waitFireReady(page);
    await expect.poll(async () => (await fire(page)).phase, { timeout: 20_000 }).toBe("macro");

    // Сеты — радиокнопки: фокус с клавиатуры → страница доезжает до плана.
    const traditional = page.getByRole("radio", { name: "Традиционный" });
    await traditional.focus();
    await expect.poll(async () => (await fire(page)).phase, { timeout: 30_000 }).toBe("plan");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("radio", { name: "Банкет" })).toBeChecked();
    await expect.poll(async () => (await fire(page)).set).toBe("banquet");

    // Подпись блюда: Tab — к блюдам сета, подпись видна, блюдо в сцене подсвечено.
    const dish = page.getByRole("button", { name: /Горячее с огня/ });
    await dish.focus();
    await expect(dish.getByText("Готовится здесь же", { exact: false })).toHaveCSS("opacity", "1");
    await expect.poll(async () => (await fire(page)).hover).toBe("hot");
    await expect(dish).toHaveAccessibleDescription(/на\sогне\sи\sв\sказане/);

    // CTA «Запросить меню» — мини-форма в окне.
    await page.getByRole("link", { name: "Запросить меню" }).click();
    await expect(page.getByRole("dialog", { name: "Запросить меню" })).toBeVisible();
  });
});

test("телефон: вместо вида сверху — вертикальный список блюд, камера у очага", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await openStage(page, "/ru?quality=medium");
  await scrollFire(page, 0.9);
  await waitFireReady(page);
  await expect(page.getByRole("list", { name: /Блюда сета: Традиционный/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Бешбармак/ })).toBeHidden();
  await expect.poll(async () => (await fire(page)).phase, { timeout: 30_000 }).toBe("plan");
  expect((await fire(page)).ortho).toBe(0);
  await context.close();
});

test("без JS: сеты переключаются и списки блюд видны (CSS :checked)", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/ru");
  const banquet = page.getByRole("list", { name: /Блюда сета: Банкет/ });
  await expect(page.getByRole("list", { name: /Блюда сета: Традиционный/ })).toBeVisible();
  await expect(banquet).toBeHidden();
  await page.getByText("Банкет", { exact: true }).click();
  await expect(banquet).toBeVisible();
  await expect(banquet.getByRole("listitem")).toHaveCount(6);
  await context.close();
});
