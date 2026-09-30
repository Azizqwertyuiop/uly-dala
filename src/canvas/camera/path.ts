import { CatmullRomCurve3, MathUtils, Vector3 } from "three";
import { chapterIds } from "@/components/sections/chapters";
import type { FormatSlug } from "@/content/formats";
import { TRACK_CAMERA_SHARE } from "@/motion/progress";
import { fireStartKey } from "../fire/camera";
import {
  DAY_FRAMING,
  DAY_STATES,
  DEFAULT_ORDER,
  HOLD_FROM,
  HOLD_TO,
  slotCenter,
} from "../day/timeline";
import { horizonPitch } from "../steppe/dawn";
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

/** Первый экран (раздел 2): 60 см, 135 мм, крен 0, горизонт на 72% высоты, взгляд по −Z. */
const DAWN_FOV = 2 * Math.atan(24 / (2 * 135)) * (180 / Math.PI);
const DAWN_PITCH = horizonPitch(DAWN_FOV, 16 / 9);
const dawnFrame = (focus: number): CameraKey => ({
  position: [0, 0.6, 12],
  target: [0, 0.6 + Math.tan(DAWN_PITCH) * 50, -38],
  focal: 135,
  focus,
});

/** Ключевые кадры по главам. TODO(assets): подогнать под настоящие сцены. */
export const CAMERA_KEYS: Record<(typeof chapterIds)[number], CameraKey> = {
  // Рассвет: конь на правой трети, ~275 м (положение коня считает DawnScene по пропорциям экрана).
  dawn: dawnFrame(275),
  // Сборка: юрта встаёт справа от текста, 35 мм; внутрь юрты (24 мм) — в конце дорожки (EXTRA_KEYS).
  assembly: { position: [-8, 1.6, 16], target: [-3.6, 1.5, 0], focal: 35, focus: 17 },
  // День: мир готов, 50 мм. Фактический ключ входа строится из порядка развилки (dayArrival).
  day: { position: [7, 1.7, 13], target: [0, 1.2, 0], focal: 50, focus: 14 },
  // Огонь: макро у очага — ровно стартовая поза сцены (дальше камерой ведёт она: dolly zoom).
  fire: { ...fireStartKey(), focus: 1.5 },
  // Этот мир существует: ночь, 50 мм.
  world: { position: [0, 1.5, 15], target: [0, 1, 0], focal: 50, focus: 15 },
  // Снова рассвет: та же оптика, что в начале.
  return: dawnFrame(275),
};

/**
 * Промежуточные ключи внутри глав: t — прогресс сайта (как у горизонта), offset — от якоря главы.
 * Конец рассвета (раздел 2): фокус 135 → 50 мм, камера над кругом примятой травы — на месте юрты.
 */
/** t по прогрессу дорожки главы i (0…1): дорожка занимает TRACK_CAMERA_SHARE главы. */
export const trackT = (chapter: number, p: number) =>
  (chapter + TRACK_CAMERA_SHARE * p) / (chapterIds.length - 1);

export const EXTRA_KEYS: { t: number; chapter: number; key: CameraKey }[] = [
  {
    t: 0.16,
    chapter: 1,
    key: { position: [0, 1.8, 8], target: [0, 0, 0], focal: 50, focus: 8.2 },
  },
  // Сборка (глава 2): юрта справа от текста, камера медленно подходит к дверному проёму…
  {
    t: trackT(1, 0.45),
    chapter: 1,
    key: { position: [-7, 1.7, 12.5], target: [-3, 1.9, 0], focal: 35, focus: 13 },
  },
  {
    t: trackT(1, 0.78),
    chapter: 1,
    key: { position: [-4.5, 1.6, 9.5], target: [-1.2, 1.5, 0], focal: 32, focus: 10 },
  },
  {
    t: trackT(1, 0.9),
    chapter: 1,
    key: { position: [0, 1.5, 5.2], target: [0, 1.45, 0], focal: 28, focus: 5 },
  },
  // …и входит внутрь: 24 мм, столп света из шаңырақа, своя техника за ним.
  {
    t: trackT(1, 1),
    chapter: 1,
    key: { position: [0, 1.45, 1.9], target: [0, 1.7, -2.4], focal: 24, focus: 3.5 },
  },
];

/** Ключей на отрезке «стояния» у площадки. */
const HOLD_STEPS = 6;

/**
 * «День» (глава 3): камера проезжает мимо шести площадок в порядке развилки.
 * На каждой — «стоит» (медленный наезд) в середине состояния, между ними — переезд сквозь завесу.
 * Ключи зависят от порядка, поэтому путь перестраивается, когда порядок меняется (rig.setDayOrder).
 */
export function dayCameraKeys(order: readonly FormatSlug[]): { t: number; key: CameraKey }[] {
  const keys: { t: number; key: CameraKey }[] = [];
  for (let k = 0; k < DAY_STATES; k++) {
    const slug = order[k] ?? DEFAULT_ORDER[k]!;
    const f = DAY_FRAMING[slug];
    const c = slotCenter(k);
    const at = (o: [number, number, number], d = 0) =>
      [
        c[0] + o[0] + f.dolly[0] * d,
        c[1] + o[1] + f.dolly[1] * d,
        c[2] + o[2] + f.dolly[2] * d,
      ] as [number, number, number];
    const target = at(f.target);
    // «Стояние» — ключи через равные доли на одной прямой: сплайн внутри остаётся прямым,
    // дальние ключи переезда не выгибают наезд (иначе камера «ходит» сильнее, чем наезд).
    for (let i = 0; i <= HOLD_STEPS; i++) {
      const d = i / HOLD_STEPS;
      keys.push({
        t: trackT(2, (k + HOLD_FROM + (HOLD_TO - HOLD_FROM) * d) / DAY_STATES),
        key: { position: at(f.position, d), target, focal: f.focal, focus: f.focus },
      });
    }
  }
  return keys;
}

/** Ключ входа в «День»: чуть позади первой площадки — из света столпа к событию. */
function dayArrival(order: readonly FormatSlug[]): CameraKey {
  const first = dayCameraKeys(order)[0]!.key;
  const [x, y, z] = first.position;
  return { ...first, position: [x - 1.2, y, z + 2.5] };
}

/** Максимальная высота камеры в степи, м. */
export const MAX_CAMERA_HEIGHT = 1.8;
/** Высота кадра полнокадрового сенсора, мм — для перевода фокусного в угол обзора. */
export const SENSOR_HEIGHT_MM = 24;

export type CameraPath = {
  /** Кривые целиком (для отладки); по прогрессу сайта — positionAt / targetAt. */
  position: CatmullRomCurve3;
  target: CatmullRomCurve3;
  positionAt: (t: number, out?: Vector3) => Vector3;
  targetAt: (t: number, out?: Vector3) => Vector3;
  focal: (t: number) => number;
  focus: (t: number) => number;
  /** t ключевого кадра главы i. */
  keyT: (index: number) => number;
};

const smooth = (a: number, b: number, k: number) => a + (b - a) * MathUtils.smoothstep(k, 0, 1);

/** Прогресс сайта t → параметр кривой u: ключи стоят в своих t, между ними — линейно. */
function remap(times: number[]) {
  const last = times.length - 1;
  return (t: number) => {
    const x = MathUtils.clamp(t, 0, 1);
    let k = 0;
    while (k < last - 1 && x > times[k + 1]!) k++;
    const span = times[k + 1]! - times[k]!;
    const frac = span > 0 ? MathUtils.clamp((x - times[k]!) / span, 0, 1) : 0;
    return { u: (k + frac) / last, k, frac };
  };
}

export function buildCameraPath(dayOrder: readonly FormatSlug[] = DEFAULT_ORDER): CameraPath {
  const add = (anchor: [number, number, number], offset: [number, number, number]) =>
    new Vector3(anchor[0] + offset[0], anchor[1] + offset[1], anchor[2] + offset[2]);
  const n = chapterIds.length;
  const keyT = (index: number) => (n > 1 ? index / (n - 1) : 0);
  const dayIndex = chapterIds.indexOf("day");
  const keys = [
    ...chapterIds.map((id, i) => ({
      t: keyT(i),
      key: id === "day" ? dayArrival(dayOrder) : CAMERA_KEYS[id],
      anchor: chapterAnchor(i),
    })),
    ...EXTRA_KEYS.map((e) => ({ t: e.t, key: e.key, anchor: chapterAnchor(e.chapter) })),
    ...dayCameraKeys(dayOrder).map((e) => ({ ...e, anchor: chapterAnchor(dayIndex) })),
  ].sort((a, b) => a.t - b.t);
  const map = remap(keys.map((k) => k.t));
  // centripetal — без петель и перелётов между ключами.
  const position = new CatmullRomCurve3(
    keys.map(({ key, anchor }) => add(anchor, key.position)),
    false,
    "centripetal",
  );
  const target = new CatmullRomCurve3(
    keys.map(({ key, anchor }) => add(anchor, key.target)),
    false,
    "centripetal",
  );
  const scalar = (pick: (k: CameraKey) => number) => (t: number) => {
    const { k, frac } = map(t);
    return smooth(pick(keys[k]!.key), pick(keys[k + 1]!.key), frac);
  };
  return {
    position,
    target,
    positionAt: (t, out = new Vector3()) => position.getPoint(map(t).u, out),
    targetAt: (t, out = new Vector3()) => target.getPoint(map(t).u, out),
    focal: scalar((k) => k.focal),
    focus: scalar((k) => k.focus),
    keyT,
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
