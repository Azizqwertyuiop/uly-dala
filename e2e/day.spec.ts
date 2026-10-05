import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/*
 * Глава 3 «День» (CLAUDE.md, раздел 2): шесть форматов — фото событий, без 3D.
 * Обычная глава (не закреплённая): формат меняют клик, стрелки, свайп по фото — не скролл;
 * порядок — из развилки; смена фото — проявление светом, у кудалыка ×1.6 медленнее.
 * Пока снимка формата нет — пустой кадр и честная подпись «Фото события — скоро».
 */

type Stage = { idle: boolean; loaded: string[]; current: string | null };
const stage = (page: Page) =>
  page.evaluate(() => (window as unknown as { __stage: Stage }).__stage);

const DEFAULT = [
  "Конференция",
  "Кофе-брейк",
  "Тимбилдинг",
  "Кудалык",
  "Свадьба",
  "Частный праздник",
];

/** Прокрутить к главе и дождаться, пока страница встанет (плавная прокрутка на десктопе). */
async function toDay(page: Page) {
  await page.evaluate(() => {
    const t = document.getElementById("day")!;
    window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY);
  });
  let last = -1;
  await expect
    .poll(async () => {
      const y = await page.evaluate(() => window.scrollY);
      const still = y === last;
      last = y;
      return still;
    })
    .toBe(true);
}

const selected = (page: Page) => page.locator("#day [role=tab][aria-selected=true]");

test.describe("«День» — фото и табы", () => {
  test("глава не закреплена и без 3D: холст в «Дне» не рисует, сцена «Дня» не грузится", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto("/ru?quality=high");
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 20_000 });
    await expect(page.locator("[data-track='day']")).toHaveCount(0);
    const { h, vh } = await page.evaluate(() => ({
      h: document.getElementById("day")!.offsetHeight,
      vh: window.innerHeight,
    }));
    // Вместо дорожки 300vh — обычная глава: около экрана.
    expect(h).toBeLessThan(vh * 1.6);
    await toDay(page);
    await expect.poll(async () => (await stage(page)).current, { timeout: 10_000 }).toBe("day");
    await expect.poll(async () => (await stage(page)).idle, { timeout: 10_000 }).toBe(true);
    expect((await stage(page)).loaded).not.toContain("day");
  });

  test("клик и стрелки меняют формат; скролл страницы не двигается и формат не меняет", async ({
    page,
  }) => {
    await page.goto("/ru?quality=fallback");
    await toDay(page);
    await expect(page.getByRole("tab")).toHaveText(DEFAULT);
    await expect(selected(page)).toHaveText("Конференция");
    const y = await page.evaluate(() => window.scrollY);
    await page.getByRole("tab", { name: "Свадьба" }).click();
    await expect(selected(page)).toHaveText("Свадьба");
    await expect(page.getByRole("tabpanel", { name: "Свадьба" })).toBeVisible();
    expect(await page.evaluate(() => window.scrollY)).toBe(y);
    await page.keyboard.press("ArrowRight");
    await expect(selected(page)).toHaveText("Частный праздник");
    await expect(selected(page)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(selected(page)).toHaveText("Конференция");
    await page.keyboard.press("End");
    await expect(selected(page)).toHaveText("Частный праздник");
    // Прокрутка внутри главы формат не меняет.
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(500);
    await expect(selected(page)).toHaveText("Частный праздник");
  });

  test("свайп по фото — соседний формат", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      locale: "ru-RU",
    });
    const page = await context.newPage();
    await page.goto("/ru?quality=fallback");
    await toDay(page);
    const photo = page.locator("#format-conference [class*=photo]");
    await photo.scrollIntoViewIfNeeded();
    const box = (await photo.boundingBox())!;
    const swipe = async (dx: number) => {
      const y = box.y + box.height / 2;
      const x = box.x + box.width / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y + 4, { steps: 6 });
      await page.mouse.up();
    };
    await swipe(-140);
    await expect(selected(page)).toHaveText("Кофе-брейк");
    await page.locator("#format-coffee-break [class*=photo]").scrollIntoViewIfNeeded();
    const box2 = (await page.locator("#format-coffee-break [class*=photo]").boundingBox())!;
    await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
    await page.mouse.down();
    await page.mouse.move(box2.x + box2.width / 2 + 140, box2.y + box2.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(selected(page)).toHaveText("Конференция");
    // Полоса табов — внутри себя, страница вбок не прокручивается.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await context.close();
  });

  test("порядок из развилки: «Семейное торжество» — семейные форматы первыми, выбран первый", async ({
    page,
  }) => {
    await page.goto("/ru?quality=fallback");
    await page.getByRole("tab", { name: "Свадьба" }).click();
    await page.locator("#assembly").getByRole("link", { name: "Семейное торжество" }).click();
    await expect(page.getByRole("tab")).toHaveText([
      "Кудалык",
      "Свадьба",
      "Частный праздник",
      "Конференция",
      "Кофе-брейк",
      "Тимбилдинг",
    ]);
    await expect(selected(page)).toHaveText("Кудалык");
  });

  // Какие форматы уже со снимком — тот же список, что у сайта (scripts/optimize-photos.mjs).
  const photos = JSON.parse(readFileSync("src/content/day-photos.json", "utf8")) as Record<
    string,
    number[]
  >;
  const TITLES: Record<string, string> = {
    conference: "Конференция",
    "coffee-break": "Кофе-брейк",
    "team-building": "Тимбилдинг",
    kudalyk: "Кудалык",
    wedding: "Свадьба",
    "private-party": "Частный праздник",
  };
  const withPhoto = Object.keys(TITLES).filter((slug) => photos[slug]?.length);
  const pending = Object.keys(TITLES).filter((slug) => !photos[slug]?.length);

  test("пока снимка нет — пустой кадр с подписью, описание кадра честное", async ({ page }) => {
    test.skip(pending.length === 0, "у всех форматов уже есть снимки");
    const slug = pending[0]!;
    await page.goto("/ru?quality=fallback");
    await page.getByRole("tab", { name: TITLES[slug] }).click();
    const panel = page.locator(`#format-${slug}`);
    await expect(panel.getByText("Фото события — скоро.")).toBeVisible();
    const img = panel.locator("img");
    await expect(img).toHaveAttribute(
      "alt",
      `${TITLES[slug]}: фото события появится после съёмки.`,
    );
    await expect(img).toHaveAttribute(
      "src",
      new RegExp(`/assets/placeholders/format-${slug}\\.[0-9a-f]{10}\\.svg$`),
    );
  });

  test("со снимком — фото нужного размера, без подписи-заглушки", async ({ page, request }) => {
    test.skip(withPhoto.length === 0, "снимков ещё нет");
    const slug = withPhoto[0]!;
    await page.goto("/ru?quality=fallback");
    await page.getByRole("tab", { name: TITLES[slug] }).click();
    const panel = page.locator(`#format-${slug}`);
    await expect(panel.getByText("Фото события — скоро.")).toHaveCount(0);
    const img = panel.locator("img");
    const srcset = (await img.getAttribute("srcset"))!;
    for (const w of photos[slug]!)
      expect(srcset).toMatch(
        new RegExp(`/assets/photos/day/${slug}-${w}\\.[0-9a-f]{10}\\.jpg ${w}w`),
      );
    expect(await img.getAttribute("alt")).not.toContain("после съёмки");
    // Снимок загрузился и показан (не битая ссылка).
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    const file = await request.get((await img.getAttribute("src"))!);
    expect(file.headers()["content-type"]).toBe("image/jpeg");
  });

  test("смена фото — проявление светом; у кудалыка в 1,6 раза медленнее", async ({ page }) => {
    await page.goto("/ru?quality=fallback");
    const duration = (slug: string) =>
      page
        .locator(`#format-${slug} [class*=photo] img`)
        .evaluate((el) => parseFloat(getComputedStyle(el.closest("picture")!).animationDuration));
    await page.getByRole("tab", { name: "Свадьба" }).click();
    const wedding = await duration("wedding");
    await page.getByRole("tab", { name: "Кудалык" }).click();
    const kudalyk = await duration("kudalyk");
    expect(wedding).toBeGreaterThan(0);
    expect(kudalyk / wedding).toBeCloseTo(1.6, 1);
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
