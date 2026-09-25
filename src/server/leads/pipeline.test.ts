import { DatabaseSync } from "node:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAlerter } from "./alert";
import { readLeadsConfig } from "./config";
import { deliverLead, type Notifier } from "./notify";
import { acceptLead } from "./pipeline";
import { SqliteLeadStore } from "./store";

const valid = {
  source: "brief",
  locale: "ru",
  eventType: "kudalyk",
  dateMode: "month",
  month: "6",
  guests: "50to150",
  venue: "ours",
  name: "Айгерим",
  phone: "+7 (701) 123-45-67",
  channel: "whatsapp",
  consent: "on",
  website: "",
};

function setup() {
  const path = join(mkdtempSync(join(tmpdir(), "leads-")), "test.sqlite");
  const store = new SqliteLeadStore(path);
  const config = readLeadsConfig({ NODE_ENV: "test", RATE_LIMIT_MAX: "3" });
  const log = vi.fn();
  const webhook = vi.fn(async () => new Response("ok"));
  const alert = createAlerter({
    store,
    webhookUrl: "https://alerts.example/hook",
    fetchImpl: webhook as unknown as typeof fetch,
    log,
  });
  const db = new DatabaseSync(path);
  const count = (table: string) =>
    (db.prepare(`SELECT count(*) AS c FROM ${table}`).get() as { c: number }).c;
  return { store, config, alert, log, webhook, db, count };
}

const ctx = (ip = "10.0.0.1") => ({ ip, now: new Date("2026-09-25T10:00:00Z") });

describe("приём заявки: порядок раздела 9", () => {
  let env: ReturnType<typeof setup>;
  beforeEach(() => {
    env = setup();
  });

  it("валидная заявка записывается в базу с нормализованным телефоном", () => {
    const result = acceptLead(valid, ctx(), env);
    expect(result.status).toBe("success");
    if (result.status !== "success" || !result.lead) throw new Error("нет заявки");
    const stored = env.store.getLead(result.lead.id);
    expect(stored?.phone).toBe("+77011234567");
    expect(stored?.eventType).toBe("kudalyk");
    expect(stored?.month).toBe("6");
    expect(stored?.consentAt).toBeTruthy();
  });

  it("обязательны только имя, телефон и согласие", () => {
    const result = acceptLead({}, ctx(), env);
    expect(result).toEqual({
      status: "invalid",
      errors: { name: "required", phone: "required", consent: "consent" },
    });
    const minimal = acceptLead({ name: "Ас", phone: "87011234567", consent: "on" }, ctx(), env);
    expect(minimal.status).toBe("success");
  });

  it("проверяет формат полей", () => {
    const result = acceptLead(
      { ...valid, phone: "123", eventType: "rave", channel: "email", date: "завтра" },
      ctx(),
      env,
    );
    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") return;
    expect(result.errors).toMatchObject({
      phone: "invalid",
      eventType: "invalid",
      email: "required",
    });
  });

  it("согласие не может быть пустым или другим значением", () => {
    for (const consent of ["", "off", undefined]) {
      const result = acceptLead({ ...valid, consent }, ctx(), env);
      expect(result).toMatchObject({ status: "invalid", errors: { consent: "consent" } });
    }
  });

  it("сначала zod, потом honeypot: невалидная форма бота получает ошибки", () => {
    const result = acceptLead({ ...valid, name: "", website: "spam" }, ctx(), env);
    expect(result.status).toBe("invalid");
  });

  it("honeypot: «успех» без записи в базу и без расхода лимита", () => {
    const result = acceptLead({ ...valid, website: "http://spam" }, ctx(), env);
    expect(result).toEqual({ status: "success", lead: null });
    expect(env.count("leads")).toBe(0);
    expect(env.count("rate_limits")).toBe(0);
  });

  it("rate limit по IP: после лимита — отказ без записи, другой IP проходит", () => {
    for (let i = 0; i < 3; i++) expect(acceptLead(valid, ctx(), env).status).toBe("success");
    expect(acceptLead(valid, ctx(), env).status).toBe("rateLimited");
    expect(env.count("leads")).toBe(3);
    expect(acceptLead(valid, ctx("10.0.0.2"), env).status).toBe("success");
    // IP не хранится в открытом виде.
    const keys = env.db.prepare("SELECT key FROM rate_limits").all() as { key: string }[];
    expect(keys.every(({ key }) => /^[0-9a-f]{64}$/.test(key))).toBe(true);
  });

  it("ошибка базы: понятный статус и алерт", () => {
    const broken = {
      ...env,
      store: Object.assign(Object.create(env.store), {
        insertLead: () => {
          throw new Error("disk full");
        },
      }),
    };
    const result = acceptLead(valid, ctx(), broken);
    expect(result).toEqual({ status: "error" });
    expect(env.log).toHaveBeenCalledWith(expect.stringContaining("store-failed"));
  });
});

describe("фоновые уведомления", () => {
  it("доставляет во все каналы и пишет попытки в базу", async () => {
    const env = setup();
    const result = acceptLead(valid, ctx(), env);
    if (result.status !== "success" || !result.lead) throw new Error();
    const sent: string[] = [];
    const ok = (channel: string): Notifier => ({
      channel,
      send: async () => void sent.push(channel),
    });

    const outcome = await deliverLead(result.lead, {
      notifiers: [ok("telegram"), ok("email")],
      store: env.store,
      alert: env.alert,
      attempts: 3,
      baseDelayMs: 1000,
      sleep: async () => {},
    });
    expect(outcome).toEqual({
      delivered: expect.arrayContaining(["telegram", "email"]),
      failed: [],
    });
    expect(env.count("notifications")).toBe(2);
    expect(env.count("alerts")).toBe(0);
  });

  it("при падении всех уведомлений: 3 попытки с экспоненциальной задержкой, заявка в базе, алерт", async () => {
    const env = setup();
    const result = acceptLead(valid, ctx(), env);
    if (result.status !== "success" || !result.lead) throw new Error();
    const delays: number[] = [];
    const failing = (channel: string): Notifier => ({
      channel,
      send: async () => {
        throw new Error(`${channel} down`);
      },
    });

    const outcome = await deliverLead(result.lead, {
      notifiers: [failing("telegram"), failing("email")],
      store: env.store,
      alert: env.alert,
      attempts: 3,
      baseDelayMs: 1000,
      sleep: async (ms) => void delays.push(ms),
    });

    expect(outcome.failed.sort()).toEqual(["email", "telegram"]);
    // Заявка на месте.
    expect(env.store.getLead(result.lead.id)?.name).toBe("Айгерим");
    // 3 попытки на канал, задержки 1 с и 2 с.
    expect(env.count("notifications")).toBe(6);
    expect(delays.sort()).toEqual([1000, 1000, 2000, 2000]);
    // Алерт: в базе, в логе и во внешнем вебхуке — без персональных данных.
    const alerts = env.db.prepare("SELECT kind, lead_id, message FROM alerts").all() as {
      kind: string;
      lead_id: string;
      message: string;
    }[];
    expect(alerts).toEqual([
      {
        kind: "notify-all-failed",
        lead_id: result.lead.id,
        message: expect.stringContaining("3 попыток"),
      },
    ]);
    expect(env.webhook).toHaveBeenCalledTimes(1);
    const logged = env.log.mock.calls.flat().join("\n");
    expect(logged).not.toContain("Айгерим");
    expect(logged).not.toContain("7011234567");
  });

  it("канал восстановился со второй попытки — алерта нет", async () => {
    const env = setup();
    const result = acceptLead(valid, ctx(), env);
    if (result.status !== "success" || !result.lead) throw new Error();
    let calls = 0;
    const flaky: Notifier = {
      channel: "telegram",
      send: async () => {
        if (++calls === 1) throw new Error("timeout");
      },
    };
    const outcome = await deliverLead(result.lead, {
      notifiers: [flaky],
      store: env.store,
      alert: env.alert,
      attempts: 3,
      baseDelayMs: 10,
      sleep: async () => {},
    });
    expect(outcome.delivered).toEqual(["telegram"]);
    expect(env.count("alerts")).toBe(0);
  });

  it("нет ни одного настроенного канала — алерт", async () => {
    const env = setup();
    const result = acceptLead(valid, ctx(), env);
    if (result.status !== "success" || !result.lead) throw new Error();
    await deliverLead(result.lead, {
      notifiers: [],
      store: env.store,
      alert: env.alert,
      attempts: 3,
      baseDelayMs: 10,
    });
    expect(env.log).toHaveBeenCalledWith(expect.stringContaining("notify-not-configured"));
  });
});

describe("конфиг", () => {
  it("в разработке уведомления — мок, в production — live", () => {
    expect(readLeadsConfig({ NODE_ENV: "development" }).notify.transport).toBe("mock");
    expect(readLeadsConfig({ NODE_ENV: "production" }).notify.transport).toBe("live");
    expect(
      readLeadsConfig({ NODE_ENV: "production", NOTIFY_TRANSPORT: "mock" }).notify.transport,
    ).toBe("mock");
  });

  it("неизвестное хранилище — явная ошибка, а не молчаливый SQLite", () => {
    expect(() => readLeadsConfig({ LEADS_STORAGE: "postgres" })).toThrow(/TODO\(legal\)/);
  });
});
