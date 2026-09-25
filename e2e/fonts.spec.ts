import { expect, test } from "@playwright/test";
import { inUnicodeRange, woff2Codepoints } from "./support/woff2-cmap";

/*
 * Проверка шрифтов (CLAUDE.md, раздел 4): каждая казахская буква должна быть в самом файле
 * шрифта каждого начертания — иначе браузер молча подставит системный шрифт.
 */

const KAZAKH = [..."ӘҒҚҢӨҰҮҺІәғқңөұүһі"];

interface Face {
  family: string;
  style: string;
  unicodeRange: string;
  urls: string[];
}

test("все казахские глифы есть в файлах шрифтов каждого начертания", async ({ page, request }) => {
  await page.goto("/ru/type-test");
  await page.evaluate(() => document.fonts.ready);

  const { faces, used } = await page.evaluate(() => {
    const faces: Face[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      for (const rule of Array.from(sheet.cssRules)) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const src = rule.style.getPropertyValue("src");
        const urls = [...src.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(
          (m) => new URL(m[1]!, sheet.href ?? location.href).href,
        );
        faces.push({
          family: rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim(),
          style: rule.style.getPropertyValue("font-style") || "normal",
          unicodeRange: rule.style.getPropertyValue("unicode-range"),
          urls,
        });
      }
    }
    // Какие семейства и начертания реально используются образцами на странице.
    const used = new Map<string, { family: string; style: string }>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-font]"))) {
      const computed = getComputedStyle(el);
      const family = computed.fontFamily.split(",")[0]!.replace(/["']/g, "").trim();
      const style = computed.fontStyle;
      used.set(`${family}|${style}`, { family, style });
    }
    return { faces, used: [...used.values()] };
  });

  // Два семейства × два начертания: антиква прямая/курсив, гротеск прямой/курсив.
  expect(used).toHaveLength(4);

  const cache = new Map<string, Set<number>>();
  const codepointsOf = async (url: string) => {
    if (!cache.has(url)) {
      const response = await request.get(url);
      expect(response.ok(), url).toBe(true);
      cache.set(url, woff2Codepoints(new Uint8Array(await response.body())));
    }
    return cache.get(url)!;
  };

  const missing: string[] = [];
  for (const { family, style } of used) {
    const familyFaces = faces.filter(
      (f) => f.family === family && f.style === style && f.urls.length > 0,
    );
    expect(familyFaces.length, `${family} ${style}: нет @font-face`).toBeGreaterThan(0);

    for (const letter of KAZAKH) {
      const cp = letter.codePointAt(0)!;
      let found = false;
      for (const face of familyFaces) {
        if (!inUnicodeRange(face.unicodeRange, cp)) continue;
        for (const url of face.urls) if ((await codepointsOf(url)).has(cp)) found = true;
      }
      if (!found)
        missing.push(`${family} ${style}: ${letter} (U+${cp.toString(16).toUpperCase()})`);
    }
  }

  expect(missing, "Глифы падают в системный шрифт").toEqual([]);

  // Защита от «всегда зелёного» теста: тибетского знака в этих шрифтах точно нет.
  const anyFile = [...cache.values()][0]!;
  expect(anyFile.has(0x0f00)).toBe(false);
});

test("предзагружается ровно одно начертание — заголовки", async ({ request }) => {
  const html = await (await request.get("/ru")).text();
  const preloads = html.match(/<link[^>]+rel="preload"[^>]+as="font"[^>]*>/g) ?? [];
  expect(preloads).toHaveLength(1);
});

test("резервные шрифты подогнаны по метрикам", async ({ page }) => {
  await page.goto("/ru");
  const fallbacks = await page.evaluate(() =>
    Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule)
      .filter((rule) => rule.style.getPropertyValue("src").includes("local("))
      .map((rule) => ({
        sizeAdjust: rule.style.getPropertyValue("size-adjust"),
        ascent: rule.style.getPropertyValue("ascent-override"),
        descent: rule.style.getPropertyValue("descent-override"),
      })),
  );
  // Антиква, курсив антиквы, гротеск.
  expect(fallbacks.length).toBeGreaterThanOrEqual(3);
  for (const fallback of fallbacks) {
    expect(fallback.sizeAdjust).not.toBe("");
    expect(fallback.ascent).not.toBe("");
    expect(fallback.descent).not.toBe("");
  }
});

test("страница проверки шрифтов не индексируется", async ({ page }) => {
  await page.goto("/ru/type-test");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
});
