import { expect, test, type Page } from "@playwright/test";

/*
 * Аналитика, мониторинг и заголовки безопасности (CLAUDE.md, раздел 14).
 * - События видны в отладке (window.__events, с ?debug — в консоли) и уходят на /api/t (204).
 * - Эмуляция ошибок WebGL (потеря контекста, сбой сборки шейдера) → fallback + событие на /api/m.
 * - Заголовки: CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy; CSP не ломает 3D-главы.
 */

type Ev = { name: string; props: Record<string, unknown>; quality: string; path: string };
const events = (page: Page) =>
  page.evaluate(() => (window as unknown as { __events?: Ev[] }).__events ?? []);
const names = async (page: Page) => (await events(page)).map((e) => e.name);

/** Эмуляция ухода со страницы: так браузер отправляет пакет и web-vitals сообщает LCP/CLS. */
const hide = (page: Page) =>
  page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });

const menuButton = (page: Page) => page.locator('header button[aria-haspopup="dialog"]');

/*
 * Тела отправок на эндпоинт. sendBeacon в Playwright уходит без тела в request.postData(),
 * поэтому тела записываются в странице (обёртка sendBeacon/fetch до загрузки скриптов сайта).
 */
async function collect(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __sent: { url: string; body: string }[] };
    w.__sent = [];
    const beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      if (data instanceof Blob)
        void data.text().then((body) => w.__sent.push({ url: String(url), body }));
      return beacon(url, data);
    };
  });
}
const sent = async <T>(page: Page, path: string): Promise<T[]> =>
  (
    await page.evaluate(
      () => (window as unknown as { __sent: { url: string; body: string }[] }).__sent,
    )
  )
    .filter((s) => new URL(s.url, "http://x").pathname === path)
    .map((s) => JSON.parse(s.body) as T);

test.describe("аналитика: события видны в отладке и принимаются сервером", () => {
  test("развилка, CTA с главой, меню, звук, «Коротко», бриф по полям, ошибка, без персональных данных", async ({
    page,
  }) => {
    const debugLines: string[] = [];
    page.on("console", (m) => {
      if (m.text().startsWith("[analytics]")) debugLines.push(m.text());
    });
    await collect(page);
    const accepted = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/t" && r.status() === 204,
    );
    await page.goto("/ru?debug&quality=fallback");
    await expect(page.locator("html")).toHaveAttribute("data-quality", "fallback");

    // Развилка и CTA «Обсудить событие» главы «Сборка».
    await page.locator("#assembly").getByRole("link", { name: "Семейное торжество" }).click();
    await page.locator("#fire").getByRole("link", { name: /меню/i }).first().click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Закрыть/ })
      .first()
      .click();

    // Меню: звук и «Коротко».
    await menuButton(page).click();
    const menu = page.getByRole("dialog");
    await menu.getByRole("button", { name: /Звук/ }).click();
    await menu.getByRole("button", { name: /Коротко/ }).click();
    await page.keyboard.press("Escape");

    // Бриф: начало, поля, отправка с ошибкой.
    const form = page.locator("#brief");
    // «Семейное торжество» уже предзаполнило тип события — выбираем другой.
    await form.getByRole("radio", { name: "Конференция" }).check();
    await form.getByLabel(/Как\s+вас\s+зовут/).fill("Айгерим");
    await form.getByLabel(/Ваш\s+номер\s+телефона/).fill("7011234567");
    await form.getByRole("button", { name: "Отправить бриф" }).click();
    await expect(form.getByText("В форме есть ошибки")).toBeVisible();

    await expect
      .poll(() => names(page))
      .toEqual(
        expect.arrayContaining([
          "quality",
          "fork",
          "cta",
          "menu_open",
          "sound",
          "brief_mode",
          "brief_start",
          "brief_field",
          "brief_error",
        ]),
      );
    const list = await events(page);
    expect(list.find((e) => e.name === "fork")?.props).toEqual({ audience: "family" });
    expect(list.find((e) => e.name === "cta")?.props).toEqual({ cta: "menu", place: "fire" });
    expect(list.find((e) => e.name === "brief_mode")?.props).toEqual({ on: true });
    expect(list.filter((e) => e.name === "brief_field").map((e) => e.props)).toEqual(
      expect.arrayContaining([
        { form: "brief", field: "eventType", value: "conference" },
        { form: "brief", field: "name" },
        { form: "brief", field: "phone" },
      ]),
    );
    expect(list.find((e) => e.name === "brief_error")?.props).toMatchObject({
      form: "brief",
      kind: "invalid",
    });
    // Уровень качества — в каждом событии.
    for (const e of list) expect(e.quality).toBe("fallback");

    // В консоли с ?debug.
    expect(debugLines.some((l) => l.includes("fork"))).toBe(true);

    // Сервер принял пакет; ни имени, ни телефона в отправленном нет.
    await hide(page);
    await accepted;
    const body = JSON.stringify(await sent(page, "/api/t"));
    expect(body).toContain('"brief_field"');
    expect(body).not.toContain("Айгерим");
    expect(body).not.toMatch(/701\D?123/);
  });

  test("Core Web Vitals с уровнем качества; максимальная глава при уходе", async ({ page }) => {
    await collect(page);
    await page.goto("/ru?quality=fallback");
    await page.evaluate(() => {
      const top = document.getElementById("fire")!.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, top);
    });
    await expect.poll(() => names(page), { timeout: 10_000 }).toContain("web_vital");
    await page.mouse.click(5, 300); // взаимодействие — для INP
    await hide(page);
    await expect.poll(() => names(page)).toContain("scroll_depth");
    const list = await events(page);
    const vitals = list.filter((e) => e.name === "web_vital");
    expect(vitals.map((e) => e.props.metric)).toEqual(
      expect.arrayContaining(["FCP", "TTFB", "LCP"]),
    );
    for (const v of vitals) expect(v.quality).toBe("fallback");
    expect(list.find((e) => e.name === "scroll_depth")?.props).toMatchObject({
      chapter: "fire",
      of: 6,
    });
    await expect.poll(async () => JSON.stringify(await sent(page, "/api/t"))).toContain('"LCP"');
  });

  test("WhatsApp, скачивание презентации, запрос просмотра", async ({ page }) => {
    await page.goto("/ru/request/visit");
    const form = page.locator("form");
    await form.getByLabel(/Как\s+вас\s+зовут/).fill("Тест просмотра");
    await form.getByLabel(/Ваш\s+номер\s+телефона/).fill("7011234567");
    await form.getByLabel(/согласен\s+на\s+обработку/).check();
    await form.getByRole("button", { name: /Отправить/ }).click();
    await expect(page.locator("[data-brief-result=success]")).toBeVisible();
    await expect
      .poll(() => names(page))
      .toEqual(expect.arrayContaining(["brief_start", "brief_submit", "visit_request"]));

    await page.goto("/ru?quality=fallback");
    const download = page.locator("#day a[download]").first();
    await download.evaluate((a) => a.addEventListener("click", (e) => e.preventDefault()));
    await download.click();
    await expect.poll(() => names(page)).toContain("presentation_download");
    expect((await events(page)).find((e) => e.name === "presentation_download")?.props).toEqual({
      place: "day",
    });
  });

  test("сервер отклоняет чужие поля и персональные данные", async ({ request }) => {
    const base = { t: 1, locale: "ru", path: "/ru", quality: "high", mode: "cinematic" };
    const ok = await request.post("/api/t", {
      data: { pv: "pv-123456", events: [{ name: "sound", props: { on: true }, ...base }] },
    });
    expect(ok.status()).toBe(204);
    const pii = await request.post("/api/t", {
      data: {
        pv: "pv-123456",
        events: [
          { name: "brief_field", props: { form: "brief", field: "name", value: "Иван" }, ...base },
        ],
      },
    });
    expect(pii.status()).toBe(400);
    expect((await request.post("/api/m", { data: { tag: "js" } })).status()).toBe(400);
  });
});

test.describe("мониторинг: эмуляция ошибок WebGL → fallback + событие с тегом webgl", () => {
  test("потеря контекста без восстановления", async ({ page }) => {
    await collect(page);
    type Report = { tag: string; kind: string; quality: string };
    const reports = () => sent<Report>(page, "/api/m");
    const delivered = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/m" && r.status() === 204,
    );
    await page.goto("/ru?quality=high");
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 15_000 });
    await page.evaluate(() => {
      const canvas = document.querySelector("[data-canvas-root] canvas") as HTMLCanvasElement;
      (canvas.getContext("webgl2") as WebGL2RenderingContext)
        .getExtension("WEBGL_lose_context")!
        .loseContext();
    });
    await expect(page.locator("html")).toHaveAttribute("data-quality", "fallback", {
      timeout: 8_000,
    });
    await delivered;
    await expect
      .poll(async () => (await reports()).map((r) => `${r.tag}:${r.kind}`))
      .toEqual(expect.arrayContaining(["webgl:context_lost", "webgl:fallback"]));
    expect((await reports())[0]?.quality).toBe("high");
    expect((await events(page)).find((e) => e.props.tier === "fallback")?.props).toEqual({
      tier: "fallback",
      reason: "webglcontextlost",
    });
  });

  test("шейдер не собрался → fallback + событие", async ({ page }) => {
    await collect(page);
    const reports = () => sent<{ tag: string; kind: string }>(page, "/api/m");
    // Видеокарта «не смогла» собрать программы: LINK_STATUS = false.
    await page.addInitScript(() => {
      const patch = (proto: WebGLRenderingContext | WebGL2RenderingContext) => {
        const original = proto.getProgramParameter;
        proto.getProgramParameter = function (program: WebGLProgram, pname: number) {
          if (pname === this.LINK_STATUS) return false;
          return original.call(this, program, pname);
        };
      };
      patch(WebGL2RenderingContext.prototype);
      patch(WebGLRenderingContext.prototype);
    });
    await page.goto("/ru?quality=high");
    await expect(page.locator("html")).toHaveAttribute("data-quality", "fallback", {
      timeout: 15_000,
    });
    await expect(page.locator("[data-canvas-root] canvas")).toHaveCount(0);
    await expect
      .poll(async () => (await reports()).map((r) => `${r.tag}:${r.kind}`))
      .toContain("webgl:shader_link");
    expect((await events(page)).find((e) => e.props.tier === "fallback")?.props).toEqual({
      tier: "fallback",
      reason: "shader",
    });
    // Текст и CTA на месте.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("ошибка JS → отчёт без query и персональных данных", async ({ page }) => {
    await collect(page);
    const reports = () => sent<{ tag: string; message: string }>(page, "/api/m");
    await page.goto("/ru?quality=fallback&utm=secret");
    // Мониторинг подключён (уровень качества определён — страница гидрирована).
    await expect.poll(() => names(page)).toContain("quality");
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error("boom for a@b.kz at https://x.kz/a?token=1");
      });
    });
    await expect.poll(async () => (await reports()).length).toBeGreaterThan(0);
    const [report] = await reports();
    expect(report).toMatchObject({ tag: "js", path: "/ru" });
    expect(report!.message).toBe("Error: boom for [email] at https://x.kz/a");
  });
});

test.describe("заголовки безопасности", () => {
  test("на страницах и файлах — CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy", async ({
    request,
  }) => {
    for (const path of [
      "/ru",
      "/",
      "/en/fazenda",
      "/robots.txt",
      "/assets/decoders/basis/basis_transcoder.wasm",
    ]) {
      const h = (await request.get(path)).headers();
      expect(h["content-security-policy"], path).toContain("default-src 'self'");
      expect(h["content-security-policy"], path).not.toContain("'unsafe-eval'");
      expect(h["strict-transport-security"], path).toMatch(/max-age=\d+/);
      expect(h["x-content-type-options"], path).toBe("nosniff");
      expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
      expect(h["permissions-policy"], path).toContain("camera=()");
      expect(h["x-frame-options"], path).toBe("DENY");
    }
    // Воркер KTX2 — своя узкая политика: eval только в нём, сеть запрещена.
    const worker = (await request.get("/assets/decoders/basis/ktx2-worker.js")).headers();
    expect(worker["content-security-policy"]).toMatch(
      /^default-src 'none'; script-src 'self' 'unsafe-eval'/,
    );
  });

  test("CSP не ломает 3D: шейдеры, воркеры KTX2/meshopt, сплаты, видео — без нарушений", async ({
    page,
  }) => {
    // Проход всего сайта с 3D на процессоре (CI без видеокарты) — с запасом.
    test.setTimeout(240_000);
    const problems: string[] = [];
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (/Content Security Policy|Refused to/.test(m.text())) problems.push(m.text());
    });
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) =>
        console.error(`Refused to: ${e.effectiveDirective} ${e.blockedURI}`),
      );
    });
    await page.goto("/ru?quality=high");
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "ready", { timeout: 15_000 });
    type S = { compiled: string[]; world: { mode: string } };
    const stage = () => page.evaluate(() => (window as unknown as { __stage: S }).__stage);
    // Сцены грузятся и выгружаются по ходу (не дальше двух глав) — собираем все, что собрались.
    const compiled = new Set<string>();
    const modes = new Set<string>();
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 400) {
      await page.evaluate((y) => window.scrollTo(0, y), y);
      await page.waitForTimeout(250);
      const s = await stage();
      s.compiled.forEach((id) => compiled.add(id));
      if (s.world.mode) modes.add(s.world.mode);
    }
    await page.waitForTimeout(1500);
    (await stage()).compiled.forEach((id) => compiled.add(id));
    // Все сцены собрались — у «Дня» сцены нет, там фото (KTX2-текстуры декодированы воркером), фазенда — сплатами (воркер Spark).
    expect([...compiled].sort()).toEqual(["assembly", "dawn", "fire", "return", "world"]);
    expect([...modes]).toContain("splats");
    expect(await page.locator("html").getAttribute("data-quality")).toBe("high");
    expect(problems).toEqual([]);
  });
});
