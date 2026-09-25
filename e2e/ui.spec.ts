import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { chapterIds } from "./pages";

const menuButton = (page: Page) => page.locator('header button[aria-haspopup="dialog"]');
const dialog = (page: Page) => page.getByRole("dialog");

/** Фокус заметен: у элемента есть outline, а не outline: none. */
async function expectVisibleFocus(page: Page) {
  const style = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  expect(style.style).not.toBe("none");
  expect(style.width).toBeGreaterThanOrEqual(2);
}

test.describe("хедер", () => {
  test("прячется при прокрутке вниз и возвращается при прокрутке вверх", async ({ page }) => {
    await page.goto("/ru");
    const header = page.locator("header");
    await expect(header).toHaveAttribute("data-hidden", "false");
    await page.mouse.wheel(0, 1200);
    await expect(header).toHaveAttribute("data-hidden", "true");
    const transform = await header.evaluate((el) => getComputedStyle(el).transform);
    expect(transform).not.toBe("none");
    await page.mouse.wheel(0, -300);
    await expect(header).toHaveAttribute("data-hidden", "false");
  });

  test("тон меняется по секции под хедером", async ({ page }) => {
    await page.goto("/ru");
    const header = page.locator("header");
    // Прокручиваем так, чтобы верх главы ушёл под хедер (scrollIntoView учёл бы scroll-padding).
    const underHeader = (id: string) =>
      page.evaluate((id) => {
        const top = document.getElementById(id)!.getBoundingClientRect().top + scrollY;
        window.scrollTo(0, top + 10);
      }, id);
    await expect(header).toHaveAttribute("data-tone", "dark");
    await underHeader("assembly");
    await expect(header).toHaveAttribute("data-tone", "light");
    await underHeader("fire");
    await expect(header).toHaveAttribute("data-tone", "dark");
    await underHeader("contacts");
    await expect(header).toHaveAttribute("data-tone", "dark");
  });

  test("фокус с клавиатуры возвращает спрятанный хедер", async ({ page }) => {
    await page.goto("/ru");
    await page.mouse.wheel(0, 1500);
    await expect(page.locator("header")).toHaveAttribute("data-hidden", "true");
    await menuButton(page).focus();
    await expect
      .poll(() => page.locator("header").evaluate((el) => el.getBoundingClientRect().top))
      .toBeGreaterThanOrEqual(0);
  });
});

test.describe("меню", () => {
  test("диалог: фокус внутри, ловушка Tab, Esc и возврат фокуса", async ({ page }) => {
    await page.goto("/ru");
    const button = menuButton(page);
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.focus();
    await page.keyboard.press("Enter");

    await expect(dialog(page)).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Закрыть меню" })).toBeFocused();
    await expectVisibleFocus(page);

    // Ловушка: Shift+Tab с первого элемента уходит на последний и обратно.
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    const inside = () =>
      page.evaluate(() => Boolean(document.activeElement?.closest("dialog[open]")));
    expect(await inside()).toBe(true);
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      expect(await inside()).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("html")).not.toHaveAttribute("data-menu-open", /.*/);
  });

  test("содержит главы, страницы, языки, звук, «Коротко», контакты", async ({ page }) => {
    await page.goto("/ru");
    await menuButton(page).click();
    const menu = dialog(page);
    for (const id of chapterIds) {
      await expect(menu.locator(`a[href="/ru#${id}"]`)).toHaveCount(1);
    }
    await expect(menu.locator('a[href="/ru/services/kudalyk"]')).toHaveCount(1);
    await expect(menu.locator('a[href="/ru/fazenda"]')).toHaveCount(1);
    await expect(menu.locator('a[hreflang="kk"]')).toHaveCount(1);
    await expect(menu.getByRole("button", { name: /Звук/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await expect(menu.getByRole("button", { name: /Коротко/ })).toHaveCount(1);
    await expect(menu.getByText("Алматы")).toBeVisible();
  });

  test("ссылка на главу закрывает меню и ведёт к главе", async ({ page }) => {
    await page.goto("/ru");
    await menuButton(page).click();
    await dialog(page).getByRole("link", { name: "Огонь" }).click();
    await expect(dialog(page)).toBeHidden();
    await expect(page).toHaveURL(/#fire$/);
  });

  test("звук — только состояние, по умолчанию выключен и не запоминается", async ({ page }) => {
    await page.goto("/ru");
    await menuButton(page).click();
    const sound = dialog(page).getByRole("button", { name: /Звук/ });
    await sound.click();
    await expect(sound).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await menuButton(page).click();
    await expect(dialog(page).getByRole("button", { name: /Звук/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("без ошибок доступности в открытом состоянии", async ({ page }) => {
    await page.goto("/ru");
    await menuButton(page).click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const results = await new AxeBuilder({ page })
      .include("#site-menu")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});

test.describe("режим «Коротко» (uiMode)", () => {
  test("переключается в меню и запоминается", async ({ page }) => {
    await page.goto("/ru");
    await expect(page.locator("html")).toHaveAttribute("data-mode", "cinematic");
    await menuButton(page).click();
    const toggle = dialog(page).getByRole("button", { name: /Коротко/ });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-mode", "brief");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-mode", "brief");
  });

  test("включается сам при prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/ru");
    await expect(page.locator("html")).toHaveAttribute("data-mode", "brief");
    await menuButton(page).click();
    await expect(dialog(page).getByRole("button", { name: /Коротко/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

test.describe("навигация-горизонт", () => {
  test("<nav> со ссылками на все главы, работает с клавиатуры", async ({ page }) => {
    await page.goto("/ru");
    const nav = page.getByRole("navigation", { name: "Главы сайта" });
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(chapterIds.length);
    for (const [i, id] of chapterIds.entries()) {
      await expect(links.nth(i)).toHaveAttribute("href", `#${id}`);
    }
    await expect(links.first()).toHaveAttribute("aria-current", "step");

    await links.nth(3).focus();
    await expectVisibleFocus(page);
    await expect(links.nth(3).locator("span")).toHaveCSS("opacity", "1");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#fire$/);
    await expect(links.nth(3)).toHaveAttribute("aria-current", "step");
  });

  test("солнце двигается по прогрессу, в конце страницы — на последней главе", async ({ page }) => {
    await page.goto("/ru");
    const sun = page.locator("[data-horizon] span[style]");
    await page.locator("#day").evaluate((el) => el.scrollIntoView());
    await expect(page.locator('[data-horizon] a[aria-current="step"]')).toHaveAttribute(
      "href",
      "#day",
    );
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('[data-horizon] a[aria-current="step"]')).toHaveAttribute(
      "href",
      "#return",
    );
    await expect(sun).toHaveAttribute("style", /translateX\(100%\)/);
  });

  test("есть только на главной", async ({ page }) => {
    await page.goto("/ru/fazenda");
    await expect(page.locator("[data-horizon]")).toHaveCount(0);
  });
});

test.describe("без JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("«Меню» — ссылка на навигацию в футере, горизонт — список ссылок", async ({ page }) => {
    await page.goto("/ru");
    await expect(page.locator('header a[href="#site-nav"]')).toHaveText("Меню");
    await expect(page.locator("#site-nav")).toHaveCount(1);
    await expect(page.locator("[data-horizon] a")).toHaveCount(chapterIds.length);
  });
});

test.describe("WhatsApp", () => {
  test("без подтверждённого номера кнопки нет", async ({ page }) => {
    test.skip(Boolean(process.env.NEXT_PUBLIC_WHATSAPP_PHONE), "номер задан");
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/ru");
    await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
  });

  test("с номером: только мобильные, после главы 2, в зоне большого пальца", async ({ page }) => {
    test.skip(!process.env.NEXT_PUBLIC_WHATSAPP_PHONE, "номер не задан при сборке");
    const button = page.locator('a[href^="https://wa.me/"]');

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/ru");
    await page.locator("#fire").evaluate((el) => el.scrollIntoView());
    await expect(button).toBeHidden();

    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/ru");
    await expect(button).toBeHidden();
    await page.locator("#day").evaluate((el) => el.scrollIntoView());
    await page.mouse.wheel(0, 600);
    await expect(button).toBeVisible();
    await expect(button).toHaveAccessibleName("Написать в WhatsApp");
    const box = (await button.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(360 - 80);
    expect(box.y + box.height).toBeGreaterThan(740 - 140);
    expect(box.width).toBeGreaterThanOrEqual(48);
  });
});

test.describe("360px: ничего не перекрывает контент и CTA", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });

  test("каждая ссылка и кнопка в фокусе видна и не закрыта фиксированными элементами", async ({
    page,
  }) => {
    await page.goto("/ru");
    const covered: string[] = [];
    const total = await page.locator("main a, main button, footer a").count();
    await page.locator("body").focus();
    for (let i = 0; i < total + 8; i++) {
      await page.keyboard.press("Tab");
      const result = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || !el.closest("main, footer")) return null;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return null;
        const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1);
        const y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
        const hit = document.elementFromPoint(x, y);
        const ok = hit === el || el.contains(hit) || hit?.contains(el);
        return ok
          ? null
          : `${el.tagName} «${el.textContent?.trim().slice(0, 40)}» ← ${hit?.tagName}.${hit?.className}`;
      });
      if (result) covered.push(result);
    }
    expect(covered).toEqual([]);
  });

  test("нижние элементы не накрывают последний контент страницы", async ({ page }) => {
    await page.goto("/ru");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const lastText = page.locator("footer p").last();
    const box = (await lastText.boundingBox())!;
    const navTop = await page
      .locator("[data-horizon]")
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(box.y + box.height).toBeLessThanOrEqual(navTop);
  });
});
