import { ticker } from "./ticker";

/*
 * Единый источник прогресса (CLAUDE.md, раздел 7): глобальный прогресс, текущая глава,
 * локальный прогресс внутри главы, скорость и направление прокрутки.
 *
 * В кадре (фаза progress) читается только scrollY. Границы глав измеряются при ресайзе —
 * только при смене ширины и при изменении содержимого (ResizeObserver), высота экрана — в svh:
 * появление и скрытие адресной строки на телефоне прогресс не дёргает.
 */

export type ChapterBound = { id: string; top: number; height: number };

export type ProgressState = {
  scrollY: number;
  maxScroll: number;
  viewportHeight: number;
  /** 0…1 по всей странице. */
  global: number;
  chapterIndex: number;
  chapterId: string | null;
  /** 0…1 внутри текущей главы. */
  local: number;
  /** Положение на навигации-горизонте: 0 — первая отметка, 1 — последняя. */
  horizon: number;
  /** Скорость прокрутки, px/с (сглаженная). */
  velocity: number;
  /** 1 — вниз, −1 — вверх, 0 — ещё не понятно. С гистерезисом. */
  direction: -1 | 0 | 1;
};

/** Сдвиг, после которого меняется направление (шум тачпада и инерции), px. */
export const DIRECTION_THRESHOLD = 6;
/** Сглаживание скорости, с. */
const VELOCITY_SMOOTHING = 0.1;

export function createProgressState(): ProgressState {
  return {
    scrollY: 0,
    maxScroll: 0,
    viewportHeight: 0,
    global: 0,
    chapterIndex: 0,
    chapterId: null,
    local: 0,
    horizon: 0,
    velocity: 0,
    direction: 0,
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Внутреннее состояние для направления: точка, от которой считается сдвиг. */
export type DirectionAnchor = { y: number };

/**
 * Один шаг расчёта. Чистая функция по смыслу: пишет в out, память не выделяет.
 * Текущая глава — та, чей верх уже прошёл середину экрана; в самом низу страницы — последняя.
 * Локальный прогресс 0…1 — от момента, когда глава стала текущей, до следующей главы.
 */
export function computeProgress(
  out: ProgressState,
  anchor: DirectionAnchor,
  scrollY: number,
  bounds: readonly ChapterBound[],
  viewportHeight: number,
  maxScroll: number,
  dt: number,
): void {
  const previous = out.scrollY;
  out.scrollY = scrollY;
  out.maxScroll = maxScroll;
  out.viewportHeight = viewportHeight;
  out.global = maxScroll > 0 ? clamp01(scrollY / maxScroll) : 0;

  if (dt > 0) {
    const raw = (scrollY - previous) / dt;
    const k = 1 - Math.exp(-dt / VELOCITY_SMOOTHING);
    out.velocity += (raw - out.velocity) * k;
  }

  const moved = scrollY - anchor.y;
  if (moved > DIRECTION_THRESHOLD) {
    out.direction = 1;
    anchor.y = scrollY;
  } else if (moved < -DIRECTION_THRESHOLD) {
    out.direction = -1;
    anchor.y = scrollY;
  } else if (out.direction === 1 && scrollY > anchor.y) {
    anchor.y = scrollY;
  } else if (out.direction === -1 && scrollY < anchor.y) {
    anchor.y = scrollY;
  }

  const n = bounds.length;
  if (n === 0) {
    out.chapterIndex = 0;
    out.chapterId = null;
    out.local = out.global;
    out.horizon = out.global;
    return;
  }

  // Глава i становится текущей, когда её верх доходит до середины экрана:
  // start(i) = top(i) − vh/2 (у первой — 0), конец участка — начало следующей (у последней — низ).
  const half = viewportHeight * 0.5;
  const start = (i: number) => (i === 0 ? 0 : Math.max(0, bounds[i]!.top - half));
  const atEnd = maxScroll > 0 && scrollY >= maxScroll - 1;
  let index = 0;
  if (atEnd) {
    index = n - 1;
  } else {
    for (let i = 0; i < n; i++) if (start(i) <= scrollY) index = i;
  }
  const from = start(index);
  const to = index === n - 1 ? Math.max(maxScroll, from) : start(index + 1);
  out.chapterIndex = index;
  out.chapterId = bounds[index]!.id;
  out.local = atEnd ? 1 : to > from ? clamp01((scrollY - from) / (to - from)) : 0;
  out.horizon = n > 1 ? clamp01((index + out.local) / (n - 1)) : out.global;
}

// ---------------------------------------------------------------------------
// Браузерная обвязка
// ---------------------------------------------------------------------------

export const progress: ProgressState = createProgressState();

type ChapterListener = (index: number, id: string | null) => void;
const chapterListeners = new Set<ChapterListener>();

/** Подписка на смену главы (для React: aria-current, кнопка WhatsApp). Сразу получает текущую. */
export function onChapterChange(listener: ChapterListener): () => void {
  chapterListeners.add(listener);
  if (started) listener(progress.chapterIndex, progress.chapterId);
  return () => chapterListeners.delete(listener);
}

let bounds: ChapterBound[] = [];
let started = false;
/** −1 — сообщить подписчикам в ближайшем кадре (после перемера глав). */
let lastIndex = -1;

/** Измеряет главы и высоту экрана (svh). Вызывается только при ресайзе и смене содержимого. */
export function measureChapters(): void {
  const probe = document.getElementById("svh-probe");
  const viewportHeight = probe?.getBoundingClientRect().height || window.innerHeight;
  const scrollY = window.scrollY;
  bounds = [...document.querySelectorAll<HTMLElement>("main section[data-chapter]")].map((el) => {
    const rect = el.getBoundingClientRect();
    return { id: el.dataset.chapter ?? el.id, top: rect.top + scrollY, height: rect.height };
  });
  const docHeight = document.documentElement.scrollHeight;
  progress.viewportHeight = viewportHeight;
  progress.maxScroll = Math.max(0, docHeight - window.innerHeight);
  // Набор глав мог смениться (переход между страницами) — оповестить подписчиков.
  lastIndex = -1;
}

/** Запуск: один раз на страницу. Возвращает остановку (для тестов и HMR). */
export function startProgress(): () => void {
  if (started) return () => {};
  started = true;

  // Пробник высоты экрана в svh — не меняется от адресной строки.
  let svh = document.getElementById("svh-probe");
  if (!svh) {
    svh = document.createElement("div");
    svh.id = "svh-probe";
    svh.setAttribute("aria-hidden", "true");
    svh.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none";
    document.body.appendChild(svh);
  }

  const anchor: DirectionAnchor = { y: window.scrollY };
  progress.scrollY = window.scrollY;
  measureChapters();

  let width = window.innerWidth;
  const onResize = () => {
    if (window.innerWidth === width) return; // только высота — это адресная строка
    width = window.innerWidth;
    measureChapters();
  };
  const resizeObserver = new ResizeObserver(() => measureChapters());
  resizeObserver.observe(document.body);
  window.addEventListener("resize", onResize, { passive: true });
  void document.fonts?.ready.then(measureChapters);

  const off = ticker.add("progress", (dt) => {
    computeProgress(
      progress,
      anchor,
      window.scrollY,
      bounds,
      progress.viewportHeight,
      progress.maxScroll,
      dt,
    );
    if (progress.chapterIndex !== lastIndex) {
      lastIndex = progress.chapterIndex;
      chapterListeners.forEach((l) => l(progress.chapterIndex, progress.chapterId));
    }
  });

  return () => {
    off();
    resizeObserver.disconnect();
    window.removeEventListener("resize", onResize);
    started = false;
  };
}

/** Границы глав в документе (только чтение; обновляются при ресайзе). */
export function chapterBounds(): readonly ChapterBound[] {
  return bounds;
}

/** Прокрутка, с которой глава i становится текущей (её верх — на середине экрана). */
export function chapterStartScroll(index: number): number {
  const b = bounds[index];
  if (!b) return 0;
  return index === 0 ? 0 : Math.max(0, b.top - progress.viewportHeight * 0.5);
}

/** Есть ли на странице главы (главная) — для компонентов, которым это важно. */
export function hasChapters(): boolean {
  return bounds.length > 0;
}
