import { computeDawnState } from "../steppe/dawn";
import { ZONES_END } from "../world/timeline";

/*
 * Глава 6 «Снова рассвет» (CLAUDE.md, раздел 2) — чистые функции, без WebGL.
 * Переход из «Этот мир существует» (раздел 5): фазенда гаснет по яркости — огни уходят последними,
 * под ней уже ночная степь; дальше звёзды гаснут, горизонт светлеет, круг примятой травы
 * медленно поднимается. Последний кадр — первый кадр «Рассвета» без коня: петля.
 */

/** С какого прогресса дорожки фазенды она уступает место степи. */
export const HANDOFF_FROM = ZONES_END;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Уход фазенды: 0 — фазенда целиком, 1 — под ней только степь. */
export const handoff = (worldP: number) => smooth((worldP - HANDOFF_FROM) / (1 - HANDOFF_FROM));

/** Первый кадр сайта после интро (глава 1, local = 0): к нему приходит финал. */
export const FIRST_FRAME = computeDawnState({ local: 0, introTime: null, waveEnabled: false });

/** Ночь перед рассветом — как у фазенды: звёзды, солнце глубоко под горизонтом. */
export const NIGHT = { sunElevation: -7, groundFog: 0.35, exposure: 0.8 } as const;

export type ReturnState = {
  sunElevation: number;
  groundFog: number;
  exposure: number;
  /** 1 — глубокая ночь, 0 — рассвет. */
  predawn: number;
  stars: number;
  /** Примятость круга травы: 1 — лежит, 0 — поднялась. */
  pressed: number;
};

export function createReturnState(): ReturnState {
  return { sunElevation: 0, groundFog: 0, exposure: 1, predawn: 1, stars: 1, pressed: 1 };
}

/** Состояние по прогрессу дорожки главы p ∈ [0, 1]. Пишет в out, память не выделяет. */
export function computeReturn(p: number, out: ReturnState = createReturnState()): ReturnState {
  const dawn = smooth((p - 0.05) / 0.6);
  out.stars = 1 - smooth(p / 0.45);
  out.predawn = 1 - dawn;
  out.sunElevation = lerp(NIGHT.sunElevation, FIRST_FRAME.sunElevation, dawn);
  out.groundFog = lerp(NIGHT.groundFog, FIRST_FRAME.groundFog, dawn);
  out.exposure = lerp(NIGHT.exposure, FIRST_FRAME.exposure, dawn);
  // Трава поднимается медленно — дольше, чем светает (самое долгое движение главы).
  out.pressed = 1 - smooth((p - 0.3) / 0.65);
  return out;
}

/** Круг примятой травы финала — в кадре первого экрана: 15 м перед камерой, чуть левее центра. */
export const RETURN_CIRCLE = { x: -1.2, ahead: 14, radius: 4.2 } as const;
