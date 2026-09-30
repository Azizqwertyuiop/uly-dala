/*
 * Глава 5 «Этот мир существует» — таймлайн фазенды (чистые функции, без three.js).
 * Дорожка 0…1: сначала переход «свет» (кадр проявляется по яркости — огни, огонь, затем тени),
 * потом облёт с остановками в четырёх зонах. На остановке камера почти стоит (медленный наезд),
 * между зонами — переезд. Позиция облёта s ∈ [0, 3] — общая для сплатов и для видео облёта.
 */

export const WORLD_ZONES = ["field", "tent", "yurt", "kitchen"] as const;
export type WorldZone = (typeof WORLD_ZONES)[number];

/** Центры зон (x, z, м) — как в заглушке сплатов (scripts/lib/fazenda-zones.mjs). */
export const ZONE_POSITIONS: Record<WorldZone, readonly [number, number]> = {
  field: [0, 0],
  tent: [-7, -9],
  yurt: [6, -12],
  kitchen: [0, -19],
};

/** Видео облёта: длина и время каждой зоны, с (scripts/lib/flyover-frames.mjs). */
export const FLYOVER_SECONDS = 12;
export const FLYOVER_ZONES = [1.5, 4.5, 7.5, 10.5] as const;

/** Доля дорожки на переход «свет». */
export const LIGHT_END = 0.16;
/** Доля отрезка зоны, на которой камера «стоит». */
const HOLD = 0.6;
/** Медленный наезд на остановке — сдвиг позиции облёта, в долях расстояния между зонами. */
const DRIFT = 0.08;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** Переход «свет»: 0 — фазенды не видно, 1 — кадр целиком. */
export const worldLight = (p: number) => smooth(p / LIGHT_END);

/**
 * Позиция облёта s ∈ [0, 3] по прогрессу дорожки: зона k — s ≈ k.
 * Отрезок зоны: остановка (HOLD) с наездом ±DRIFT, по краям — половины переездов.
 * Непрерывна и не убывает — скролл назад ведёт камеру ровно тем же путём.
 */
export function flyoverPosition(p: number): number {
  const n = WORLD_ZONES.length;
  const span = (1 - LIGHT_END) / n;
  const x = (p - LIGHT_END) / span; // 0…n
  if (x <= 0) return -DRIFT;
  if (x >= n) return n - 1 + DRIFT;
  const k = Math.floor(x);
  const u = x - k; // 0…1 внутри отрезка зоны k
  const a = (1 - HOLD) / 2;
  const b = a + HOLD;
  if (u >= a && u <= b) return k - DRIFT + ((u - a) / HOLD) * 2 * DRIFT;
  // Переезд: вторая половина — от k−1 к k (u < a), первая — от k к k+1 (u > b).
  if (u < a) {
    if (k === 0) return -DRIFT;
    const w = 0.5 + (u / a) * 0.5;
    return k - 1 + DRIFT + smooth(w) * (1 - 2 * DRIFT);
  }
  if (k === n - 1) return k + DRIFT;
  const w = ((u - b) / a) * 0.5;
  return k + DRIFT + smooth(w) * (1 - 2 * DRIFT);
}

/** Ближайшая зона (для плашек в DOM). */
export const zoneAt = (s: number) => Math.min(WORLD_ZONES.length - 1, Math.max(0, Math.round(s)));

/** Время видео облёта для позиции s: зоны — в FLYOVER_ZONES, между ними — линейно. */
export function flyoverTime(s: number): number {
  const step = FLYOVER_ZONES[1] - FLYOVER_ZONES[0];
  const t = FLYOVER_ZONES[0] + s * step;
  return Math.min(FLYOVER_SECONDS - 0.05, Math.max(0, t));
}

/** Точка съёмки и цель взгляда зоны: камера на 1,6 м, в 18 м перед центром зоны. */
export function zoneView(zone: WorldZone) {
  const [x, z] = ZONE_POSITIONS[zone];
  return {
    position: [x, 1.6, z + 18] as const,
    target: [x, 1.4, z] as const,
  };
}
