import { expect, test, type Page } from "@playwright/test";
import { chapterIds } from "../src/components/sections/chapters";

/*
 * Глава 6 «Снова рассвет» (CLAUDE.md, раздел 2), переходы (раздел 5) и звук (раздел 8).
 * - финал: фазенда уходит в ночную степь, звёзды гаснут, трава поднимается; последний кадр —
 *   первый кадр сайта (петля: та же камера, та же оптика, без коня);
 * - весь сайт от прелоадера до отправки брифа — без разрывов: камера непрерывна, крен 0;
 * - звук не играет без действия: ни AudioContext, ни файлов до нажатия «Звук».
 * 3D в headless — программный WebGL; уровень задаётся явно (?quality=high).
 */

type Camera = {
  pose: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
  fov: number;
};
type Finale = {
  p: number;
  stars: number;
  predawn: number;
  pressed: number;
  handoff: number;
  active: boolean;
};
type Stage = { camera: Camera; return: Finale; current: string | null; loaded: string[] };
type Sound = {
  snapshot: { state: string; context: string; loaded: string[]; gusts: number } | null;
};

const stage = (page: Page) =>
  page.evaluate(() => (window as unknown as { __stage: Stage }).__stage);
const sound = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sound?: Sound }).__sound?.snapshot ?? null);

async function openStage(page: Page) {
  await page.goto("/ru?quality=high");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 15_000 });
}

async function scrollTrack(page: Page, id: string, p: number) {
  await page.evaluate(
    ([id, p]) => {
      const track = document.querySelector<HTMLElement>(`[data-track='${id}']`)!;
      const top = track.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + (track.offsetHeight - window.innerHeight) * Number(p));
    },
    [id, String(p)] as const,
  );
}

const audioRequests = (page: Page) => {
  const urls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/assets/audio/")) urls.push(r.url());
  });
  return urls;
};

test.describe("«Снова рассвет»", () => {
  test.setTimeout(150_000);

  test("фазенда уходит в ночную степь; звёзды гаснут, трава поднимается; петля", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openStage(page);
    const first = (await stage(page)).camera;

    // Хвост фазенды: под ней уже степь финала (ночь, звёзды).
    await scrollTrack(page, "world", 0.5);
    await expect
      .poll(async () => (await stage(page)).loaded, { timeout: 40_000 })
      .toEqual(expect.arrayContaining(["dawn", "return"]));
    await scrollTrack(page, "world", 1);
    await expect
      .poll(async () => (await stage(page)).return.handoff, { timeout: 10_000 })
      .toBeGreaterThan(0.95);
    const night = (await stage(page)).return;
    expect(night.active).toBe(true);
    expect(night.stars).toBe(1);
    expect(night.pressed).toBe(1);

    // Финал целиком: звёзд нет, трава поднялась.
    await scrollTrack(page, "return", 1);
    await expect
      .poll(async () => (await stage(page)).return.p, { timeout: 10_000 })
      .toBeGreaterThan(0.98);
    const end = await stage(page);
    expect(end.current).toBe("return");
    expect(end.return.stars).toBe(0);
    expect(end.return.predawn).toBe(0);
    expect(end.return.pressed).toBeLessThan(0.01);
    // Петля: та же высота, оптика, направление взгляда, что у первого кадра; крен 0.
    await expect
      .poll(async () => Math.abs((await stage(page)).camera.fov - first.fov), { timeout: 10_000 })
      .toBeLessThan(0.05);
    const cam = (await stage(page)).camera;
    expect(Math.abs(cam.y - first.y)).toBeLessThan(0.1);
    expect(Math.abs(cam.yaw - first.yaw)).toBeLessThan(0.01);
    expect(Math.abs(cam.pitch - first.pitch)).toBeLessThan(0.01);
    expect(cam.roll).toBe(0);
    // Фраза — в DOM и проявлена светом; под ней бриф.
    const phrase = page.getByRole("heading", {
      name: "Мы ставим мир. И снимаем его, не оставив следа.",
    });
    await expect(phrase).toBeVisible();
    await expect(phrase).toHaveAttribute("data-reveal-state", /run|done/);
    await expect(page.locator("#brief form")).toBeVisible();
  });

  test("весь сайт — от прелоадера до брифа без разрывов: камера непрерывна, крен 0", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await openStage(page);
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const brief = await page.evaluate(
      () => document.querySelector<HTMLElement>("#brief")!.getBoundingClientRect().top + scrollY,
    );
    const end = Math.min(max, brief);
    const STEPS = 90;
    let prev: Camera | null = null;
    let biggest = 0;
    const seen = new Set<string>();
    for (let i = 0; i <= STEPS; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), (end * i) / STEPS);
      await page.waitForTimeout(140);
      const s = await stage(page);
      if (s.current) seen.add(s.current);
      expect(s.camera.roll).toBe(0);
      // На земле (≤ 1,8 м, на общем пути). Вид сверху «Огня» — dolly zoom: камера уходит вверх
      // на сотни метров при сужении объектива, кадр при этом непрерывен — его здесь не меряем.
      const grounded = (c: Camera) => c.pose === 0 && c.y <= 1.81;
      if (prev && grounded(prev) && grounded(s.camera))
        biggest = Math.max(
          biggest,
          Math.hypot(s.camera.x - prev.x, s.camera.y - prev.y, s.camera.z - prev.z),
        );
      prev = s.camera;
    }
    // Все главы пройдены, камера ни разу не «прыгнула» (шаг скролла ≈ 1/90 сайта; глава — 60 м).
    expect([...seen]).toEqual([...chapterIds]);
    expect(biggest).toBeLessThan(25);
    expect(errors).toEqual([]);

    // Бриф: отправка до экрана успеха.
    const form = page.locator("#brief");
    await form.getByLabel(/Как\s+вас\s+зовут/).fill(`Петля ${Date.now()}`);
    await form.getByLabel(/Ваш\s+номер\s+телефона/).fill("7011234567");
    await form.getByLabel(/согласен\s+на\s+обработку/).check();
    await form.getByRole("button", { name: "Отправить бриф" }).click();
    await expect(page.locator("[data-brief-result='success']").first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("звук", () => {
  test.setTimeout(90_000);

  test("без действия не играет: нет AudioContext и файлов; включение — файлы, кроссфейд, порыв", async ({
    page,
  }) => {
    const audio = audioRequests(page);
    await page.addInitScript(() => {
      const w = window as unknown as { __audioContexts: number; AudioContext: typeof AudioContext };
      w.__audioContexts = 0;
      const Original = w.AudioContext;
      w.AudioContext = class extends Original {
        constructor(...args: ConstructorParameters<typeof AudioContext>) {
          super(...args);
          w.__audioContexts++;
        }
      };
    });
    await page.goto("/ru");
    // Скролл, движение мыши — не действие для звука.
    await page.mouse.move(300, 300);
    await page.mouse.move(700, 500, { steps: 10 });
    await page.evaluate(() => window.scrollTo(0, innerHeight * 3));
    await page.waitForTimeout(1500);
    expect(
      await page.evaluate(() => (window as unknown as { __audioContexts: number }).__audioContexts),
    ).toBe(0);
    expect(audio).toEqual([]);
    expect(await sound(page)).toBeNull();

    // Включение из меню — только теперь контекст и файлы.
    await page.locator('header button[aria-haspopup="dialog"]').click();
    const toggle = page.getByRole("dialog").getByRole("button", { name: /Звук/ });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await sound(page))?.state, { timeout: 15_000 }).toBe("on");
    expect(
      await page.evaluate(() => (window as unknown as { __audioContexts: number }).__audioContexts),
    ).toBe(1);
    expect((await sound(page))!.context).toBe("running");
    expect(
      new Set(audio.map((u) => u.replace(/^.*\//, "").replace(/\.[0-9a-f]{10}(\.\w+)$/, "$1"))),
    ).toEqual(new Set(["wind.m4a", "grass.m4a", "embers.m4a", "night.m4a", "gust.m4a"]));

    // Выключение — затухание и остановка вывода.
    await toggle.click();
    await expect.poll(async () => (await sound(page))?.state).toBe("off");
    await expect
      .poll(async () => (await sound(page))?.context, { timeout: 5_000 })
      .toBe("suspended");
  });

  test("порыв при отправке брифа — только при включённом звуке", async ({ page }) => {
    await page.goto("/ru");
    await page.locator('header button[aria-haspopup="dialog"]').click();
    await page.getByRole("dialog").getByRole("button", { name: /Звук/ }).click();
    await expect.poll(async () => (await sound(page))?.state, { timeout: 15_000 }).toBe("on");
    await page.keyboard.press("Escape");
    const form = page.locator("#brief");
    await form.getByLabel(/Как\s+вас\s+зовут/).fill(`Порыв ${Date.now()}`);
    await form.getByLabel(/Ваш\s+номер\s+телефона/).fill("7011234567");
    await form.getByLabel(/согласен\s+на\s+обработку/).check();
    await form.getByRole("button", { name: "Отправить бриф" }).click();
    await expect(page.locator("[data-brief-result='success']").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect.poll(async () => (await sound(page))?.gusts).toBe(1);
  });
});
