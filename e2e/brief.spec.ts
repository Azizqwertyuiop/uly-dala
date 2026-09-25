import { DatabaseSync } from "node:sqlite";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_DB, E2E_FAILING_DB, FAILING_PORT } from "../playwright.config";

/*
 * Бриф и заявки (CLAUDE.md, раздел 9). Уведомления на основном сервере — мок (пишутся в базу),
 * на втором сервере — «падают»: Telegram указывает на закрытый порт.
 */

/** Регулярка, в которой пробел совпадает и с неразрывным (типографика ставит их в подписи). */
const re = (text: string) =>
  new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"));

const uniqueName = () => `Тест ${Math.random().toString(36).slice(2, 8)}`;

function db(path: string) {
  return new DatabaseSync(path, { readOnly: true });
}

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  event_type: string | null;
  source: string;
};

function findLead(path: string, name: string): LeadRow | undefined {
  return db(path).prepare("SELECT * FROM leads WHERE name = ?").get(name) as LeadRow | undefined;
}

const brief = (page: Page) => page.locator("#brief");

async function fillRequired(scope: Locator, name: string) {
  await scope.getByLabel(re("Как вас зовут")).fill(name);
  await scope.getByLabel(re("Ваш номер телефона")).fill("7011234567");
  await scope.getByLabel(re("согласен на обработку")).check();
}

test.describe("бриф с JS", () => {
  test("проходит до экрана успеха; заявка в базе, уведомления (мок) доставлены, ответ ≤ 2 с", async ({
    page,
  }) => {
    await page.goto("/ru#brief");
    const form = brief(page);
    const name = uniqueName();

    await form.getByRole("radio", { name: "Кудалык" }).check();
    await form.getByRole("radio", { name: "Знаем месяц" }).check();
    await form.getByLabel("Месяц", { exact: true }).selectOption("6");
    await form.getByRole("radio", { name: "50–150" }).check();
    await form.getByRole("radio", { name: /вашей фазенде/ }).check();
    await fillRequired(form, name);
    await expect(form.getByLabel(re("Ваш номер телефона"))).toHaveValue("+7 (701) 123-45-67");
    await form.getByRole("radio", { name: "WhatsApp" }).check();

    const started = Date.now();
    await form.getByRole("button", { name: "Отправить бриф" }).click();
    await expect(form.getByRole("status")).toContainText("Спасибо");
    expect(Date.now() - started).toBeLessThan(2000);
    await expect(form.getByRole("status")).toBeFocused();

    const lead = findLead(E2E_DB, name);
    expect(lead).toMatchObject({ phone: "+77011234567", event_type: "kudalyk", source: "brief" });
    await expect
      .poll(() =>
        db(E2E_DB)
          .prepare("SELECT channel FROM notifications WHERE lead_id = ? AND status = 'sent'")
          .all(lead!.id)
          .map((row) => (row as { channel: string }).channel)
          .sort(),
      )
      .toEqual(["email", "telegram"]);
  });

  test("ошибки — текстом у поля, фокус на первой ошибке, введённое не теряется", async ({
    page,
  }) => {
    await page.goto("/ru#brief");
    const form = brief(page);
    await form.getByLabel(re("Ваш номер телефона")).fill("701");
    await form.getByRole("button", { name: "Отправить бриф" }).click();

    await expect(form.getByText("В форме есть ошибки")).toBeVisible();
    const nameInput = form.getByLabel(re("Как вас зовут"));
    await expect(nameInput).toBeFocused();
    await expect(nameInput).toHaveAttribute("aria-invalid", "true");
    await expect(nameInput).toHaveAccessibleDescription(re("Заполните это поле"));
    await expect(form.getByLabel(re("Ваш номер телефона"))).toHaveAccessibleDescription(
      re("формате +7"),
    );
    await expect(form.getByLabel(re("Ваш номер телефона"))).toHaveValue("+7 (701)");
    await expect(form.getByText("Нужно согласие на обработку данных.")).toBeVisible();
  });

  test("согласие не предзаполнено и ведёт к политике конфиденциальности", async ({ page }) => {
    await page.goto("/ru#brief");
    const form = brief(page);
    await expect(form.getByLabel(re("согласен на обработку"))).not.toBeChecked();
    await expect(form.getByRole("link", { name: "Политика конфиденциальности" })).toHaveAttribute(
      "href",
      "/ru/privacy",
    );
  });

  test("черновик переживает перезагрузку (sessionStorage), согласие — нет", async ({ page }) => {
    await page.goto("/ru#brief");
    const form = brief(page);
    await form.getByLabel(re("Как вас зовут")).fill("Черновик");
    await form.getByRole("radio", { name: "Свадьба" }).check();
    await form.getByLabel(re("согласен на обработку")).check();
    await page.reload();
    await expect(brief(page).getByLabel(re("Как вас зовут"))).toHaveValue("Черновик");
    await expect(brief(page).getByRole("radio", { name: "Свадьба" })).toBeChecked();
    await expect(brief(page).getByLabel(re("согласен на обработку"))).not.toBeChecked();
  });
});

test.describe("скринридер", () => {
  test("форма читается как последовательность вопросов; визуальное предложение скрыто", async ({
    page,
  }) => {
    await page.goto("/ru#brief");
    const form = brief(page).locator("form");
    const questions = await form.evaluate((el) =>
      [...el.querySelectorAll("fieldset > legend, label[for]")]
        .filter((node) => !node.closest('[aria-hidden="true"]'))
        .map((node) => node.textContent?.replace(/\s+/g, " ").trim()),
    );
    expect(questions).toEqual([
      "Какое событие вы планируете? (необязательно)",
      "Когда? (необязательно)",
      "Сколько будет гостей? (необязательно)",
      "Где провести событие? (необязательно)",
      "Как вас зовут? (обязательно)",
      "Ваш номер телефона (обязательно)",
      "Как с вами удобнее связаться? (необязательно)",
      "Комментарий (необязательно)",
      "Я согласен на обработку персональных данных. (обязательно)",
    ]);
    await expect(form.locator("[data-brief-sentence]")).toHaveAttribute("aria-hidden", "true");
    await expect(form.getByRole("group", { name: /Какое событие/ })).toBeVisible();
  });

  test("без ошибок доступности (axe)", async ({ page }) => {
    await page.goto("/ru#brief");
    const results = await new AxeBuilder({ page })
      .include("#brief")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`),
    ).toEqual([]);
  });
});

test.describe("раскладки", () => {
  test("≥ 600px: бриф-предложение с выбором синхронно с формой", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/ru#brief");
    const sentence = brief(page).locator("[data-brief-sentence]");
    await expect(sentence).toBeVisible();
    await sentence.getByRole("button", { name: "[событие]", includeHidden: true }).click();
    await sentence.getByRole("button", { name: "Свадьба", includeHidden: true }).click();
    await expect(sentence).toContainText("свадьбу");
    await expect(brief(page).getByRole("radio", { name: "Свадьба" })).toBeChecked();

    await sentence.getByRole("button", { name: "[когда]", includeHidden: true }).click();
    await sentence.getByRole("button", { name: "Июнь", includeHidden: true }).click();
    await expect(sentence).toContainText("в июне");
    await expect(brief(page).getByLabel("Месяц", { exact: true })).toHaveValue("6");

    // Выбор в форме отражается в предложении.
    await brief(page).getByRole("radio", { name: "Больше 500" }).check();
    await expect(sentence).toContainText("больше чем на 500 гостей");
  });

  test("< 600px: «строка + поле», предложения нет", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/ru#brief");
    await expect(brief(page).locator("[data-brief-sentence]")).toHaveCount(0);
    await expect(brief(page).locator("form")).toHaveAttribute("data-layout", "lines");
    await expect(brief(page).getByText("Мы планируем", { exact: true })).toBeVisible();
  });
});

test.describe("модальное окно и предзаполнение", () => {
  test("«Обсудить кудалык» в главе «День» открывает бриф с выбранным кудалыком", async ({
    page,
  }) => {
    await page.goto("/ru");
    await page.getByRole("tab", { name: "Кудалык" }).click();
    const cta = page.locator("#format-kudalyk").getByRole("link", { name: "Обсудить кудалык" });
    await cta.click();
    const dialog = page.getByRole("dialog", { name: "Расскажите о событии" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "Кудалык" })).toBeChecked();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(cta).toBeFocused();
  });

  test("«Запросить меню» — мини-форма в окне, тот же эндпоинт", async ({ page }) => {
    await page.goto("/ru");
    await page.getByRole("link", { name: "Запросить меню" }).click();
    const dialog = page.getByRole("dialog", { name: "Запросить меню" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("group", { name: /Где провести/ })).toHaveCount(0);
    const name = uniqueName();
    await fillRequired(dialog, name);
    await dialog.getByRole("button", { name: "Отправить бриф" }).click();
    await expect(dialog.getByRole("status")).toContainText("Спасибо");
    expect(findLead(E2E_DB, name)?.source).toBe("menu");
  });

  test("«Приехать на просмотр» — мини-форма с датой визита", async ({ page }) => {
    await page.goto("/ru/fazenda");
    await page.getByRole("link", { name: "Приехать на просмотр" }).click();
    const dialog = page.getByRole("dialog", { name: "Приехать на просмотр" });
    await expect(
      dialog.getByRole("group", { name: "Когда удобно приехать? (необязательно)" }),
    ).toBeVisible();
    const name = uniqueName();
    await fillRequired(dialog, name);
    await dialog.getByRole("button", { name: "Отправить бриф" }).click();
    await expect(dialog.getByRole("status")).toContainText("Спасибо");
    expect(findLead(E2E_DB, name)?.source).toBe("visit");
  });

  test("окно брифа без ошибок доступности", async ({ page }) => {
    await page.goto("/ru");
    await page.getByRole("link", { name: "Запросить меню" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Контраст проверяем после анимации появления (во время неё окно полупрозрачно).
    await page
      .getByRole("dialog")
      .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const results = await new AxeBuilder({ page })
      .include("dialog[open]")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => `${n.target} ${n.failureSummary}`).join(" | ")}`,
      ),
    ).toEqual([]);
  });
});

test.describe("без JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("обычный POST: серверная валидация, введённое сохраняется, затем успех", async ({
    page,
  }) => {
    await page.goto("/ru#brief");
    const form = brief(page);
    const name = uniqueName();

    await form.getByLabel(re("Как вас зовут")).fill(name);
    await form.getByLabel(re("Ваш номер телефона")).fill("123");
    await form.getByRole("radio", { name: "Кудалык" }).check();
    await form.getByRole("button", { name: "Отправить бриф" }).click();

    // Страница перерисована сервером: ошибки у полей, данные на месте.
    await expect(form.getByText("В форме есть ошибки")).toBeVisible();
    await expect(form.getByLabel(re("Ваш номер телефона"))).toHaveAccessibleDescription(
      re("формате +7"),
    );
    await expect(form.getByText("Нужно согласие на обработку данных.")).toBeVisible();
    await expect(form.getByLabel(re("Как вас зовут"))).toHaveValue(name);
    await expect(form.getByRole("radio", { name: "Кудалык" })).toBeChecked();
    expect(findLead(E2E_DB, name)).toBeUndefined();

    await form.getByLabel(re("Ваш номер телефона")).fill("+7 701 765 43 21");
    await form.getByLabel(re("согласен на обработку")).check();
    await form.getByRole("button", { name: "Отправить бриф" }).click();
    await expect(page.getByText("Спасибо! Заявка у нас.")).toBeVisible();
    expect(findLead(E2E_DB, name)).toMatchObject({ phone: "+77017654321", event_type: "kudalyk" });
  });

  test("мини-форма «Приехать на просмотр» — отдельная страница", async ({ page }) => {
    await page.goto("/ru");
    await page.getByRole("link", { name: "Приехать на просмотр" }).first().click();
    await expect(page).toHaveURL(/\/ru\/request\/visit$/);
    const name = uniqueName();
    await fillRequired(page.locator("main"), name);
    await page.getByRole("button", { name: "Отправить бриф" }).click();
    await expect(page.getByText("Спасибо! Заявка у нас.")).toBeVisible();
    expect(findLead(E2E_DB, name)?.source).toBe("visit");
  });

  test("ловушка для ботов: заполненное скрытое поле — «успех» без записи", async ({ page }) => {
    await page.goto("/ru#brief");
    const form = brief(page);
    const name = uniqueName();
    await fillRequired(form, name);
    await form.locator('input[name="website"]').fill("http://spam.example");
    await form.getByRole("button", { name: "Отправить бриф" }).click();
    await expect(page.getByText("Спасибо! Заявка у нас.")).toBeVisible();
    expect(findLead(E2E_DB, name)).toBeUndefined();
  });
});

test("при падении уведомлений заявка в базе и срабатывает алерт", async ({ page }) => {
  await page.goto(`http://localhost:${FAILING_PORT}/ru#brief`);
  const form = brief(page);
  const name = uniqueName();
  await fillRequired(form, name);
  await form.getByRole("button", { name: "Отправить бриф" }).click();
  // Пользователь получает успех сразу — уведомления идут в фоне.
  await expect(form.getByRole("status")).toContainText("Спасибо");

  const lead = findLead(E2E_FAILING_DB, name);
  expect(lead).toBeDefined();
  await expect
    .poll(
      () =>
        (
          db(E2E_FAILING_DB).prepare("SELECT kind FROM alerts WHERE lead_id = ?").get(lead!.id) as
            { kind: string } | undefined
        )?.kind,
      { timeout: 15_000 },
    )
    .toBe("notify-all-failed");
  const attempts = db(E2E_FAILING_DB)
    .prepare("SELECT count(*) AS c FROM notifications WHERE lead_id = ? AND status = 'failed'")
    .get(lead!.id) as { c: number };
  expect(attempts.c).toBe(3);
});
