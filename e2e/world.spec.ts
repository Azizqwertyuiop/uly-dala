import { devices, expect, test, type Page } from "@playwright/test";

/*
 * Глава 5 «Этот мир существует» (CLAUDE.md, раздел 2): лента реальных событий (WebGL-кадры поверх
 * <img>), фазенда (сплаты на high десктопа, видео облёта на medium и мобильных), «свет»,
 * остановки в зонах, переход в кейс общим элементом и «назад», мини-форма «Приехать на просмотр».
 * 3D в headless — программный WebGL; уровень задаётся явно (?quality=high), как в stage.spec.
 */

type World = { mode: string; p: number; zone: number; light: number; roll: number };
type Images = { tracked: number; loaded: number; visible: number };

const world = (page: Page) =>
  page.evaluate(() => (window as unknown as { __stage: { world: World } }).__stage.world);
const images = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __stage: { realImages: Images } }).__stage.realImages,
  );

async function openStage(page: Page, path = "/ru?quality=high") {
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 15_000 });
}

async function scrollWorld(page: Page, p: number) {
  await page.evaluate((p) => {
    const track = document.querySelector<HTMLElement>("[data-track='world']")!;
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (track.offsetHeight - window.innerHeight) * p);
  }, p);
}

async function scrollArchive(page: Page) {
  await page.evaluate(() => {
    const list = document.querySelector<HTMLElement>("#world img[data-gl-image]")!;
    window.scrollTo(0, list.getBoundingClientRect().top + window.scrollY - 120);
  });
}

/** Сцена фазенды загружена (программный WebGL под нагрузкой — с запасом). */
async function waitWorld(page: Page) {
  await expect.poll(async () => (await world(page)).mode, { timeout: 40_000 }).not.toBe("");
}

/** Запросы сплатов: файл .splat (библиотека Spark грузится в том же условии). */
function trackSplats(page: Page) {
  const urls: string[] = [];
  page.on("request", (r) => {
    if (/\.(splat|spz|ply)(\?|$)/.test(r.url())) urls.push(r.url());
  });
  return urls;
}

test.describe("«Этот мир существует» — фазенда", () => {
  test.setTimeout(150_000);

  test("десктоп high: сплаты, «свет», остановки по четырём зонам, крен 0", async ({ page }) => {
    const splats = trackSplats(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await openStage(page);
    await scrollWorld(page, 0);
    await waitWorld(page);
    expect((await world(page)).mode).toMatch(/^splats/);
    expect(splats.length).toBe(1);

    // «Свет»: в начале дорожки фазенды не видно, дальше — кадр целиком.
    await expect
      .poll(async () => (await world(page)).light, { timeout: 10_000 })
      .toBeLessThan(0.05);
    // Остановки — в середине отрезков зон; ждём зону на экране (не точное число прогресса:
    // под нагрузкой замер дорожки сайтом и тестом может расходиться на десятки пикселей).
    const stage = page.locator("[data-world-stage]");
    for (const [p, zone] of [
      [0.25, "field"],
      [0.42, "tent"],
      [0.58, "yurt"],
      [0.75, "kitchen"],
    ] as const) {
      await scrollWorld(page, p);
      await expect(stage).toHaveAttribute("data-zone", zone, { timeout: 10_000 });
      await expect.poll(async () => (await world(page)).light, { timeout: 10_000 }).toBe(1);
      expect((await world(page)).roll).toBe(0);
    }
  });

  for (const [name, device] of [
    ["iPhone", devices["iPhone 13"]],
    ["Android", devices["Pixel 7"]],
  ] as const) {
    test(`${name}: сплаты не грузятся даже с ?quality=high — видео облёта`, async ({ browser }) => {
      const context = await browser.newContext({ ...device });
      const page = await context.newPage();
      const splats = trackSplats(page);
      const video: string[] = [];
      page.on("request", (r) => {
        if (r.url().includes("fazenda-flyover")) video.push(r.url());
      });
      await openStage(page);
      await scrollWorld(page, 0.3);
      await waitWorld(page);
      expect((await world(page)).mode).not.toMatch(/splats/);
      expect(splats).toEqual([]);
      expect(video.some((u) => u.endsWith(".mp4"))).toBe(true);
      await context.close();
    });
  }

  test("«Ещё на фазенде» — в потоке главы, не поверх сцены и не на панели зон", async ({
    page,
  }) => {
    await openStage(page);
    const extras = page.locator("#world-extras").locator("..");
    expect(await extras.evaluate((el) => getComputedStyle(el).position)).toBe("static");
    // Весь блок — до дорожки облёта (не на закреплённой сцене).
    const [extrasBottom, trackTop] = await page.evaluate(() => {
      const e = document.getElementById("world-extras")!.parentElement!.getBoundingClientRect();
      const t = document.querySelector("[data-track='world']")!.getBoundingClientRect();
      return [e.bottom, t.top];
    });
    expect(extrasBottom).toBeLessThanOrEqual(trackTop);
  });

  test("medium на десктопе — видео облёта, без сплатов", async ({ page }) => {
    const splats = trackSplats(page);
    await openStage(page, "/ru?quality=medium");
    await scrollWorld(page, 0.3);
    await waitWorld(page);
    expect((await world(page)).mode).not.toMatch(/splats/);
    expect(splats).toEqual([]);
  });
});

test.describe("«Этот мир существует» — лента архива", () => {
  test.setTimeout(120_000);

  test("кадры — WebGL-плоскости поверх <img>: грузятся за 2 экрана, выгружаются дальше 5", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openStage(page);
    await scrollArchive(page);
    await expect.poll(async () => (await images(page)).loaded, { timeout: 30_000 }).toBe(3);
    const frame = page.locator("#world img[data-gl-image]").first();
    // <img> на месте (alt, доступность), но не рисуется поверх своего двойника.
    await expect(frame).toHaveAttribute("data-gl", "ready");
    await expect(frame).toHaveAttribute("alt", /.+/);
    expect(await frame.evaluate((img) => getComputedStyle(img).opacity)).toBe("0");

    // Далеко (начало страницы) — выгружено из GPU, <img> снова обычная картинка.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => (await images(page)).loaded, { timeout: 15_000 }).toBe(0);
    await expect(frame).not.toHaveAttribute("data-gl", /.*/);
  });

  test("переход в кейс общим элементом, «назад» — на то же место", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openStage(page);
    await scrollArchive(page);
    await expect.poll(async () => (await images(page)).loaded, { timeout: 30_000 }).toBe(3);
    const before = await page.evaluate(() => window.scrollY);
    const link = page.locator("#world a[href$='/cases/evening-wedding']");
    await link.click();
    await expect(page).toHaveURL(/\/ru\/cases\/evening-wedding$/);
    await expect(page.getByRole("heading", { level: 1, name: "Вечерняя свадьба" })).toBeVisible();
    // Обложка — общий элемент перехода.
    await expect(page.locator("[data-case-cover] img")).toHaveCSS(
      "view-transition-name",
      "case-cover",
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/ru(\?.*)?$/);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 })
      .toBeGreaterThan(before - 80);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(before + 80);
  });

  test("прямой заход на страницу кейса (без главной)", async ({ page }) => {
    const response = await page.goto("/ru/cases/kudalyk-two-families");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Кудалык двух семей" })).toBeVisible();
    await expect(page.locator("[data-case-cover] img")).toBeVisible();
  });

  test("«Приехать на просмотр» — мини-форма", async ({ page }) => {
    await page.goto("/ru");
    await page.locator("#world").getByRole("link", { name: "Приехать на просмотр" }).click();
    await expect(page.getByRole("dialog", { name: "Приехать на просмотр" })).toBeVisible();
  });
});

test.describe("«Этот мир существует» — без JS", () => {
  test.use({ javaScriptEnabled: false });

  test("кейсы, зоны, дорога, клиенты и отзывы — в HTML; цифры не выдуманы", async ({ page }) => {
    await page.goto("/ru");
    const chapter = page.locator("#world");
    await expect(chapter.getByRole("heading", { name: "Этот мир существует." })).toBeVisible();
    await expect(chapter.locator("a[href$='/cases/evening-wedding']")).toBeVisible();
    for (const zone of ["Поле", "Шатёр", "Юрта", "Кухня и огонь"])
      await expect(chapter.getByText(zone, { exact: true })).toBeVisible();
    await expect(chapter.getByText("Вместимость уточняется.").first()).toBeVisible();
    // Ещё на фазенде: все места от заказчика; цифра — только подтверждённая (беседка, 60).
    for (const extra of [
      "Крытая беседка",
      "Беседка с камином",
      "Баня",
      "Домики для ночёвки",
      "Кино под открытым небом",
      "Конные прогулки",
      "Стрельба из лука",
      "Квадроциклы",
    ])
      await expect(chapter.getByText(extra, { exact: true })).toBeVisible();
    await expect(chapter.locator("[data-extra='gazebo']")).toContainText(/До\s60\sгостей/);
    await expect(chapter.locator("[data-extra='banya']")).not.toContainText(/\d/);
    await expect(chapter.getByText(/Время\sв\sпути\sуточняется/)).toBeVisible();
    await expect(chapter.getByRole("img", { name: /Схема/ })).toBeVisible();
    await expect(chapter.getByText("Логотипы клиентов появятся после согласования.")).toBeVisible();
    await expect(
      chapter.getByText("Отзывы появятся после согласования с клиентами."),
    ).toBeVisible();
    await expect(chapter.getByRole("link", { name: "Приехать на просмотр" })).toBeVisible();
  });
});
