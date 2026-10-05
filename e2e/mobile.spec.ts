import { devices, expect, test, type Page, type TestInfo } from "@playwright/test";

/*
 * Адаптивность (CLAUDE.md, разделы 4, 6, 13): телефоны (портрет и альбом), планшет, десктоп.
 * - нет горизонтального скролла ни на одной ширине и ни в одной главе;
 * - CTA закреплённых экранов — в зоне большого пальца (нижние две трети экрана телефона);
 * - адресная строка (смена только высоты окна) не дёргает прогресс;
 * - fallback: видео-секвенции по скроллу, серебряная волна — в клипе «Рассвета»;
 * - скриншоты ключевых состояний — вложения отчёта (3D в headless программный — не сравниваем
 *   пиксели, а сохраняем кадры для глаз).
 */

const PHONE = { width: 390, height: 844 };
/** Адрес без хеша содержимого в имени (src/lib/assets/url.ts). */
const unhash = (u: string) => u.replace(/\.[0-9a-f]{10}(\.\w+)$/, "$1");
const SIZES = [
  { name: "360", width: 360, height: 780, mobile: true },
  { name: "390", ...PHONE, mobile: true },
  { name: "768", width: 768, height: 1024, mobile: true },
  { name: "1024", width: 1024, height: 768, mobile: true },
  { name: "1280", width: 1280, height: 800, mobile: false },
  { name: "1920", width: 1920, height: 1080, mobile: false },
  { name: "альбом", width: 844, height: 390, mobile: true },
] as const;

const TRACKS = ["assembly", "day", "fire", "world", "return"] as const;

/** Прокрутка к доле p дорожки главы; у «Дня» дорожки нет (фото-глава) — к доле самой главы. */
async function scrollTrack(page: Page, id: string, p: number) {
  await page.evaluate(
    ([id, p]) => {
      const t =
        document.querySelector<HTMLElement>(`[data-track='${id}']`) ?? document.getElementById(id)!;
      const top = t.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top + (t.offsetHeight - window.innerHeight) * Number(p));
    },
    [id, String(p)] as const,
  );
}

async function shot(page: Page, info: TestInfo, name: string) {
  await info.attach(name, { body: await page.screenshot(), contentType: "image/png" });
}

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("адаптивность: нет горизонтального скролла, ключевые состояния", () => {
  test.setTimeout(180_000);

  for (const size of SIZES) {
    test(`${size.name}: ${size.width}×${size.height}`, async ({ browser }, info) => {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.mobile,
        hasTouch: size.mobile,
      });
      const page = await context.newPage();
      await page.goto("/ru?quality=medium");
      await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", {
        timeout: 20_000,
      });
      expect(await overflow(page)).toBe(0);
      await shot(page, info, `${size.name}-рассвет`);
      for (const id of TRACKS) {
        await scrollTrack(page, id, 0.5);
        await page.waitForTimeout(600);
        expect(await overflow(page), id).toBe(0);
        await shot(page, info, `${size.name}-${id}`);
      }
      await page.locator("#brief").scrollIntoViewIfNeeded();
      expect(await overflow(page)).toBe(0);
      await shot(page, info, `${size.name}-бриф`);
      await context.close();
    });
  }
});

test.describe("телефон: одной рукой", () => {
  test.setTimeout(120_000);
  test.use({
    viewport: PHONE,
    userAgent: devices["iPhone 13"].userAgent,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });

  /** CTA — в нижних двух третях экрана и целиком на экране. */
  async function expectThumb(page: Page, name: RegExp, scope = page.locator("main")) {
    const cta = scope.getByRole("link", { name }).filter({ visible: true }).first();
    await expect(cta).toBeVisible();
    const box = (await cta.boundingBox())!;
    expect(box.y, `${name}: сверху`).toBeGreaterThanOrEqual(PHONE.height / 3);
    expect(box.y + box.height, `${name}: снизу`).toBeLessThanOrEqual(PHONE.height);
  }

  test("CTA закреплённых экранов — в зоне большого пальца", async ({ page }) => {
    await page.goto("/ru?quality=medium");
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", {
      timeout: 20_000,
    });
    await expectThumb(page, /^Обсудить событие$/, page.locator("[data-hero-text]"));
    // «День» — обычная глава (фото), не закреплённый экран: CTA в потоке текста.
    await scrollTrack(page, "fire", 0.9);
    await page.waitForTimeout(800);
    await expectThumb(page, /^Запросить меню$/);
    await scrollTrack(page, "world", 0.4);
    await page.waitForTimeout(800);
    await expectThumb(page, /^Приехать на просмотр$/, page.locator("[data-world-stage]"));
  });

  test("адресная строка не дёргает прогресс: высота — из svh, ресайз без смены ширины — без перемера", async ({
    page,
  }) => {
    // Настоящая адресная строка меняет innerHeight, но не svh. В эмуляции смена размера окна
    // меняет и svh — поэтому проверяем механизм: высота экрана для прогресса — пробник 100svh,
    // а событие resize с той же шириной границы глав не пересчитывает.
    await page.goto("/ru?quality=medium");
    await scrollTrack(page, "fire", 0.5);
    const read = () =>
      page.evaluate(() => {
        const p = (
          window as unknown as {
            __progress?: { track: number; chapterId: string | null; viewportHeight: number };
          }
        ).__progress;
        const probe = document.getElementById("svh-probe")?.getBoundingClientRect().height ?? 0;
        return {
          track: p?.track ?? 0,
          chapter: p?.chapterId ?? null,
          vh: p?.viewportHeight,
          probe,
        };
      });
    await expect.poll(async () => (await read()).chapter, { timeout: 10_000 }).toBe("fire");
    const before = await read();
    expect(before.vh).toBe(before.probe);
    // Адресная строка спряталась: браузер шлёт resize, ширина та же.
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await page.waitForTimeout(300);
    const after = await read();
    expect(after.chapter).toBe("fire");
    expect(Math.abs(after.track - before.track)).toBeLessThan(0.005);
  });

  test("касание и свайп — ветер (скорость указателя), камера за пальцем не поворачивается", async ({
    page,
  }) => {
    await page.goto("/ru?quality=medium");
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", {
      timeout: 20_000,
    });
    const yaw0 = await page.evaluate(
      () => (window as unknown as { __stage: { camera: { yaw: number } } }).__stage.camera.yaw,
    );
    // Свайп: серия касаний (touchmove) — как прокрутка пальцем.
    const cdp = await page.context().newCDPSession(page);
    const point = (x: number, y: number) => [{ x, y, id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: point(200, 700),
    });
    let speed = 0;
    for (let i = 1; i <= 8; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: point(200 - i * 10, 700 - i * 40),
      });
      await page.waitForTimeout(16);
      speed = Math.max(
        speed,
        await page.evaluate(
          () => (window as unknown as { __input: { speed: number } }).__input.speed,
        ),
      );
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    expect(speed).toBeGreaterThan(0.5);
    const yaw1 = await page.evaluate(
      () => (window as unknown as { __stage: { camera: { yaw: number } } }).__stage.camera.yaw,
    );
    expect(Math.abs(yaw1 - yaw0)).toBeLessThan(0.002);
  });
});

test.describe("fallback: видео-секвенции по скроллу", () => {
  test.setTimeout(90_000);

  for (const [name, viewport, suffix] of [
    ["телефон", PHONE, ".portrait.mp4"],
    ["десктоп", { width: 1280, height: 800 }, "dawn.mp4"],
  ] as const) {
    test(`${name}: клип «Рассвета» с волной по времени, дальше — скролл`, async ({
      browser,
    }, info) => {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const requests: string[] = [];
      page.on("request", (r) => {
        if (r.url().includes("/assets/video/fallback/")) requests.push(unhash(r.url()));
      });
      await page.goto("/ru?quality=fallback");
      const dawn = page.locator("video[data-fallback-clip='dawn']");
      await expect(dawn).toHaveAttribute("data-ready", "", { timeout: 20_000 });
      expect(requests.some((u) => u.endsWith(suffix))).toBe(true);
      // Интро идёт по времени — без автоплея (перемотка), волна вшита в клип.
      const t0 = await dawn.evaluate((v: HTMLVideoElement) => v.currentTime);
      await page.waitForTimeout(1500);
      const t1 = await dawn.evaluate((v: HTMLVideoElement) => v.currentTime);
      expect(t1).toBeGreaterThan(t0);
      await shot(page, info, `fallback-${name}-рассвет`);
      // Дальние главы не грузятся заранее (за экран до показа).
      expect(requests.some((u) => u.includes("/return"))).toBe(false);
      // Скролл ведёт клип «Огня».
      // Кадр «Огня» входит в экран снизу — начало клипа.
      await page.evaluate(() =>
        document
          .querySelector("#fire [class*='fireFrame']")!
          .scrollIntoView({ block: "end", behavior: "instant" }),
      );
      const fire = page.locator("video[data-fallback-clip='fire']");
      await expect(fire).toHaveAttribute("data-ready", "", { timeout: 20_000 });
      const a = await fire.evaluate((v: HTMLVideoElement) => v.currentTime);
      await page.mouse.wheel(0, 300);
      await expect
        .poll(() => fire.evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 5_000 })
        .toBeGreaterThan(a);
      expect(await overflow(page)).toBe(0);
      await context.close();
    });
  }

  test("reduced motion — статичные кадры, клипы не грузятся", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    const requests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/assets/video/fallback/")) requests.push(unhash(r.url()));
    });
    await page.goto("/ru?quality=fallback");
    await page.waitForTimeout(2500);
    expect(await page.locator("video[data-fallback-clip]").count()).toBe(0);
    expect(requests).toEqual([]);
    await context.close();
  });
});

test.describe("встроенные браузеры и iOS", () => {
  test.setTimeout(150_000);
  const iphone = devices["iPhone 13"].userAgent;

  for (const [name, ua] of [
    ["WhatsApp (iPhone)", `${iphone} WhatsApp/2.24.1`],
    [
      "Telegram (Android)",
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/140.0 Mobile Telegram-Android/11.0",
    ],
    ["Instagram (iPhone)", `${iphone} Instagram 320.0.0.0`],
  ] as const) {
    test(`${name}: не high; контент и бриф на месте`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: PHONE,
        userAgent: ua,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      await page.goto("/ru");
      await expect(page.locator("html")).toHaveAttribute("data-quality", /medium|fallback/, {
        timeout: 15_000,
      });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("#brief form")).toBeAttached();
      expect(await overflow(page)).toBe(0);
      await context.close();
    });
  }

  test("автоплей запрещён — конь постером, без ошибок", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: PHONE,
      userAgent: iphone,
      isMobile: true,
      hasTouch: true,
    });
    await context.addInitScript(() => {
      HTMLMediaElement.prototype.play = function () {
        return Promise.reject(new DOMException("autoplay", "NotAllowedError"));
      };
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto("/ru?quality=medium");
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 20_000 });
    await page.waitForTimeout(1500);
    expect(
      await page.evaluate(
        () => (window as unknown as { __stage: { dawn: { video: boolean } } }).__stage.dawn.video,
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
    await context.close();
  });

  test("iPhone: память GPU ≤ 300 МБ по всему сайту", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: PHONE,
      userAgent: iphone,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto("/ru?quality=medium");
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 20_000 });
    let peak = 0;
    for (const id of TRACKS) {
      await scrollTrack(page, id, 0.6);
      await page.waitForTimeout(1500);
      peak = Math.max(
        peak,
        await page.evaluate(
          () => (window as unknown as { __stage: { memoryMb: number } }).__stage.memoryMb,
        ),
      );
    }
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(300);
    await context.close();
  });
});
