import {
  ANALYTICS_ENDPOINT,
  type EventBatch,
  type EventContext,
  type EventMap,
  type EventName,
  type TrackedEvent,
} from "./events";

/*
 * track(event, props) — собственная аналитика без cookie и без хранилища на устройстве
 * (поэтому баннер согласия не нужен — обоснование в docs/analytics.md).
 * - События копятся и уходят пакетом: через 2 с тишины и при уходе со страницы (sendBeacon).
 * - Отладка: window.__events (последние 200), с ?debug — ещё и в консоль.
 * - Global Privacy Control / Do Not Track: события не отправляются (в отладке видны).
 */

const FLUSH_DELAY_MS = 2000;
const MAX_BATCH = 20;
const MAX_QUEUE = 100;
const DEBUG_KEEP = 200;

type DebugWindow = Window & { __events?: TrackedEvent[] };

const queue: TrackedEvent[] = [];
let timer: number | null = null;
let listening = false;
/** Случайный id просмотра страницы — только в памяти, не сохраняется. */
let pageView = "";

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

export function pageViewId(): string {
  if (!pageView) pageView = randomId();
  return pageView;
}

/** Общие свойства: язык по пути (на /kk текст пока русский, но язык страницы — kk), без query. */
export function eventContext(): EventContext {
  const html = document.documentElement;
  const path = window.location.pathname.slice(0, 120);
  const locale = path.split("/")[1] || "ru";
  const q = html.dataset.quality;
  return {
    locale: locale === "kk" || locale === "en" ? locale : "ru",
    path,
    quality: q === "high" || q === "medium" || q === "fallback" ? q : "pending",
    mode: html.dataset.mode === "brief" ? "brief" : "cinematic",
  };
}

function sendingAllowed(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.globalPrivacyControl !== true && nav.doNotTrack !== "1";
}

function debugEnabled(): boolean {
  return new URLSearchParams(window.location.search).has("debug");
}

/** Отправить накопленное. На уходе со страницы — sendBeacon (переживает закрытие вкладки). */
export function flush(): void {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const events = queue.splice(0, queue.length);
  if (!sendingAllowed()) return;
  for (let i = 0; i < events.length; i += MAX_BATCH) {
    const batch: EventBatch = { pv: pageViewId(), events: events.slice(i, i + MAX_BATCH) };
    postJson(ANALYTICS_ENDPOINT, batch);
  }
}

/** POST JSON: sendBeacon, иначе fetch с keepalive. Ошибки сети молча игнорируются. */
export function postJson(url: string, body: unknown): void {
  const json = JSON.stringify(body);
  try {
    const blob = new Blob([json], { type: "application/json" });
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url, blob)) return;
  } catch {
    // Нет sendBeacon — ниже fetch.
  }
  void fetch(url, {
    method: "POST",
    body: json,
    headers: { "content-type": "application/json" },
    keepalive: true,
  }).catch(() => {});
}

function listen() {
  if (listening) return;
  listening = true;
  const onHide = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", flush);
}

export function track<N extends EventName>(name: N, props: EventMap[N]): void {
  if (typeof window === "undefined") return;
  const event = {
    name,
    props,
    t: Math.round(performance.now()),
    ...eventContext(),
  } as TrackedEvent;

  const w = window as DebugWindow;
  const log = (w.__events ??= []);
  log.push(event);
  if (log.length > DEBUG_KEEP) log.splice(0, log.length - DEBUG_KEEP);
  if (debugEnabled()) console.debug("[analytics]", name, props);

  listen();
  queue.push(event);
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
  if (timer !== null) window.clearTimeout(timer);
  // Страница уже скрыта (web-vitals сообщает LCP/CLS/INP именно тогда) — отправить сразу.
  if (document.visibilityState === "hidden") flush();
  else timer = window.setTimeout(flush, FLUSH_DELAY_MS);
}
