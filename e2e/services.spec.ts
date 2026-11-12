import { expect, test } from "@playwright/test";

/*
 * Услуги на любой площадке (решение заказчика 16.10.2026): кейтеринг, аренда техники, фотобудка.
 * Карточки «Что мы делаем» на главной → страницы /services/<slug> → бриф с типом заявки.
 */

test("главная: девять карточек «Что мы делаем» ведут на страницы услуг", async ({ page }) => {
  await page.goto("/ru?quality=fallback");
  const cards = page.locator("#services li a");
  await expect(cards).toHaveCount(9);
  for (const slug of ["conference", "team-building", "catering", "equipment-rental", "photo-booth"])
    await expect(page.locator(`#services a[href="/ru/services/${slug}"]`)).toHaveCount(1);
  await page.locator('#services a[href="/ru/services/equipment-rental"]').click();
  await expect(page).toHaveURL(/\/ru\/services\/equipment-rental$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Аренда техники");
  for (const item of ["LED-экраны", "Кофемашины", "Фотобудка"])
    await expect(page.getByRole("listitem").filter({ hasText: item }).first()).toBeVisible();
});

for (const [slug, cta, label] of [
  ["catering", "Обсудить кейтеринг", "Кейтеринг"],
  ["equipment-rental", "Запросить технику", "Аренда техники"],
  ["photo-booth", "Забронировать фотобудку", "Аренда техники"],
] as const) {
  test(`${slug}: CTA открывает бриф с типом заявки «${label}»`, async ({ page }) => {
    await page.goto(`/ru/services/${slug}`);
    await page.getByRole("link", { name: cta }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio", { name: label })).toBeChecked();
  });
}

test("меню: страницы услуг рядом с форматами", async ({ page }) => {
  await page.goto("/ru");
  await page.locator('header button[aria-haspopup="dialog"]').click();
  const menu = page.getByRole("dialog");
  for (const name of ["Кейтеринг", "Аренда техники", "Фотобудка"])
    await expect(menu.getByRole("link", { name, exact: true })).toBeVisible();
});
