import { expect, test } from "@playwright/test";

const locales = ["kk", "ru", "en"] as const;

for (const locale of locales) {
  test(`/${locale} открывается и отдаёт правильный lang`, async ({ page }) => {
    const response = await page.goto(`/${locale}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test(`/${locale} отдаёт содержимое в HTML без JavaScript`, async ({ request }) => {
    const response = await request.get(`/${locale}`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain(`<html lang="${locale}"`);
    expect(html).toContain("<h1>ULY DALA</h1>");
  });
}

test("корень / ведёт на русскую версию", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/ru$/);
});

test("неизвестный язык отдаёт 404", async ({ request }) => {
  const response = await request.get("/de");
  expect(response.status()).toBe(404);
});
