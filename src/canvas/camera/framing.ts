import { MathUtils, Vector3 } from "three";
import { chapterAnchor } from "../world";
import { angleDelta, lookAngles, trackT, type CameraPath } from "./path";

/*
 * Композиция «Сборки» по пропорциям экрана. На широком экране юрта стоит справа от текста
 * (так заданы ключи пути). На узком (телефон, портрет) по бокам нет места — камера
 * доворачивается к юрте по рысканью: юрта в центре кадра, текст над и под ней.
 * Только рысканье — крен остаётся 0. Внутри юрты доворот не нужен: взгляд и так по центру.
 */

/** Центр юрты относительно якоря главы 2, м. */
const YURT_CENTER: [number, number, number] = [0, 1.5, 0];
const from = new Vector3();
const toTarget = new Vector3();
const toYurt = new Vector3();
const a = { yaw: 0, pitch: 0 };
const b = { yaw: 0, pitch: 0 };

/** Насколько экран «узкий»: 1 — портрет телефона, 0 — от квадрата и шире. */
export function narrowness(aspect: number): number {
  return 1 - MathUtils.smoothstep(aspect, 0.6, 1.15);
}

/** Вес доворота по прогрессу камеры: только снаружи юрты во время «Сборки». */
export function assemblyWeight(t: number): number {
  const enter = MathUtils.smoothstep(t, trackT(0, 0.9), trackT(1, 0));
  const leave = 1 - MathUtils.smoothstep(t, trackT(1, 0.82), trackT(1, 0.92));
  return enter * leave;
}

/** Горизонтальный охват на узком экране — не меньше этой доли вертикального угла обзора. */
export const PORTRAIT_COVERAGE = 0.7;

/**
 * Угол обзора (вертикальный, градусы) на узком экране во время «Сборки»: юрта шириной ~20°
 * целиком в кадре. На широком экране и вне «Сборки» — без изменений (рассвет не трогаем:
 * его композиция считается от 135 мм).
 */
export function assemblyFov(fovDeg: number, t: number, aspect: number): number {
  const w = narrowness(aspect) * assemblyWeight(t);
  if (w <= 0) return fovDeg;
  const half = MathUtils.degToRad(fovDeg / 2);
  const wide = MathUtils.radToDeg(2 * Math.atan((Math.tan(half) * PORTRAIT_COVERAGE) / aspect));
  return fovDeg + (Math.max(fovDeg, wide) - fovDeg) * w;
}

/** Сдвиг рысканья (рад) для кадра t при пропорциях aspect. */
export function assemblyYawOffset(path: CameraPath, t: number, aspect: number): number {
  const w = narrowness(aspect) * assemblyWeight(t);
  if (w <= 0) return 0;
  path.positionAt(t, from);
  path.targetAt(t, toTarget);
  const anchor = chapterAnchor(1);
  toYurt.set(anchor[0] + YURT_CENTER[0], anchor[1] + YURT_CENTER[1], anchor[2] + YURT_CENTER[2]);
  lookAngles(from, toTarget, a);
  lookAngles(from, toYurt, b);
  return angleDelta(a.yaw, b.yaw) * w;
}
