import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { getMessages } from "../src/content/messages";
import { locales } from "./pages";

/*
 * Доступность (CLAUDE.md, раздел 10; WCAG 2.2 AA) — то, что обычный axe по загруженной странице
 * не видит: состояния с готовым 3D, дерево доступности (что слышит скринридер), клавиатура.
 *
 * Путь «найти формат → отправить бриф» — только клавиатура (Tab, стрелки, Enter, пробел)
 * и только роли и имена (как ищет скринридер), на трёх языках. Ручная проверка VoiceOver / NVDA —
 * docs/accessibility.md.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function openStage(page: Page, path: string) {
  await page.goto(`${path}?quality=high`);
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 20_000 });
}

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

/** Нажимать Tab, пока фокус не окажется на target (не больше max раз). */
async function tabTo(page: Page, target: Locator, max = 80) {
  for (let i = 0; i < max; i++) {
    // Любой из совпавших (подпись поля может найтись и в «предложении», и в обычной форме).
    if (await target.evaluateAll((els) => els.some((el) => el === document.activeElement))) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("фокус не дошёл до элемента");
}

test.describe("доступность: состояния с 3D", () => {
  test.setTimeout(150_000);

  test("axe — 0 нарушений в каждой главе с готовым 3D", async ({ page }) => {
    await openStage(page, "/ru");
    const all: string[] = [];
    for (const id of ["assembly", "day", "fire", "world", "return"]) {
      await page.evaluate((id) => {
        const t = document.querySelector<HTMLElement>(`[data-track='${id}']`)!;
        window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY);
      }, id);
      await page.waitForTimeout(800);
      all.push(...(await axe(page)).map((v) => `${id} → ${v}`));
    }
    expect(all).toEqual([]);
  });

  test("описания сцен остаются в дереве доступности, когда 3D готово (холст aria-hidden)", async ({
    page,
    context,
  }) => {
    await openStage(page, "/ru");
    expect(
      await page
        .locator("canvas")
        .first()
        .evaluate((c) => !!c.closest("[aria-hidden='true']")),
    ).toBe(true);
    const cdp = await context.newCDPSession(page);
    const { nodes } = (await cdp.send("Accessibility.getFullAXTree")) as {
      nodes: { role?: { value: string }; name?: { value: string }; ignored: boolean }[];
    };
    const images = nodes
      .filter((n) => n.role?.value === "image" && !n.ignored)
      .map((n) => n.name?.value ?? "");
    const m = getMessages("ru");
    for (const alt of [m.hero.sceneAlt, m.assembly.sceneAlt, m.fire.sceneAlt, m.world.sceneAlt]) {
      expect(images, alt.slice(0, 30)).toContain(alt);
    }
  });

  test("табы «Дня» с клавиатуры: фокус не теряется, из панели — дальше по странице", async ({
    page,
  }) => {
    await openStage(page, "/ru");
    const m = getMessages("ru");
    const tab = page.getByRole("tab", { name: m.formats.conference.title });
    await tabTo(page, tab);
    // Стрелки — между форматами; Tab — в панель, по её ссылкам и дальше.
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { selected: true })).toHaveText(m.formats.coffeeBreak.title);
    const panel = page.getByRole("tabpanel");
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(250);
      const where = await page.evaluate(() => ({
        body: document.activeElement === document.body,
        inDay: !!document.activeElement?.closest("#day"),
      }));
      expect(where.body, `шаг ${i}: фокус потерян`).toBe(false);
      if (!where.inDay) break;
    }
    await expect(panel).toHaveCount(1);
  });
});

test.describe("доступность: увеличение и язык", () => {
  test("400% (окно 320 CSS px) — без прокрутки вбок: главная и бриф", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 200 },
      deviceScaleFactor: 4,
    });
    const page = await context.newPage();
    for (const path of ["/ru", "/ru#brief", "/ru/request/visit"]) {
      await page.goto(path);
      await page.waitForTimeout(500);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBe(0);
    }
    await context.close();
  });
});

for (const locale of locales) {
  test.describe(`путь «найти формат → отправить бриф» — только клавиатура (${locale})`, () => {
    test.setTimeout(150_000);

    test("Tab и стрелки до кудалыка, Enter — бриф, ошибки озвучены, отправка — успех озвучен", async ({
      page,
    }) => {
      const m = getMessages(locale);
      await openStage(page, `/${locale}`);

      // 1. Найти формат: Tab до табов «Дня», стрелками — кудалык.
      await tabTo(page, page.getByRole("tab", { selected: true }));
      const kudalyk = page.getByRole("tab", { name: m.formats.kudalyk.title });
      for (
        let i = 0;
        i < 6 && !(await kudalyk.getAttribute("aria-selected"))?.includes("true");
        i++
      )
        await page.keyboard.press("ArrowRight");
      await expect(kudalyk).toHaveAttribute("aria-selected", "true");

      // 2. CTA формата — Enter: открывается бриф (диалог) с кудалыком.
      await tabTo(page, page.getByRole("link", { name: m.formats.kudalyk.cta }), 10);
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: m.brief.variants.brief.title });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("radio", { name: m.brief.eventTypes.kudalyk.label }),
      ).toBeChecked();

      // 3. Отправка без обязательных полей: ошибки — в живой области, фокус — на первом поле.
      await tabTo(page, dialog.getByRole("button", { name: m.brief.submit }));
      await page.keyboard.press("Enter");
      await expect(dialog.locator("[aria-live]", { hasText: m.brief.errors.summary })).toBeVisible({
        timeout: 15_000,
      });
      // Фокус — на первом поле с ошибкой (имя).
      const name = dialog.locator("input[aria-invalid='true']").first();
      await expect(name).toBeFocused();
      await expect(name).toHaveAttribute("aria-invalid", "true");

      // 4. Заполнить — только клавиатурой.
      await page.keyboard.type(`Клавиатура ${locale}`);
      await tabTo(page, dialog.getByLabel(m.brief.questions.phone));
      await page.keyboard.type("7011234567");
      await tabTo(page, dialog.getByRole("checkbox", { name: m.brief.consent }));
      await page.keyboard.press("Space");
      await tabTo(page, dialog.getByRole("button", { name: m.brief.submit }));
      await page.keyboard.press("Enter");

      // 5. Успех: статус с текстом и фокусом (скринридер его озвучивает).
      const status = dialog.getByRole("status");
      await expect(status).toContainText(m.brief.success.title, { timeout: 15_000 });
      await expect(status).toBeFocused();
    });
  });
}

/*
 * Контраст текста над 3D (раздел 10: ≥ 4.5:1, крупный ≥ 3:1, первый экран ≥ 7:1). axe над холстом
 * контраст не меряет («incomplete») — меряем по пикселям: фон — снимок с прозрачным текстом,
 * худший случай — 95-й перцентиль фона в рамке текста.
 */
async function contrastIssues(page: Page, scope: string) {
  // Проявление светом должно дойти до полной яркости — ждём его (и этим проверяем, что доходит).
  await expect
    .poll(
      () =>
        page.evaluate(
          (scope) => document.querySelectorAll(`${scope} [data-reveal-state="run"]`).length,
          scope,
        ),
      { timeout: 20_000 },
    )
    .toBe(0);
  const items = await page.evaluate((scope) => {
    const out: {
      text: string;
      x: number;
      y: number;
      w: number;
      h: number;
      color: number[];
      need: number;
    }[] = [];
    const root = document.querySelector(scope);
    if (!root) return out;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode;
      const el = t.parentElement!;
      if (!t.textContent?.trim() || el.closest("[aria-hidden='true']")) continue;
      const st = getComputedStyle(el);
      // Скрытое только визуально (плашки неактивных зон, h3 панели) — не на экране.
      let o = 1;
      let clipped = false;
      for (let e: Element | null = el; e; e = e.parentElement) {
        const es = getComputedStyle(e);
        o *= +es.opacity;
        if (es.clipPath.includes("inset(50%)")) clipped = true;
      }
      if (o < 0.5 || clipped) continue;
      const range = document.createRange();
      range.selectNodeContents(t);
      const r = range.getBoundingClientRect();
      // За краем экрана (в том числе табы, уехавшие за край полосы) — не видно.
      if (r.width < 4 || r.bottom < 0 || r.top > innerHeight || r.left < 0 || r.right > innerWidth)
        continue;
      const nums = st.color.match(/[\d.]+/g)!.map(Number);
      const color = st.color.startsWith("color(")
        ? nums.slice(0, 3).map((v) => v * 255)
        : nums.slice(0, 3);
      const size = parseFloat(st.fontSize);
      const large = size >= 24 || (size >= 18.66 && +st.fontWeight >= 700);
      const need = el.closest("[data-hero-text]") ? 7 : large ? 3 : 4.5;
      out.push({
        text: t.textContent.trim().slice(0, 30),
        x: Math.max(0, r.left),
        y: Math.max(0, r.top),
        w: r.width,
        h: Math.min(r.height, innerHeight - r.top),
        color,
        need,
      });
    }
    return out;
  }, scope);
  const hide = await page.addStyleTag({
    // Проявление светом рисует текст градиентом фона (background-clip: text) — его тоже убираем.
    content:
      "main *, main *::before, main *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; } main [data-reveal] { background-image: none !important; } main a, main button { border-color: transparent !important; }",
  });
  const bg = (await page.screenshot()).toString("base64");
  await hide.evaluate((n) => (n as Element).remove());
  const helper = await page.context().newPage();
  const ratios = await helper.evaluate(
    async ([b64, items]) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const L = (r: number, gg: number, b: number) =>
        0.2126 * lin(r) + 0.7152 * lin(gg) + 0.0722 * lin(b);
      return items.map((it) => {
        const w = Math.max(1, Math.floor(Math.min(it.w, img.width - it.x)));
        const h = Math.max(1, Math.floor(it.h));
        const d = g.getImageData(Math.floor(it.x), Math.floor(it.y), w, h).data;
        const lum: number[] = [];
        for (let i = 0; i < d.length; i += 8) lum.push(L(d[i]!, d[i + 1]!, d[i + 2]!));
        lum.sort((a, b) => a - b);
        const tl = L(it.color[0]!, it.color[1]!, it.color[2]!);
        const worst =
          tl > 0.18 ? lum[Math.floor(lum.length * 0.95)]! : lum[Math.floor(lum.length * 0.05)]!;
        return (Math.max(tl, worst) + 0.05) / (Math.min(tl, worst) + 0.05);
      });
    },
    [bg, items] as const,
  );
  await helper.close();
  return items
    .map((it, i) => ({ ...it, ratio: ratios[i]! }))
    .filter((it) => it.ratio < it.need)
    .map((it) => `«${it.text}» ${it.ratio.toFixed(2)} < ${it.need}`);
}

test.describe("контраст над 3D", () => {
  test.setTimeout(150_000);

  for (const [name, viewport] of [
    ["десктоп", { width: 1280, height: 800 }],
    ["телефон", { width: 390, height: 844 }],
  ] as const) {
    test(`${name}: первый экран ≥ 7:1, главы ≥ 4.5:1`, async ({ browser }) => {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await openStage(page, "/ru");
      await page.waitForTimeout(6000); // интро
      const issues = [...(await contrastIssues(page, "[data-hero-text]"))];
      for (const [track, p, scope] of [
        ["day", 0.05, "[data-track='day']"],
        ["fire", 0.15, "[data-fire-stage]"],
        ["fire", 0.9, "[data-fire-stage]"],
        ["world", 0.42, "[data-world-stage]"],
        ["return", 1, "[data-return-stage]"],
      ] as const) {
        await page.evaluate(
          ([track, p]) => {
            const t = document.querySelector<HTMLElement>(`[data-track='${track}']`)!;
            const top = t.getBoundingClientRect().top + window.scrollY;
            window.scrollTo(0, top + (t.offsetHeight - window.innerHeight) * Number(p));
          },
          [track, String(p)] as const,
        );
        await page.waitForTimeout(2500);
        issues.push(...(await contrastIssues(page, scope)).map((x) => `${track} ${p}: ${x}`));
      }
      expect(issues).toEqual([]);
      await context.close();
    });
  }
});
