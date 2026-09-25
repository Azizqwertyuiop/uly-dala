import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Lead, StoredLead } from "./types";

/*
 * Хранилище заявок. Интерфейс не зависит от базы: при решении юриста (раздел 14) добавляется
 * другая реализация LeadStore, остальной код не меняется.
 */
export interface LeadStore {
  insertLead(lead: Lead, meta: { id: string; createdAt: Date }): StoredLead;
  getLead(id: string): StoredLead | null;
  logNotification(entry: {
    leadId: string;
    channel: string;
    attempt: number;
    status: "sent" | "failed";
    error?: string;
  }): void;
  logAlert(entry: { leadId: string | null; kind: string; message: string }): void;
  /** true — запрос разрешён; false — превышен лимит. */
  hitRateLimit(key: string, now: number, windowMs: number, max: number): boolean;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL,
  locale TEXT NOT NULL,
  event_type TEXT, date_mode TEXT, month TEXT, date TEXT, guests TEXT, venue TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  channel TEXT, email TEXT, comment TEXT,
  consent_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
`;

type Row = Record<string, string | number | null>;

function toStored(row: Row): StoredLead {
  const opt = (v: string | number | null | undefined) => (v == null ? undefined : String(v));
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    source: row.source as StoredLead["source"],
    locale: row.locale as StoredLead["locale"],
    eventType: opt(row.event_type) as StoredLead["eventType"],
    dateMode: opt(row.date_mode) as StoredLead["dateMode"],
    month: opt(row.month) as StoredLead["month"],
    date: opt(row.date),
    guests: opt(row.guests) as StoredLead["guests"],
    venue: opt(row.venue) as StoredLead["venue"],
    name: String(row.name),
    phone: String(row.phone),
    channel: opt(row.channel) as StoredLead["channel"],
    email: opt(row.email),
    comment: opt(row.comment),
    consentAt: String(row.consent_at),
  };
}

export class SqliteLeadStore implements LeadStore {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(SCHEMA);
  }

  insertLead(lead: Lead, meta: { id: string; createdAt: Date }): StoredLead {
    const at = meta.createdAt.toISOString();
    this.db
      .prepare(
        `INSERT INTO leads (id, created_at, source, locale, event_type, date_mode, month, date,
          guests, venue, name, phone, channel, email, comment, consent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        meta.id,
        at,
        lead.source,
        lead.locale,
        lead.eventType ?? null,
        lead.dateMode ?? null,
        lead.month ?? null,
        lead.date ?? null,
        lead.guests ?? null,
        lead.venue ?? null,
        lead.name,
        lead.phone,
        lead.channel ?? null,
        lead.email ?? null,
        lead.comment ?? null,
        at,
      );
    return { ...lead, id: meta.id, createdAt: at, consentAt: at };
  }

  getLead(id: string): StoredLead | null {
    const row = this.db.prepare("SELECT * FROM leads WHERE id = ?").get(id) as Row | undefined;
    return row ? toStored(row) : null;
  }

  logNotification(entry: Parameters<LeadStore["logNotification"]>[0]) {
    this.db
      .prepare(
        "INSERT INTO notifications (lead_id, channel, attempt, status, error) VALUES (?, ?, ?, ?, ?)",
      )
      .run(entry.leadId, entry.channel, entry.attempt, entry.status, entry.error ?? null);
  }

  logAlert(entry: Parameters<LeadStore["logAlert"]>[0]) {
    this.db
      .prepare("INSERT INTO alerts (lead_id, kind, message) VALUES (?, ?, ?)")
      .run(entry.leadId, entry.kind, entry.message);
  }

  hitRateLimit(key: string, now: number, windowMs: number, max: number): boolean {
    const row = this.db
      .prepare("SELECT window_start, count FROM rate_limits WHERE key = ?")
      .get(key) as { window_start: number; count: number } | undefined;
    if (!row || now - row.window_start >= windowMs) {
      this.db
        .prepare(
          `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
           ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = 1`,
        )
        .run(key, now);
      return true;
    }
    if (row.count >= max) return false;
    this.db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").run(key);
    return true;
  }
}
