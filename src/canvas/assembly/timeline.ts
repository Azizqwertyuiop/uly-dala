import { bezierEasing, bezierStartSlope } from "@/motion/bezier";
import { ease } from "@/motion/tokens";

/*
 * Таймлайн главы 2 «Сборка» (CLAUDE.md, раздел 2). Чистая функция прогресса дорожки p ∈ [0, 1]:
 * состояние каждой детали зависит только от p. Поэтому быстрый скролл не ломает порядок сборки,
 * а скролл назад полностью её разбирает — в обратном порядке, через те же состояния.
 *
 * Четыре этапа по 25%: кереге (гармошкой) → уықи (по очереди, сдвиг 3%) → шаңырақ (вертикально,
 * медленнее всех) → кийиз (войлок; заглушка VAT) и финал — столп света и работа своей техники.
 * Каждая деталь идёт по пути (дуге) 0 → 1; последние 8% пути — кривая settle.
 */

export const ASSEMBLY_STAGES = ["kerege", "uyki", "shanyrak", "kiiz"] as const;
export type AssemblyStage = (typeof ASSEMBLY_STAGES)[number];
export type AssemblyPhase = AssemblyStage | "pillar";

export const STAGE_SPAN = 1 / ASSEMBLY_STAGES.length;
export const KEREGE_PANELS = 4;
/** Жердей уықи в модели. TODO(assets): сверить с моделью художника (docs/assets.md). */
export const POLE_COUNT = 48;
/** Уықи ставятся парами — напротив друг друга, как при настоящей сборке. */
export const POLE_PAIRS = POLE_COUNT / 2;
/** Сдвиг между соседними парами уықи — 3% этапа. */
export const UYKI_STAGGER = 0.03;
/** Последние 8% пути — посадка (settle); на неё уходит 20% времени детали. */
export const SETTLE_PATH = 0.08;
export const SETTLE_TIME = 0.2;
/** С какой доли этапа «Кийиз» начинается финал со столпом света. */
export const PILLAR_FROM = 0.6;

export type AssemblyState = {
  /** 0…3 — текущий этап и прогресс внутри него. */
  stage: number;
  stageLocal: number;
  phase: AssemblyPhase;
  /** Прогресс времени каждой панели кереге 0…1 и раскрытие гармошки 0…1. */
  panels: Float32Array;
  accordion: Float32Array;
  /** Своя техника (экран, приборы, звук) — заносится вместе со стенами. */
  tech: number;
  /** Дверь-есік: приход и открытие. */
  door: number;
  doorOpen: number;
  /** Прогресс времени каждой жерди уықи 0…1. */
  poles: Float32Array;
  /** Шаңырақ: прогресс времени 0…1. */
  crown: number;
  /** Кийиз: доля укрытого каркаса (по пути, сверху вниз) 0…1. */
  cover: number;
  /** Финал: столп света и включённая техника 0…1. */
  pillar: number;
  techOn: number;
};

export function createAssemblyState(): AssemblyState {
  return {
    stage: 0,
    stageLocal: 0,
    phase: "kerege",
    panels: new Float32Array(KEREGE_PANELS),
    accordion: new Float32Array(KEREGE_PANELS),
    tech: 0,
    door: 0,
    doorOpen: 0,
    poles: new Float32Array(POLE_COUNT),
    crown: 0,
    cover: 0,
    pillar: 0,
    techOn: 0,
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
/** Доля времени детали: [start, start + length] внутри этапа → 0…1. */
export const window01 = (local: number, start: number, length: number) =>
  clamp01((local - start) / length);

const settle = bezierEasing(ease.settle);
const horizon = bezierEasing(ease.horizon);
const steppe = bezierEasing(ease.steppe);

/*
 * Путь детали: разгон «руками» (a·x + b·x²) до 92% пути, затем settle — последние 8%.
 * Скорость на стыке совпадает: без рывка и без остановки перед посадкой.
 */
const TRAVEL_TIME = 1 - SETTLE_TIME;
const TRAVEL_PATH = 1 - SETTLE_PATH;
const SETTLE_SPEED = (SETTLE_PATH * bezierStartSlope(ease.settle)) / SETTLE_TIME;
const B = clamp01((SETTLE_SPEED * TRAVEL_TIME) / TRAVEL_PATH - 1);
const A = 1 - B;

export function pathFraction(u: number): number {
  const t = clamp01(u);
  if (t < TRAVEL_TIME) {
    const x = t / TRAVEL_TIME;
    return TRAVEL_PATH * (A * x + B * x * x);
  }
  return TRAVEL_PATH + SETTLE_PATH * settle((t - TRAVEL_TIME) / SETTLE_TIME);
}

/**
 * Порядок пар уықи: «золотой» обход по кругу — каркас заполняется равномерно, без перекоса.
 * rank[пара] = очередь 0…POLE_PAIRS−1.
 */
export const POLE_RANK: readonly number[] = (() => {
  const pairs = Array.from({ length: POLE_PAIRS }, (_, j) => j);
  const order = [...pairs].sort((a, b) => ((a * 0.618034) % 1) - ((b * 0.618034) % 1));
  const rank = new Array<number>(POLE_PAIRS);
  order.forEach((pair, i) => (rank[pair] = i));
  return rank;
})();

/** Расписание внутри этапов (доли этапа). Всё успевает сесть до 0,9 — дальше тишина. */
export const SCHEDULE = {
  panel: { start: 0.04, step: 0.1, length: 0.46 },
  tech: { start: 0.5, length: 0.38 },
  door: { start: 0.54, length: 0.34 },
  pole: { start: 0.04, step: UYKI_STAGGER, length: 0.17 },
  crown: { start: 0.04, length: 0.84 },
  cover: { start: 0.04, length: 0.52 },
  doorOpen: { start: 0.56, length: 0.14 },
  pillar: { start: PILLAR_FROM, length: 0.3 },
  techOn: { start: 0.7, length: 0.22 },
} as const;

/** Состояние сборки по прогрессу дорожки p. Пишет в out, память не выделяет. */
export function computeAssembly(p: number, out: AssemblyState): AssemblyState {
  const x = clamp01(p);
  const stage = Math.min(ASSEMBLY_STAGES.length - 1, Math.floor(x / STAGE_SPAN));
  out.stage = stage;
  out.stageLocal = clamp01((x - stage * STAGE_SPAN) / STAGE_SPAN);
  // Локальный прогресс каждого этапа: прошедшие — 1, будущие — 0.
  const local = (i: number) => (i < stage ? 1 : i > stage ? 0 : out.stageLocal);
  const s = SCHEDULE;

  const lk = local(0);
  for (let k = 0; k < KEREGE_PANELS; k++) {
    const u = window01(lk, s.panel.start + k * s.panel.step, s.panel.length);
    out.panels[k] = u;
    // Гармошка раскрывается, когда панель уже почти на месте.
    out.accordion[k] = smoothstep(0.55, 1, u);
  }
  out.tech = window01(lk, s.tech.start, s.tech.length);
  out.door = window01(lk, s.door.start, s.door.length);

  const lu = local(1);
  for (let i = 0; i < POLE_COUNT; i++) {
    const rank = POLE_RANK[i % POLE_PAIRS]!;
    out.poles[i] = window01(lu, s.pole.start + rank * s.pole.step, s.pole.length);
  }

  out.crown = window01(local(2), s.crown.start, s.crown.length);

  const lz = local(3);
  out.cover = pathFraction(window01(lz, s.cover.start, s.cover.length));
  out.doorOpen = horizon(window01(lz, s.doorOpen.start, s.doorOpen.length));
  out.pillar = steppe(window01(lz, s.pillar.start, s.pillar.length));
  out.techOn = steppe(window01(lz, s.techOn.start, s.techOn.length));

  out.phase = stage === 3 && out.stageLocal >= PILLAR_FROM ? "pillar" : ASSEMBLY_STAGES[stage]!;
  return out;
}
