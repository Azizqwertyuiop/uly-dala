import { expect, test } from "@playwright/test";

/*
 * Автоопределение уровня качества без видеокарты (CLAUDE.md, раздел 6).
 * Отдельный файл: программный WebGL задан явно — и при E2E_GPU=1 (playwright.config.ts).
 */
test.use({ launchOptions: { args: ["--use-angle=swiftshader"] } });

test("программный WebGL (headless) → fallback: Canvas не монтируется", async ({ page }) => {
  await page.goto("/ru");
  await expect(page.locator("html")).toHaveAttribute("data-quality", "fallback", {
    timeout: 10_000,
  });
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "off");
  await expect(page.locator("[data-canvas-root] canvas")).toHaveCount(0);
});
