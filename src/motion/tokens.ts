/*
 * Токены движения — CLAUDE.md, раздел 5. CSS-копия: src/styles/tokens.css (--duration-*, --ease-*,
 * --stagger-*). Расхождение ловит src/styles/tokens.test.ts.
 *
 * Все анимации считаются от delta-time в секундах, delta ограничена MAX_DELTA.
 * Появление в 1.5–2 раза дольше ухода. Упругих кривых с отскоком нет.
 */

/** Длительности, мс. */
export const duration = {
  instant: 120,
  quick: 240,
  base: 480,
  slow: 800,
  scene: 1200,
  ritual: 1800,
} as const;

export type DurationToken = keyof typeof duration;

export type CubicBezier = readonly [number, number, number, number];

/** Кривые (cubic-bezier). */
export const ease = {
  /** Появление. */
  steppe: [0.16, 1, 0.3, 1],
  /** Камера, линии. */
  horizon: [0.65, 0, 0.35, 1],
  /** Посадка деталей (последние 8% пути в Сборке). */
  settle: [0.22, 1, 0.36, 1],
  /** Циклы: дыхание, пар. */
  breath: [0.37, 0, 0.63, 1],
  /** Уход. */
  exit: [0.7, 0, 0.84, 0],
  ritual: [0.45, 0, 0.2, 1],
} as const satisfies Record<string, CubicBezier>;

export type EaseToken = keyof typeof ease;

/** Задержки между элементами, мс. */
export const stagger = { word: 40, line: 80, item: 120 } as const;

/** Максимальная delta кадра, с. Одинаковое поведение на 60 и 120 Гц. */
export const MAX_DELTA = 0.1;

export type ChapterTempoId =
  "dawn" | "assembly" | "day" | "dayKudalyk" | "fire" | "world" | "dawnAgain";

export interface ChapterTempo {
  /** Множитель длительностей. */
  readonly multiplier: number;
  /** Сглаживание камеры, с. */
  readonly cameraSmoothing: number;
}

/** Темп по главам. Кудалык — отдельное состояние Дня, замедленное. */
export const chapterTempo = {
  dawn: { multiplier: 1.3, cameraSmoothing: 0.45 },
  assembly: { multiplier: 1.0, cameraSmoothing: 0.35 },
  day: { multiplier: 0.8, cameraSmoothing: 0.25 },
  dayKudalyk: { multiplier: 1.6, cameraSmoothing: 0.6 },
  fire: { multiplier: 1.1, cameraSmoothing: 0.35 },
  world: { multiplier: 1.2, cameraSmoothing: 0.4 },
  dawnAgain: { multiplier: 1.3, cameraSmoothing: 0.45 },
} as const satisfies Record<ChapterTempoId, ChapterTempo>;

/** Кривая в виде строки CSS: `cubic-bezier(0.16, 1, 0.3, 1)`. */
export function cssEase(token: EaseToken): string {
  return `cubic-bezier(${ease[token].join(", ")})`;
}

/** Длительность с учётом темпа главы, мс. */
export function tempoDuration(token: DurationToken, chapter: ChapterTempoId): number {
  return Math.round(duration[token] * chapterTempo[chapter].multiplier);
}
