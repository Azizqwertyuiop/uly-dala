import { PHASE } from "./camera";

/*
 * Таймлайн главы «Огонь» (CLAUDE.md, раздел 2): чистые функции прогресса дорожки p.
 * - Переход «День → Огонь»: вечерний свет стягивается в уголь очага (сфера свечения
 *   сжимается от «весь кадр» до размера углей).
 * - Закат → ночь по прогрессу главы; очаг становится главным светом.
 * - Тёплая палитра впервые; --ember в 3D шире, в интерфейсе по-прежнему ≤ 2%.
 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};

/** Радиус свечения в начале (м) — больше кадра; в конце — угли. */
export const GLOW_FROM = 14;
export const GLOW_TO = 0.32;

export type FireLight = {
  /** Свечение перехода: радиус (м) и сила 0…1. */
  glowRadius: number;
  glow: number;
  sunElevation: number;
  dusk: number;
  night: number;
  exposure: number;
  /** Сила точечного света очага (без мерцания; мерцание — в сцене, медленное). */
  hearth: number;
};

export function createFireLight(): FireLight {
  return {
    glowRadius: GLOW_FROM,
    glow: 1,
    sunElevation: -2,
    dusk: 1,
    night: 0,
    exposure: 1,
    hearth: 0,
  };
}

export function computeFireLight(p: number, out: FireLight): FireLight {
  const g = smooth(PHASE.gather[0], PHASE.gather[1], p);
  // Радиус — в логарифме: свет «стягивается» равномерно, а не падает в конце.
  out.glowRadius = Math.exp(Math.log(GLOW_FROM) + (Math.log(GLOW_TO) - Math.log(GLOW_FROM)) * g);
  // Свет «собирается»: вначале — тёплая дымка на весь кадр, к углю — плотнее.
  out.glow = (0.03 + 0.45 * g) * (1 - smooth(PHASE.gather[1] * 0.8, PHASE.gather[1] * 1.6, p));
  out.night = smooth(0.08, 0.75, p);
  out.sunElevation = -2 - 12 * smooth(0, 0.8, p);
  out.dusk = 1;
  // Пока свет собирается в уголь, кадр чуть темнеет, затем держится.
  out.exposure = 1 - 0.1 * g + 0.06 * out.night;
  out.hearth = 1.5 + 6.5 * out.night;
  return out;
}
