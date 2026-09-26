import { expect, test, type Page } from "@playwright/test";

/*
 * Глава 3 «День» (CLAUDE.md, раздел 2): шесть состояний одной сцены на дорожке 300vh.
 * Табы синхронизированы со скроллом, клик и стрелки прокручивают к состоянию; порядок —
 * из развилки; переходы — через завесу света и тумана; кудалык ощутимо спокойнее.
 * 3D в headless — программный WebGL; уровень задаётся явно (?quality=high), как в stage.spec.
 */

type Day = { p: number; state: string; index: number; veil: number; tempo: string };

const day = (page: Page) =>
  page.evaluate(() => (window as unknown as { __stage: { day: Day } }).__stage.day);
const camera = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __stage: { camera: { x: number; y: number; z: number } } }).__stage
        .camera,
  );

async function openStage(page: Page, path = "/ru?quality=high") {
  await page.goto(path);
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 15_000 });
}

/** Сцена «Дня» загружена и живёт (программный WebGL под нагрузкой — медленный, запас). */
async function waitDayReady(page: Page) {
  await expect.poll(async () => (await day(page)).state, { timeout: 40_000 }).not.toBe("");
}

/** Мгновенная прокрутка к прогрессу дорожки «Дня» p. */
async function scrollDay(page: Page, p: number) {
  await page.evaluate((p) => {
    const track = document.querySelector<HTMLElement>("[data-track='day']")!;
    const top = track.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top + (track.offsetHeight - window.innerHeight) * p);
  }, p);
}

const DEFAULT = [
  "Конференция",
  "Кофе-брейк",
  "Тимбилдинг",
  "Кудалык",
  "Свадьба",
  "Частный праздник",
];

test.describe("«День» — сцена и табы", () => {
  test.setTimeout(120_000);

  test("табы синхронизированы со скроллом: состояние сцены выбирает таб", async ({ page }) => {
    await openStage(page);
    const slugs = [
      "conference",
      "coffee-break",
      "team-building",
      "kudalyk",
      "wedding",
      "private-party",
    ];
    await scrollDay(page, 0.5 / 6);
    await waitDayReady(page);
    for (const k of [0, 3, 5, 1]) {
      await scrollDay(page, (k + 0.5) / 6);
      await expect(page.getByRole("tab", { selected: true })).toHaveText(DEFAULT[k]!, {
        timeout: 10_000,
      });
      await expect.poll(async () => (await day(page)).state, { timeout: 10_000 }).toBe(slugs[k]);
      await expect(page.locator(`#format-${slugs[k]}`)).toBeVisible();
    }
  });

  test("клик по табу и стрелки прокручивают к своему состоянию", async ({ page }) => {
    await openStage(page);
    await scrollDay(page, 0.5 / 6);
    await waitDayReady(page);
    await expect(page.getByRole("tab", { selected: true })).toHaveText("Конференция", {
      timeout: 10_000,
    });
    const before = await page.evaluate(() => window.scrollY);
    await page.getByRole("tab", { name: "Свадьба" }).click();
    await expect.poll(async () => (await day(page)).state, { timeout: 15_000 }).toBe("wedding");
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
    await expect(page.getByRole("tab", { selected: true })).toHaveText("Свадьба");

    // Клавиатура: фокус на активном табе, стрелка влево — предыдущий формат и его состояние.
    await page.getByRole("tab", { name: "Свадьба" }).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("tab", { name: "Кудалык" })).toBeFocused();
    await expect(page.getByRole("tab", { name: "Кудалык" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect.poll(async () => (await day(page)).state, { timeout: 15_000 }).toBe("kudalyk");
  });

  test("порядок из развилки: «Семейное торжество» — кудалык первым и в табах, и в сцене", async ({
    page,
  }) => {
    await openStage(page);
    await page
      .getByRole("navigation", { name: "Какое у вас событие?" })
      .getByRole("link", { name: "Семейное торжество" })
      .click();
    await expect(page.getByRole("tab").first()).toHaveText("Кудалык");
    await scrollDay(page, 0.5 / 6);
    await expect.poll(async () => (await day(page)).state, { timeout: 10_000 }).toBe("kudalyk");
    await expect(page.getByRole("tab", { selected: true })).toHaveText("Кудалык");
  });

  test("переходы — через завесу света и тумана на границах, в покое её нет", async ({ page }) => {
    await openStage(page);
    await scrollDay(page, 2 / 6);
    await waitDayReady(page);
    await expect.poll(async () => (await day(page)).veil, { timeout: 10_000 }).toBeGreaterThan(0.8);
    await scrollDay(page, 2.5 / 6);
    await expect.poll(async () => (await day(page)).veil, { timeout: 10_000 }).toBeLessThan(0.05);
  });

  test("кудалык ощутимо спокойнее при том же скролле", async ({ page }) => {
    test.setTimeout(180_000);
    await openStage(page);
    type P = { x: number; y: number; z: number };
    const dist = (a: P, b: P) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    /** Ждём, пока камера остановится (не зависит от частоты кадров программного WebGL). */
    const settle = async () => {
      let prev = await camera(page);
      await expect
        .poll(
          async () => {
            const c = await camera(page);
            const d = dist(prev, c);
            prev = c;
            return d;
          },
          { timeout: 60_000, intervals: [400] },
        )
        .toBeLessThan(0.002);
    };
    /**
     * Путь камеры (м) за одинаковый скролл через «стояние» на площадке: от 0,3 до 0,7 состояния.
     * Сравниваем путь, а не скорость: под нагрузкой кадров мало, а путь от этого не зависит.
     */
    const holdPath = async (k: number) => {
      await scrollDay(page, (k + 0.3) / 6);
      await settle();
      let prev = await camera(page);
      await page.evaluate(
        ({ from, to }) =>
          new Promise<void>((resolve) => {
            const track = document.querySelector<HTMLElement>("[data-track='day']")!;
            const top = track.getBoundingClientRect().top + window.scrollY;
            const run = track.offsetHeight - window.innerHeight;
            const t0 = performance.now();
            const step = () => {
              const u = Math.min(1, (performance.now() - t0) / 2000);
              window.scrollTo(0, top + run * (from + (to - from) * u));
              if (u < 1) requestAnimationFrame(step);
              else resolve();
            };
            requestAnimationFrame(step);
          }),
        { from: (k + 0.3) / 6, to: (k + 0.7) / 6 },
      );
      let path = 0;
      let still = 0;
      const t0 = Date.now();
      while (still < 4 && Date.now() - t0 < 60_000) {
        await page.waitForTimeout(150);
        const c = await camera(page);
        const d = dist(prev, c);
        path += d;
        still = d < 0.002 ? still + 1 : 0;
        prev = c;
      }
      return path;
    };
    await scrollDay(page, 0.3 / 6);
    await waitDayReady(page);
    const conference = await holdPath(0);
    const kudalyk = await holdPath(3);
    expect(await day(page).then((d) => d.tempo)).toBe("dayKudalyk");
    expect(conference).toBeGreaterThan(0.3);
    expect(kudalyk).toBeLessThan(conference / 1.4);
  });
});

test.describe("«День» — содержимое панелей", () => {
  test("фраза, 3 факта, страница формата, CTA и «Скачать презентацию» (PDF) в каждом формате", async ({
    page,
    request,
  }) => {
    await page.goto("/ru");
    for (const name of DEFAULT) {
      await page.getByRole("tab", { name }).click();
      const panel = page.getByRole("tabpanel", { name });
      await expect(panel.getByRole("listitem")).toHaveCount(3);
      await expect(panel.getByRole("link", { name: /^Обсудить/ })).toBeVisible();
      await expect(panel.getByRole("link", { name: /Подробнее о формате/ })).toBeVisible();
      const pdf = panel.getByRole("link", { name: /Скачать презентацию/ });
      await expect(pdf).toHaveAttribute("download", "");
      await expect(pdf).toHaveAttribute("href", "/assets/docs/uly-dala-presentation.pdf");
    }
    const response = await request.get("/assets/docs/uly-dala-presentation.pdf");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("кудалык: текст антиквой, проявление без сдвига", async ({ page }) => {
    await page.goto("/ru");
    // При загрузке панель не анимируется (текст виден сразу); анимация — при смене формата.
    await expect(page.getByRole("tab", { name: "Конференция" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      await page.locator("#format-conference").evaluate((el) => getComputedStyle(el).animationName),
    ).not.toContain("panel-in");
    await page.getByRole("tab", { name: "Кудалык" }).click();
    const panel = page.locator("#format-kudalyk");
    const phrase = panel.getByText("Две семьи. Один дастархан.");
    const heading = await page
      .getByRole("heading", { level: 1 })
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(await phrase.evaluate((el) => getComputedStyle(el).fontFamily)).toBe(heading);
    expect(await panel.evaluate((el) => getComputedStyle(el).animationName)).toContain(
      "panel-in-calm",
    );
    // Для сравнения — другие форматы появляются с подъёмом.
    await page.getByRole("tab", { name: "Свадьба" }).click();
    expect(
      await page.locator("#format-wedding").evaluate((el) => getComputedStyle(el).animationName),
    ).not.toContain("calm");
  });
});
