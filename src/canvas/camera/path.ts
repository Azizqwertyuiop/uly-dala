import { CatmullRomCurve3, MathUtils, Vector3 } from "three";
import { chapterIds } from "@/components/sections/chapters";
import { chapterAnchor } from "../world";

/*
 * Путь камеры (CLAUDE.md, раздел 6): два сплайна Catmull-Rom — позиция и цель взгляда —
 * по прогрессу сайта t ∈ [0, 1] (t = положение на навигации-горизонте: глава i — в t = i/(n−1)),
 * плюс кривые фокусного расстояния и дистанции фокуса.
 * Оптика: 135 мм снаружи, 50 мм в движении, 24 мм внутри юрты. Высота в степи ≤ 1,8 м.
 */

export type CameraKey = {
  /** Смещение позиции от якоря главы, м. */
  position: [number, number, number];
  /** Смещение цели взгляда от якоря главы, м. */
  target: [number, number, number];
  /** Фокусное расстояние, мм (полнокадровый эквивалент). */
  focal: number;
  /** Дистанция фокуса, м. */
  focus: number;
};

/** Ключевые кадры по главам. TODO(assets): подогнать под настоящие сцены. */
export const CAMERA_KEYS: Record<(typeof chapterIds)[number], CameraKey> = {
  // Рассвет: 60 см над землёй, 135 мм, конь на правой трети у горизонта.
  dawn: { position: [0, 0.6, 12], target: [3, 1.1, -40], focal: 135, focus: 52 },
  // Сборка: юрта встаёт, 50 мм; в конце — внутрь, 24 мм.
  assembly: { position: [-5, 1.6, 11], target: [0, 1.6, 0], focal: 24, focus: 11 },
  // День: мир готов, 50 мм.
  day: { position: [7, 1.7, 13], target: [0, 1.2, 0], focal: 50, focus: 14 },
  // Огонь: над дастарханом, взгляд вниз (орто — позже, в главе 4).
  fire: { position: [0, 1.8, 4], target: [0, 0.2, 0], focal: 35, focus: 4.5 },
  // Этот мир существует: ночь, 50 мм.
  world: { position: [0, 1.5, 15], target: [0, 1, 0], focal: 50, focus: 15 },
  // Снова рассвет: та же оптика, что в начале.
  return: { position: [0, 0.6, 12], target: [3, 1.1, -40], focal: 135, focus: 52 },
};

/** Максимальная высота камеры в степи, м. */
export const MAX_CAMERA_HEIGHT = 1.8;
/** Высота кадра полнокадрового сенсора, мм — для перевода фокусного в угол обзора. */
export const SENSOR_HEIGHT_MM = 24;

export type CameraPath = {
  position: CatmullRomCurve3;
  target: CatmullRomCurve3;
  focal: (t: number) => number;
  focus: (t: number) => number;
  /** t ключевого кадра главы i. */
  keyT: (index: number) => number;
};

const smooth = (a: number, b: number, k: number) => a + (b - a) * MathUtils.smoothstep(k, 0, 1);

function piecewise(values: number[]) {
  return (t: number) => {
    const n = values.length;
    if (n === 1) return values[0]!;
    const x = MathUtils.clamp(t, 0, 1) * (n - 1);
    const i = Math.min(Math.floor(x), n - 2);
    return smooth(values[i]!, values[i + 1]!, x - i);
  };
}

export function buildCameraPath(): CameraPath {
  const add = (anchor: [number, number, number], offset: [number, number, number]) =>
    new Vector3(anchor[0] + offset[0], anchor[1] + offset[1], anchor[2] + offset[2]);
  const keys = chapterIds.map((id, i) => ({ key: CAMERA_KEYS[id], anchor: chapterAnchor(i) }));
  const n = keys.length;
  return {
    // centripetal — без петель и перелётов между ключами.
    position: new CatmullRomCurve3(
      keys.map(({ key, anchor }) => add(anchor, key.position)),
      false,
      "centripetal",
    ),
    target: new CatmullRomCurve3(
      keys.map(({ key, anchor }) => add(anchor, key.target)),
      false,
      "centripetal",
    ),
    focal: piecewise(keys.map(({ key }) => key.focal)),
    focus: piecewise(keys.map(({ key }) => key.focus)),
    keyT: (index) => (n > 1 ? index / (n - 1) : 0),
  };
}

/** Фокусное (мм) → вертикальный угол обзора (градусы). */
export function focalToFov(focalMm: number): number {
  return MathUtils.radToDeg(2 * Math.atan(SENSOR_HEIGHT_MM / (2 * focalMm)));
}

/** Направление взгляда → рысканье и тангаж (рад) для порядка Эйлера YXZ; крен всегда 0. */
export function lookAngles(from: Vector3, to: Vector3, out = { yaw: 0, pitch: 0 }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  out.yaw = Math.atan2(-dx, -dz);
  out.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  return out;
}

/** Кратчайшая разность углов, рад, в (−π, π]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
