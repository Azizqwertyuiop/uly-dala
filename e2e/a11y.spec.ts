import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { allPaths, locales } from "./pages";

/*
 * Автоматическая проверка доступности (WCAG 2.2 AA — CLAUDE.md, раздел 10) на всех страницах.
 * Ловит то же, что Lighthouse Accessibility: контраст, alt, заголовки, ориентиры, ARIA.
 */
const notFoundPaths = ["/ru/nichego-net", "/de"];

for (const locale of locales) {
  for (const path of [...allPaths(locale), ...(locale === "ru" ? notFoundPaths : [])]) {
    test(`axe: ${path}`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      const summary = results.violations.map(
        (v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
      );
      expect(summary).toEqual([]);
    });
  }
}
