import { expect, test } from "@playwright/test";
import { contentLanguage } from "../src/content/messages";
import { allPaths, locales } from "./pages";

/** Разделы главной-визитки (решение заказчика 12.11.2026) — в порядке страницы. */
const HOME_SECTIONS = [
  "assembly",
  "services",
  "gallery",
  "reviews",
  "why",
  "steps",
  "fazenda",
  "team",
  "brief",
];

test.describe("главная-визитка на трёх языках", () => {
  for (const locale of locales) {
    test(`/${locale}`, async ({ page }) => {
      await page.goto(`/${locale}`);

      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator('a[href="#main"]')).toHaveCount(1);
      await expect(page.locator("main#main")).toHaveCount(1);

      const ids = await page
        .locator("main > section[aria-labelledby]")
        .evaluateAll((els) => els.map((el) => el.id));
      expect(ids).toEqual(HOME_SECTIONS);
      for (const id of HOME_SECTIONS) {
        const section = page.locator(`#${id}`);
        await expect(section).toHaveAttribute("data-tone", /^(light|dark)$/);
        const labelledBy = await section.getAttribute("aria-labelledby");
        await expect(page.locator(`#${labelledBy}`)).not.toBeEmpty();
      }
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
        // lang — язык текста (на /kk пока русский, WCAG 3.1.1).
        await expect(page.locator("html")).toHaveAttribute("lang", contentLanguage(locale));
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

  test("главная читается целиком; «Обсудить мероприятие» ведёт к форме", async ({ page }) => {
    await page.goto("/ru");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Организуем мероприятия под\sключ в\sАлматы/,
    );
    for (const id of HOME_SECTIONS.slice(1)) {
      await expect(page.locator(`#${id === "brief" ? "brief" : id}-title`)).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Обсудить мероприятие" })).toHaveAttribute(
      "href",
      /#brief$/,
    );
    // Галерея без JS — ссылки на крупные фото.
    await expect(page.locator("#gallery a[href$='.jpg']").first()).toBeVisible();
  });

  test("HTML содержит полный текст без JS", async ({ request }) => {
    // Неразрывные пробелы от типографики приводим к обычным.
    const html = (await (await request.get("/ru")).text()).replace(/\u00a0|&nbsp;/g, " ");
    for (const text of [
      "Организуем мероприятия под ключ в Алматы",
      "Что мы делаем",
      "Аренда техники",
      "Фотобудка",
      "Наши тимбилдинги",
      "Почему выбирают нас",
      "Как мы работаем",
      "Наша фазенда",
      "Команда",
      "Обсудим ваше мероприятие",
    ])
      expect(html, text).toContain(text);
  });
});

test("галерея: фото открывается крупно, Esc закрывает, фокус возвращается", async ({ page }) => {
  await page.goto("/ru");
  const thumb = page.locator("#gallery a").first();
  await thumb.click();
  const dialog = page.getByRole("dialog", { name: "Фото тимбилдинга" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("img")).toHaveAttribute("alt", /Тимбилдинг ULY DALA/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(thumb).toBeFocused();
});

test("каждое изображение: размеры и описание (оформление — скрыто от скринридера)", async ({
  page,
}) => {
  await page.goto("/ru");
  const images = await page.locator("main img").evaluateAll((els) =>
    els.map((el) => ({
      alt: el.getAttribute("alt"),
      w: el.getAttribute("width"),
      h: el.getAttribute("height"),
      hidden: el.closest("[aria-hidden='true']") !== null,
    })),
  );
  expect(images.length).toBeGreaterThan(3);
  for (const img of images) {
    expect(img.w && img.h).toBeTruthy();
    if (!img.hidden) expect(img.alt?.length ?? 0).toBeGreaterThan(10);
  }
});

test("«Нам доверяют»: клиенты названиями и рамки для фото отзывов", async ({ page }) => {
  await page.goto("/ru?quality=fallback");
  const block = page.locator("#reviews");
  await expect(block.getByRole("heading", { level: 2 })).toHaveText("Нам доверяют");
  for (const name of ["БЦ Promenade", "Freedom Broker", "Hero’s Journey", "Клиника Aston"])
    await expect(block.getByText(name, { exact: true })).toBeVisible();
  await expect(block.getByText("и ещё более 10 клиентов")).toBeVisible();
  await expect(block.getByText("Фото отзыва скоро")).toHaveCount(3);
});

test("контакты: WhatsApp, два телефона, почта, два Instagram — в заявке, футере и меню", async ({
  page,
}) => {
  await page.goto("/ru?quality=fallback");
  const hrefs = [
    "https://wa.me/77006434084",
    "tel:+77006434084",
    "tel:+77771882255",
    "mailto:info@ulydala.events",
    "https://www.instagram.com/uly_dala_event/",
    "https://www.instagram.com/ulydala_kz/",
  ];
  for (const scope of ["#brief", "footer"])
    for (const href of hrefs)
      await expect(page.locator(`${scope} a[href="${href}"]`).first()).toBeAttached();
  await expect(
    page.locator("[data-home-hero]").getByRole("link", { name: "Написать в WhatsApp" }),
  ).toHaveAttribute("href", "https://wa.me/77006434084");
  await page.locator('header button[aria-haspopup="dialog"]').click();
  for (const href of hrefs)
    await expect(page.getByRole("dialog").locator(`a[href="${href}"]`)).toHaveCount(1);
});

test("галерея — карусель: кнопки листают ленту, у краёв гаснут, страница не шире экрана", async ({
  page,
}) => {
  await page.goto("/ru?quality=fallback");
  const track = page.getByRole("list", { name: "Фото тимбилдингов — листайте" });
  const gallery = page.locator("#gallery");
  const prev = gallery.getByRole("button", { name: "Предыдущие фото" });
  const next = gallery.getByRole("button", { name: "Следующие фото" });
  await expect(prev).toBeDisabled();
  await expect(next).toBeEnabled();
  await next.click();
  await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
  await expect(prev).toBeEnabled();
  await track.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  await expect(next).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => innerWidth),
  );
});

test("фазенда — карусель фото: листается, по клику крупно", async ({ page }) => {
  await page.goto("/ru?quality=fallback");
  const block = page.locator("#fazenda");
  const track = block.getByRole("list", { name: "Фото фазенды — листайте" });
  await expect(track.locator("li")).toHaveCount(15);
  await block.getByRole("button", { name: "Следующие фото" }).click();
  await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
  await track.locator("a").first().click();
  await expect(page.getByRole("dialog", { name: "Фото фазенды" })).toBeVisible();
});
