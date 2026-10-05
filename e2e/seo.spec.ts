import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { getMessages } from "../src/content/messages";
import { formats } from "../src/content/formats";
import { indexablePaths } from "../src/lib/seo/pages";
import { locales } from "./pages";

/*
 * SEO (CLAUDE.md, раздел 11).
 * «curl-тест»: страница запрашивается обычным HTTP-запросом — без браузера и JS, как curl;
 * полный текст главной должен быть в ответе сервера.
 * Метаданные (canonical, hreflang kk/ru/en/x-default, OG, Twitter), JSON-LD (разбор и типы),
 * sitemap.xml с hreflang у каждой страницы, robots.txt, корень без перенаправления, плашка языка.
 */

const html = async (request: APIRequestContext, path: string) => {
  const r = await request.get(path, { maxRedirects: 0 });
  expect(r.status(), path).toBe(200);
  return r.text();
};
const attr = (doc: string, re: RegExp) => doc.match(re)?.[1] ?? null;
const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<");
const text = (doc: string) =>
  decode(doc.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ")).replace(
    /\s+/g,
    " ",
  );
const norm = (s: string) => s.replace(/\s+/g, " ");

test.describe("curl: главная без JS", () => {
  for (const locale of ["ru", "en"] as const) {
    test(`/${locale}: весь смысл — в HTML`, async ({ request }) => {
      const m = getMessages(locale);
      const body = text(await html(request, `/${locale}`));
      for (const s of [
        m.hero.title,
        m.hero.subtitle,
        m.hero.proof,
        m.assembly.manifest,
        m.assembly.parts.kerege.text,
        m.assembly.pillar,
        m.day.title,
        ...formats.map((f) => m.formats[f.key].phrase),
        m.fire.title,
        m.world.title,
        m.return.title,
        m.brief.submit,
      ])
        expect(body, s.slice(0, 40)).toContain(norm(s));
    });
  }

  test("корень / — без перенаправления, язык по умолчанию, canonical — /ru", async ({
    request,
  }) => {
    const doc = await html(request, "/");
    expect(attr(doc, /<html lang="([^"]+)"/)).toBe("ru");
    expect(attr(doc, /<link rel="canonical" href="([^"]+)"/)).toMatch(/\/ru$/);
    expect(text(doc)).toContain(norm(getMessages("ru").hero.title));
  });
});

test.describe("метаданные и JSON-LD всех индексируемых страниц", () => {
  for (const locale of locales) {
    test(`${locale}: canonical, hreflang, OG, Twitter, JSON-LD`, async ({ request }) => {
      for (const path of indexablePaths()) {
        const url = `/${locale}${path}`;
        const doc = await html(request, url);
        expect(attr(doc, /<link rel="canonical" href="([^"]+)"/), url).toMatch(
          new RegExp(`${url.replace(/\//g, "\\/")}$`),
        );
        for (const lang of ["kk", "ru", "en", "x-default"]) {
          const href = attr(
            doc,
            new RegExp(`<link rel="alternate" hrefLang="${lang}" href="([^"]+)"`),
          );
          expect(href, `${url} hreflang ${lang}`).toMatch(
            new RegExp(`/${lang === "x-default" ? "ru" : lang}${path}$`),
          );
        }
        for (const prop of ["og:title", "og:description", "og:image", "og:url", "og:locale"])
          expect(
            attr(doc, new RegExp(`<meta property="${prop}" content="([^"]+)"`)),
            `${url} ${prop}`,
          ).toBeTruthy();
        expect(attr(doc, /<meta name="twitter:card" content="([^"]+)"/)).toBe(
          "summary_large_image",
        );
        expect(attr(doc, /<meta name="description" content="([^"]+)"/), url).toBeTruthy();

        // JSON-LD: разбирается, словарь schema.org, нужные типы.
        const blocks = [
          ...doc.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
        ]
          .map((b) => JSON.parse(b[1]!))
          .flat() as { "@context": string; "@type": string }[];
        for (const b of blocks) expect(b["@context"]).toBe("https://schema.org");
        const types = blocks.map((b) => b["@type"]);
        if (path === "") expect(types).toEqual(["Organization", "LocalBusiness", "Place"]);
        if (path === "/fazenda") expect(types).toEqual(["Place"]);
        if (path.startsWith("/cases/")) expect(types).toEqual(["CreativeWork"]);
        if (path.startsWith("/services/")) {
          expect(types).toEqual(["FAQPage"]);
          // Ответы FAQ — видимым текстом на странице (без скрытого текста).
          const faq = blocks[0] as unknown as {
            mainEntity: { name: string; acceptedAnswer: { text: string } }[];
          };
          const visible = text(doc);
          for (const q of faq.mainEntity) {
            expect(visible).toContain(norm(q.name));
            expect(visible).toContain(norm(q.acceptedAnswer.text));
          }
        }
      }
    });
  }

  test("OG-изображения отдаются (JPEG 1200×630)", async ({ request }) => {
    const doc = await html(request, "/ru/services/wedding");
    const og = new URL(attr(doc, /<meta property="og:image" content="([^"]+)"/)!);
    const r = await request.get(og.pathname);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/jpeg");
  });
});

test.describe("sitemap.xml и robots.txt", () => {
  test("в sitemap — все страницы на трёх языках, у каждой hreflang kk/ru/en/x-default", async ({
    request,
  }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((u) => u[1]!);
    expect(urls).toHaveLength(indexablePaths().length * locales.length);
    for (const locale of locales)
      for (const path of indexablePaths()) {
        const entry = urls.find((u) => new RegExp(`<loc>[^<]*/${locale}${path}</loc>`).test(u));
        expect(entry, `${locale}${path}`).toBeTruthy();
        for (const lang of ["kk", "ru", "en", "x-default"])
          expect(entry).toContain(`hreflang="${lang}"`);
      }
    // Служебные страницы — не в карте.
    expect(xml).not.toMatch(/render-test|type-test|\/request\//);
  });

  test("robots.txt — открыт, служебное закрыто, ссылка на карту", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Allow: \//);
    expect(robots).toMatch(/Disallow: \/\*\/render-test/);
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
  });
});

test.describe("запросы — в видимом тексте, без скрытого", () => {
  const queries = {
    ru: [
      ["", "ивент-агентство"],
      ["", "Алматы"],
      ["/services/conference", "Организация конференций"],
      ["/services/kudalyk", "Кудалык"],
      ["/services/wedding", "площадке у подножия гор под Алматы"],
      ["/services/team-building", "Тимбилдинг"],
    ],
    en: [
      ["", "event agency"],
      ["", "Almaty"],
      ["/services/conference", "Conference organization"],
      ["/services/kudalyk", "Kudalyk"],
      ["/services/wedding", "venue at the foot of the mountains near Almaty"],
      ["/services/team-building", "Team building"],
    ],
  } as const;
  for (const [locale, list] of Object.entries(queries)) {
    test(`${locale}: каждый запрос виден человеку на своей странице`, async ({ page }) => {
      for (const [path, q] of list) {
        await page.goto(`/${locale}${path}`);
        // innerText — только то, что видно (скрытый текст сюда не попадает).
        const visible = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
        expect(visible.toLowerCase(), `${path}: ${q}`).toContain(q.toLowerCase());
      }
    });
  }
});

test.describe("плашка языка (вместо перенаправления)", () => {
  test("браузер на английском: на /ru предлагается English — в потоке над хедером, ничего не перекрывает; закрытие запоминается", async ({
    browser,
  }) => {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    await page.goto("/ru/fazenda");
    const banner = page.getByRole("complementary", { name: "Site language" });
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("lang", "en");
    // В потоке, а не поверх страницы: ничего не перекрывает.
    expect(await banner.evaluate((el) => getComputedStyle(el).position)).toBe("static");
    // Доступность с видимой плашкой — без нарушений.
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await expect(banner.getByRole("link", { name: "Switch to English" })).toHaveAttribute(
      "href",
      "/en/fazenda",
    );
    await banner.getByRole("button", { name: "Close" }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByRole("complementary", { name: "Site language" })).toBeHidden();
    await context.close();
  });

  test("браузер на русском — на /ru плашки нет", async ({ browser }) => {
    const context = await browser.newContext({ locale: "ru-RU" });
    const page = await context.newPage();
    await page.goto("/ru");
    await page.waitForTimeout(800);
    await expect(page.locator("aside[data-for]:visible")).toHaveCount(0);
    await context.close();
  });
});
