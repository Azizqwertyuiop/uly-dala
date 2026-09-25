import { expect, test } from "@playwright/test";

/*
 * Критерии шага 8: видео с альфой без ореолов, тёмный градиент без полос на 8-битном выходе.
 * В Chromium проверяется VP9 + alpha; HEVC + alpha — в Safari, та же страница /ru/render-test.
 */
type Result = {
  codec: string;
  halo: Record<"light" | "dark" | "naive", { edgePixels: number; bad: number; maxDiff: number }>;
  banding: Record<"dithered" | "plain", { maxStep: number; maxRun: number }>;
};

test("видео с альфой без ореолов и градиент без полос", async ({ page }) => {
  await page.goto("/ru/render-test");
  await page.waitForFunction(
    () => (window as unknown as { __renderTest?: unknown }).__renderTest,
    null,
    {
      timeout: 30_000,
    },
  );
  const r = await page.evaluate(() => (window as unknown as { __renderTest: Result }).__renderTest);
  expect(r.codec).toBe("vp9");

  // Край коня и полупрозрачный пар: тысячи пикселей, отклонение от правильного наложения ≤ 6/255.
  for (const bg of ["light", "dark"] as const) {
    expect(r.halo[bg].edgePixels).toBeGreaterThan(1000);
    expect(r.halo[bg].bad, `ореол на фоне ${bg}`).toBe(0);
    expect(r.halo[bg].maxDiff).toBeLessThanOrEqual(6);
  }
  // Контроль чувствительности: неправильный (непредумноженный) путь ореол даёт.
  expect(r.halo.naive.maxDiff).toBeGreaterThan(20);

  // Без дизеринга — ступени в целый уровень и длинные полосы; с синим шумом — плавно.
  expect(r.banding.plain.maxStep).toBeGreaterThanOrEqual(0.9);
  expect(r.banding.plain.maxRun).toBeGreaterThan(20);
  expect(r.banding.dithered.maxStep).toBeLessThan(0.35);
  expect(r.banding.dithered.maxRun).toBeLessThan(r.banding.plain.maxRun / 2);
});
