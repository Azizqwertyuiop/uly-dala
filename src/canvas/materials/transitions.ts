/*
 * Шейдерные переходы изображений (CLAUDE.md, раздел 5) — только три:
 *  - «туман» — растворение по шуму: кадр проступает пятнами, как из тумана;
 *  - «дым» — смещение вверх: кадр поднимается из-под дыма, кромка — рваная, в клубах;
 *  - «свет» — по яркости: сначала светлые места кадра, затем тени (как глаз, привыкающий к свету).
 * GLSL-функции возвращают маску 0…1 (1 — пиксель кадра виден); смещение «дыма» — сдвиг UV.
 * JS-копии тех же формул — для тестов и для расчёта, когда переход закончен.
 */

import { NOISE_GLSL } from "../steppe/glsl";

export const TRANSITIONS = ["fog", "smoke", "light"] as const;
export type Transition = (typeof TRANSITIONS)[number];

/** Мягкость кромки перехода (доля диапазона). */
export const EDGE = 0.18;

export const TRANSITIONS_GLSL = /* glsl */ `
  ${NOISE_GLSL}
  // Прогресс p: 0 — кадра нет, 1 — кадр целиком. Кромка — EDGE.
  float revealFog(vec2 uv, float p) {
    float n = fbm(uv * 3.2 + 7.1);
    float t = mix(-${EDGE.toFixed(3)}, 1.0, p);
    return smoothstep(t, t + ${EDGE.toFixed(3)}, 1.0 - n);
  }
  float revealSmoke(vec2 uv, float p) {
    // Снизу вверх; кромка клубится (шум по x и по времени прогресса).
    float n = fbm(vec2(uv.x * 4.0, uv.y * 2.0 - p * 1.5)) - 0.5;
    float line = mix(-${EDGE.toFixed(3)} - 0.25, 1.0 + 0.25, p);
    return 1.0 - smoothstep(line - ${EDGE.toFixed(3)}, line, uv.y + n * 0.25);
  }
  vec2 smokeShift(vec2 uv, float p) {
    // Кадр «поднимается»: в начале — ниже на 6%, к концу — на месте.
    return uv - vec2(0.0, (1.0 - p) * 0.06);
  }
  float revealLight(float luma, float p) {
    float t = mix(1.0 + ${EDGE.toFixed(3)}, -${EDGE.toFixed(3)}, p);
    return smoothstep(t - ${EDGE.toFixed(3)}, t, luma);
  }
  float reveal(int kind, vec2 uv, float luma, float p) {
    if (p >= 1.0) return 1.0;
    if (p <= 0.0) return 0.0;
    if (kind == 0) return revealFog(uv, p);
    if (kind == 1) return revealSmoke(uv, p);
    return revealLight(luma, p);
  }
`;

export const transitionIndex = (t: Transition) => TRANSITIONS.indexOf(t);

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** «Свет» — JS-копия: маска пикселя яркости luma при прогрессе p. */
export function revealLight(luma: number, p: number): number {
  if (p >= 1) return 1;
  if (p <= 0) return 0;
  const t = 1 + EDGE + (-EDGE - (1 + EDGE)) * p;
  return smoothstep(t - EDGE, t, luma);
}
