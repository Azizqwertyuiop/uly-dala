import type { CubicBezier } from "./tokens";

/*
 * Кривые cubic-bezier из токенов (раздел 5) — для анимаций в JS и 3D.
 * Та же математика, что у CSS cubic-bezier(): x — время, y — прогресс.
 * bezierEasing() строит функцию один раз; вызов в кадре не выделяет память.
 */

export function bezierEasing([x1, y1, x2, y2]: CubicBezier): (t: number) => number {
  // Коэффициенты многочлена: B(s) = ((a·s + b)·s + c)·s.
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sampleY = (s: number) => ((ay * s + by) * s + cy) * s;
  const slopeX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;

  const solveX = (x: number) => {
    // Ньютон, затем бисекция, если производная слишком мала.
    let s = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(s) - x;
      if (Math.abs(err) < 1e-6) return s;
      const d = slopeX(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0;
    let hi = 1;
    s = x;
    for (let i = 0; i < 30; i++) {
      const v = sampleX(s);
      if (Math.abs(v - x) < 1e-6) return s;
      if (v < x) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return s;
  };

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleY(solveX(t));
  };
}

/** Начальный наклон кривой dy/dx в точке 0 (для стыковки участков без рывка). */
export function bezierStartSlope([x1, y1]: CubicBezier): number {
  return x1 > 0 ? y1 / x1 : Infinity;
}
