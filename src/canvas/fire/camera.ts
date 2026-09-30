import { MathUtils, Vector3 } from "three";

/*
 * Камера главы 4 «Огонь» (CLAUDE.md, раздел 2): макро у очага → плавный dolly zoom
 * в ортогональный вид сверху — дастархан как архитектурный план.
 *
 * Поза считается формулой от прогресса дорожки p (0…1), а не сплайном: dolly zoom — это
 * согласованные угол обзора и расстояние (размер объекта в кадре постоянен), сплайн так не умеет.
 * «Орто» — перспективная камера с углом 1,5° издалека: переход перспектива → орто без рывка,
 * без подмены камеры. План вписан в кадр при любых пропорциях (aspect).
 * Координаты — относительно якоря главы (x — вдоль стола, −z — от камеры, y — вверх).
 */

/** Очаг — у правого торца дастархана; на плане видны и стол, и огонь. */
export const HEARTH: readonly [number, number, number] = [3.4, 0, -0.2];
/** Казан над очагом; точка, куда падает капля (на стенке). */
export const KAZAN_Y = 0.36;
export const KAZAN_RADIUS = 0.3;
/** План: дастархан 4,1 × 1,3 м по центру + очаг; поля — на подписи. */
export const PLAN_CENTER: readonly [number, number, number] = [0.6, 0.4, -0.1];
export const PLAN_WIDTH = 7.2;
export const PLAN_DEPTH = 3.4;

/** Фазы по прогрессу дорожки. */
export const PHASE = {
  /** Вечерний свет стягивается в уголь очага. */
  gather: [0, 0.12],
  /** Макро: угли, дым, казан, капля на металле. */
  macro: [0.12, 0.45],
  /** Dolly zoom в вид сверху. */
  dolly: [0.45, 0.72],
  /** План: блюда, подписи, сеты. */
  plan: [0.72, 1],
} as const;

/** Фокусное макро в конце (мм) и «орто» — угол обзора плана (градусы). */
export const MACRO_FOCAL = 85;
export const ORTHO_FOV = 1.5;
/** Наклон вида сверху: чуть меньше 90° — рысканье остаётся определённым (без «переворота»). */
export const TOP_PITCH = MathUtils.degToRad(-89.5);
/** Доля ширины кадра под план на широком экране (слева — текст главы). */
export const PLAN_SHARE_WIDE = 0.58;

const SENSOR = 24;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (x: number) => x * x * (3 - 2 * x);
const phase = (p: number, [a, b]: readonly [number, number]) => clamp01((p - a) / (b - a));
export const focalToFovRad = (focal: number) => 2 * Math.atan(SENSOR / (2 * focal));
export const fovToFocal = (fovRad: number) => SENSOR / (2 * Math.tan(fovRad / 2));

export type FirePose = {
  position: Vector3;
  target: Vector3;
  focal: number;
  /** 0 — живая камера (курсор, дыхание), 1 — план: камера неподвижна. */
  still: number;
  /** 0…1 — насколько вид уже «орто» (для подписей блюд и UI). */
  ortho: number;
};

export function createFirePose(): FirePose {
  return { position: new Vector3(), target: new Vector3(), focal: 50, still: 0, ortho: 0 };
}

const tmp = new Vector3();
const start = new Vector3();

/** Макро-поза: облёт очага; a — 0…1 по фазе макро. */
function macroPose(a: number, out: FirePose): FirePose {
  const [hx, hy, hz] = HEARTH;
  const angle = MathUtils.lerp(2.35, 3.2, a); // от «спереди-слева» к стороне стола
  const radius = MathUtils.lerp(2.1, 1.25, a);
  // Низко — угли видны под казаном, между ножками; к концу — к капле на стенке.
  const height = MathUtils.lerp(0.36, 0.6, a);
  out.position.set(hx + Math.cos(angle) * radius, hy + height, hz + Math.sin(angle) * radius);
  out.target.set(
    hx + Math.cos(angle) * KAZAN_RADIUS * a,
    hy + MathUtils.lerp(0.2, KAZAN_Y + 0.12, a),
    hz + Math.sin(angle) * KAZAN_RADIUS * a,
  );
  out.focal = MathUtils.lerp(50, MACRO_FOCAL, smooth(a));
  out.still = 0;
  out.ortho = 0;
  return out;
}

/**
 * Высота видимой области плана (м по земле), чтобы план вписался при данном aspect.
 * wide — на широком экране план правее (место тексту слева).
 */
export function planViewHeight(aspect: number, wide: boolean): number {
  const share = wide ? PLAN_SHARE_WIDE : 1;
  return Math.max(PLAN_DEPTH / 0.82, PLAN_WIDTH / (aspect * share * 0.92));
}

/** Центр взгляда в виде сверху: план сдвинут вправо на широком экране. */
function planTarget(aspect: number, wide: boolean, out: Vector3): Vector3 {
  const [cx, cy, cz] = PLAN_CENTER;
  const view = planViewHeight(aspect, wide) * aspect;
  const shift = wide ? (1 - PLAN_SHARE_WIDE / 2 - 0.5) * view : 0;
  // Вид сверху с рысканьем 0: вправо по экрану — +X мира.
  return out.set(cx - shift, cy, cz);
}

/** Широкий экран — план справа от текста; узкий — по центру. */
export const isWide = (aspect: number) => aspect >= 1.2;

/**
 * Поза камеры по прогрессу дорожки «Огня». narrow — телефон: вместо плана — список блюд,
 * камера остаётся у очага (dolly zoom не идёт). Память не выделяет.
 */
export function firePose(p: number, aspect: number, narrow: boolean, out: FirePose): FirePose {
  const macro = phase(p, PHASE.macro);
  macroPose(macro, out);
  const s = narrow ? 0 : smooth(phase(p, PHASE.dolly));
  if (s <= 0) return out;

  // Начало dolly zoom — конец макро: направление, расстояние и «ширина объекта в кадре».
  const fov0 = focalToFovRad(MACRO_FOCAL);
  tmp.copy(out.target).sub(out.position);
  const d0 = tmp.length();
  const yaw0 = Math.atan2(-tmp.x, -tmp.z);
  const pitch0 = Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z));
  const w0 = 2 * d0 * Math.tan(fov0 / 2);
  start.copy(out.target);

  // Конец — вид сверху, план вписан.
  const fov1 = MathUtils.degToRad(ORTHO_FOV);
  const wide = isWide(aspect);
  const w1 = planViewHeight(aspect, wide);
  const target1 = planTarget(aspect, wide, tmp);

  // Угол обзора и «ширина объекта» — в логарифме: зум ощущается равномерным.
  const fov = Math.exp(MathUtils.lerp(Math.log(fov0), Math.log(fov1), s));
  const w = Math.exp(MathUtils.lerp(Math.log(w0), Math.log(w1), s));
  const distance = w / (2 * Math.tan(fov / 2));
  // Рысканье — кратчайшим путём к 0 (стол вдоль экрана), тангаж — к виду сверху.
  let dyaw = -yaw0;
  dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
  const yaw = yaw0 + dyaw * s;
  const pitch = MathUtils.lerp(pitch0, TOP_PITCH, s);

  out.target.copy(start).lerp(target1, s);
  const dir = tmp.set(
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  );
  out.position.copy(out.target).addScaledVector(dir, -distance);
  out.focal = fovToFocal(fov);
  out.still = s;
  out.ortho = s;
  return out;
}

/** Поза начала главы (относительно якоря) — ключ общего пути камеры: вход в «Огонь» без рывка. */
export function fireStartKey(): {
  position: [number, number, number];
  target: [number, number, number];
  focal: number;
} {
  const pose = macroPose(0, createFirePose());
  return {
    position: pose.position.toArray() as [number, number, number],
    target: pose.target.toArray() as [number, number, number],
    focal: pose.focal,
  };
}
