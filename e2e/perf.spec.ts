import { expect, test, type Page } from "@playwright/test";

/*
 * Производительность (CLAUDE.md, раздел 12) — правила, которые можно проверить в headless:
 * - рендер стоит в статике: сцены на экране нет (бриф, футер) — кадры не рисуются;
 * - неактивные главы не считают циклы: видео коня не декодируется, когда коня не видно;
 * - INP — e2e/inp.spec.ts (группа dom: без видеокарты, как у слабого телефона).
 * Цифры fps / GPU / LCP по главам — docs/performance.md (замеры на реальной видеокарте).
 */

type Stage = { idle: boolean; current: string | null; dawn: { decoding: boolean } };
const stage = (page: Page) =>
  page.evaluate(() => (window as unknown as { __stage: Stage }).__stage);

async function openStage(page: Page) {
  await page.goto("/ru?quality=high");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 20_000 });
}

test.describe("производительность", () => {
  test.setTimeout(120_000);

  test("статика: без сцены на экране рендер стоит, со сценой — идёт", async ({ page }) => {
    await openStage(page);
    await expect.poll(async () => (await stage(page)).idle).toBe(false);
    await page.evaluate(() =>
      document.querySelector("#brief")!.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await expect.poll(async () => (await stage(page)).idle, { timeout: 10_000 }).toBe(true);
    await page.evaluate(() => {
      const t = document.querySelector<HTMLElement>("[data-track='assembly']")!;
      window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY);
    });
    await expect.poll(async () => (await stage(page)).idle, { timeout: 10_000 }).toBe(false);
  });

  test("видео коня не декодируется: на главной-визитке коня в кадре нет", async ({ page }) => {
    await openStage(page);
    await page.waitForTimeout(3000);
    expect((await stage(page)).dawn.decoding).toBe(false);
  });
});
