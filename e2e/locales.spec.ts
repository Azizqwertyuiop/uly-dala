import { expect, test } from "@playwright/test";
import { contentLanguage } from "../src/content/messages";
import { locales } from "./pages";

for (const locale of locales) {
  test(`/${locale} открывается и отдаёт правильный lang`, async ({ page }) => {
    const response = await page.goto(`/${locale}`);
    expect(response?.status()).toBe(200);
    // lang — язык текста: на /kk русский, пока копирайтер не дописал казахские тексты (WCAG 3.1.1).
    await expect(page.locator("html")).toHaveAttribute("lang", contentLanguage(locale));
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });
}

test("корень / — русская версия без перенаправления (раздел 11)", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/ru$/);
});

test("неизвестный язык отдаёт свою 404", async ({ page }) => {
  const response = await page.goto("/de");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Здесь пока ничего не поставлено.",
  );
  await expect(page.locator('a[hreflang="kk"]')).toHaveAttribute("href", "/kk");
});
