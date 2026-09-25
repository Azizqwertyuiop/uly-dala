import { expect, test } from "@playwright/test";
import { allPaths, chapterIds, formatSlugs, locales } from "./pages";

test.describe("главная: все главы на трёх языках", () => {
  for (const locale of locales) {
    test(`/${locale}`, async ({ page }) => {
      await page.goto(`/${locale}`);

      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator('a[href="#main"]')).toHaveCount(1);
      await expect(page.locator("main#main")).toHaveCount(1);

      const sections = page.locator("section[data-chapter]");
      await expect(sections).toHaveCount(chapterIds.length);

      for (const [i, id] of chapterIds.entries()) {
        const section = sections.nth(i);
        await expect(section).toHaveAttribute("id", id);
        await expect(section).toHaveAttribute("data-chapter", id);
        await expect(section).toHaveAttribute("data-tone", /^(light|dark)$/);
        const labelledBy = await section.getAttribute("aria-labelledby");
        expect(labelledBy).toBe(`${id}-title`);
        await expect(page.locator(`#${labelledBy}`)).not.toBeEmpty();
      }

      for (const slug of formatSlugs) {
        await expect(page.locator(`#format-${slug}`)).toHaveCount(1);
      }
      await expect(page.locator("#brief")).toHaveCount(1);
      await expect(page.locator("footer#contacts")).toHaveCount(1);
    });
  }
});

test.describe("внутренние страницы на трёх языках", () => {
  for (const locale of locales) {
    for (const path of allPaths(locale).slice(1)) {
      test(path, async ({ page }) => {
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
        await expect(page.locator("main#main")).toHaveCount(1);
      });
    }
  }
});

test("своя 404 внутри языка", async ({ page }) => {
  const response = await page.goto("/ru/nichego-net");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Здесь пока ничего не поставлено.",
  );
});

test.describe("без JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("главная читается целиком, форматы — списком", async ({ page }) => {
    await page.goto("/ru");
    for (const id of chapterIds) {
      await expect(page.locator(`#${id}-title`)).toBeVisible();
    }
    await expect(page.getByRole("tablist")).toHaveCount(0);
    for (const slug of formatSlugs) {
      await expect(page.locator(`#format-${slug} h3`)).toBeVisible();
    }
    // Оглавление форматов ведёт к якорям.
    await page.locator('a[href="#format-kudalyk"]').click();
    await expect(page).toHaveURL(/#format-kudalyk$/);
  });

  test("HTML содержит полный текст без JS", async ({ request }) => {
    // Неразрывные пробелы от типографики приводим к обычным.
    const html = (await (await request.get("/ru")).text()).replace(/\u00a0|&nbsp;/g, " ");
    expect(html).toContain("Мы ставим мир.");
    expect(html).toContain("Шаңырақ был первым прожектором.");
    expect(html).toContain("Две семьи. Один дастархан.");
    expect(html).toContain("Свой огонь. Свой шеф.");
    expect(html).toContain("Этот мир существует.");
    expect(html).toContain("И снимаем его, не оставив следа.");
  });
});

test("табы форматов управляются с клавиатуры", async ({ page }) => {
  await page.goto("/ru");
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(formatSlugs.length);
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#format-conference")).toBeVisible();
  await expect(page.locator("#format-kudalyk")).toBeHidden();

  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#format-coffee-break")).toBeVisible();

  await page.keyboard.press("End");
  await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
});

test("каждое изображение имеет alt и размеры", async ({ page }) => {
  await page.goto("/ru");
  const images = page.locator("img");
  const count = await images.count();
  expect(count).toBeGreaterThan(5);
  for (let i = 0; i < count; i++) {
    const img = images.nth(i);
    expect((await img.getAttribute("alt"))?.length ?? 0).toBeGreaterThan(10);
    expect(await img.getAttribute("width")).toBeTruthy();
    expect(await img.getAttribute("height")).toBeTruthy();
  }
});

for (const width of [360, 768, 1280, 1920]) {
  test(`нет горизонтального скролла на ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/ru", "/kk/services/private-party", "/en/cases/evening-wedding"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}
