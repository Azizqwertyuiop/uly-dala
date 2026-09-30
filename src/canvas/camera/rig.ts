import { MathUtils, Vector3 } from "three";
import type { FormatSlug } from "@/content/formats";
import { Spring, VectorSpring } from "@/motion/spring";
import {
  angleDelta,
  buildCameraPath,
  focalToFov,
  lookAngles,
  MAX_CAMERA_HEIGHT,
  type CameraPath,
} from "./path";

/*
 * Логика CameraRig (CLAUDE.md, раздел 6) без React и WebGL:
 *  1. база — точка на сплайнах по t, сглаженная критически демпфированными пружинами;
 *  2. ограничение угловой скорости 25°/с;
 *  3. слой курсора: ±1,5° рысканье / ±0,8° тангаж, сглаживание 0,8 с;
 *  4. слой микродыхания: 0,3% кадра за 6 с.
 * Слои 3–4 выключены в reduced motion. Крен — всегда 0: ориентация задаётся только рысканьем
 * и тангажом (порядок Эйлера YXZ, z = 0), а не lookAt.
 */

/** Поза, которую сцена задаёт камере (мир), и её вес 0…1. */
export type RigPose = {
  position: Vector3;
  target: Vector3;
  focal: number;
  still: number;
  weight: number;
};

export const MAX_ANGULAR_SPEED = MathUtils.degToRad(25);
export const CURSOR_YAW = MathUtils.degToRad(1.5);
export const CURSOR_PITCH = MathUtils.degToRad(0.8);
export const CURSOR_SMOOTHING = 0.8;
export const BREATH_PERIOD = 6;
/** Доля высоты кадра. */
export const BREATH_AMPLITUDE = 0.003;

export type RigOutput = {
  position: Vector3;
  /** Рысканье и тангаж итоговые (с курсором и дыханием), рад. Крена нет. */
  yaw: number;
  pitch: number;
  roll: 0;
  fov: number;
  focal: number;
  focus: number;
};

export class CameraRigState {
  path: CameraPath;
  readonly out: RigOutput = {
    position: new Vector3(),
    yaw: 0,
    pitch: 0,
    roll: 0,
    fov: 0,
    focal: 50,
    focus: 10,
  };
  private position: VectorSpring;
  private target: VectorSpring;
  private focal: Spring;
  private cursorYaw = new Spring(0, CURSOR_SMOOTHING);
  private cursorPitch = new Spring(0, CURSOR_SMOOTHING);
  private baseYaw = 0;
  private basePitch = 0;
  private time = 0;
  private t = 0;
  private offsetPitch = 0;
  private offsetYaw = 0;
  private offsetY = 0;
  /** 0…1 — камера «замерла» (план «Огня»): без курсора и дыхания. */
  private still = 0;
  /** Вес внешней позы сцены: над степью можно подняться выше 1,8 м (вид сверху «Огня»). */
  private poseWeight = 0;
  private scratchA = new Vector3();
  private scratchB = new Vector3();
  private angles = { yaw: 0, pitch: 0 };

  constructor(smoothTime = 0.45) {
    this.path = buildCameraPath();
    this.position = new VectorSpring([0, 0, 0], smoothTime);
    this.target = new VectorSpring([0, 0, 0], smoothTime);
    this.focal = new Spring(50, smoothTime);
    this.snap(0);
  }

  /**
   * Порядок форматов «Дня» (развилка) изменился — путь перестраивается.
   * Пружины не сбрасываются: камера плавно переходит на новый путь.
   */
  setDayOrder(order: readonly FormatSlug[]): void {
    this.path = buildCameraPath(order);
  }

  /** Мгновенно в точку t — восстановление после обновления страницы, без облёта. */
  snap(t: number): void {
    this.t = clamp01(t);
    const p = this.path.positionAt(clamp01(t), this.scratchA);
    const q = this.path.targetAt(clamp01(t), this.scratchB);
    this.position.setTarget([p.x, p.y, p.z]);
    this.target.setTarget([q.x, q.y, q.z]);
    this.position.snap();
    this.target.snap();
    this.focal.snap(this.path.focal(t));
    lookAngles(p, q, this.angles);
    this.baseYaw = this.angles.yaw;
    this.basePitch = this.angles.pitch;
    this.cursorYaw.snap(0);
    this.cursorPitch.snap(0);
    this.compose(false);
  }

  /**
   * Шаг кадра. t — прогресс сайта, pointer — курсор в [−1, 1], smoothTime — темп главы.
   * reduced — prefers-reduced-motion: без курсора и дыхания.
   */
  update(
    dt: number,
    t: number,
    pointer: { x: number; y: number },
    smoothTime: number,
    reduced: boolean,
    /**
     * Сдвиги кадра главы: тангаж и рысканье (рад, композиция по пропорциям экрана)
     * и высота (м, шаг коня). Крен не трогается никогда.
     */
    offsets: { pitch?: number; yaw?: number; y?: number } = {},
    /**
     * Внешняя поза сцены (dolly zoom «Огня»): смешивается с путём по весу; при весе 1 — точно
     * она, без пружин и ограничения угловой скорости (поза уже сглажена сценой по темпу главы).
     */
    pose: RigPose | null = null,
  ): RigOutput {
    this.time += dt;
    this.t = clamp01(t);

    const p = this.path.positionAt(clamp01(t), this.scratchA);
    const q = this.path.targetAt(clamp01(t), this.scratchB);
    let focal = this.path.focal(t);
    const w = pose ? Math.min(1, Math.max(0, pose.weight)) : 0;
    if (pose && w > 0) {
      p.lerp(pose.position, w);
      q.lerp(pose.target, w);
      focal = Math.exp(MathUtils.lerp(Math.log(focal), Math.log(pose.focal), w));
    }
    this.poseWeight = w;
    this.still = pose ? pose.still * w : 0;
    // Чем больше вес позы, тем меньше собственное сглаживание рига (при 1 — поза как есть).
    const own = smoothTime * (1 - w);
    this.position.smoothTime = this.target.smoothTime = this.focal.smoothTime = own;
    this.position.setTarget([p.x, p.y, p.z]);
    this.target.setTarget([q.x, q.y, q.z]);
    this.focal.target = focal;
    this.offsetPitch = offsets.pitch ?? 0;
    this.offsetYaw = offsets.yaw ?? 0;
    this.offsetY = offsets.y ?? 0;
    const pos = this.position.update(dt);
    const tgt = this.target.update(dt);
    this.focal.update(dt);

    // Ориентация базы с ограничением угловой скорости.
    p.set(pos[0]!, pos[1]!, pos[2]!);
    q.set(tgt[0]!, tgt[1]!, tgt[2]!);
    lookAngles(p, q, this.angles);
    const maxStep = w >= 1 ? Infinity : (MAX_ANGULAR_SPEED * dt) / Math.max(1 - w, 1e-3);
    this.baseYaw += MathUtils.clamp(angleDelta(this.baseYaw, this.angles.yaw), -maxStep, maxStep);
    this.basePitch += MathUtils.clamp(this.angles.pitch - this.basePitch, -maxStep, maxStep);

    this.cursorYaw.target = reduced ? 0 : -pointer.x * CURSOR_YAW;
    this.cursorPitch.target = reduced ? 0 : pointer.y * CURSOR_PITCH;
    this.cursorYaw.update(dt);
    this.cursorPitch.update(dt);

    this.compose(!reduced && this.still < 1);
    return this.out;
  }

  private compose(breath: boolean): void {
    const pos = this.position.value;
    const out = this.out;
    // Высота ≤ 1,8 м — в степи; вид сверху «Огня» (поза сцены) поднимается над ней.
    const maxHeight = this.poseWeight > 0 ? Infinity : MAX_CAMERA_HEIGHT;
    out.position.set(pos[0]!, Math.min(pos[1]! + this.offsetY, maxHeight), pos[2]!);
    out.focal = this.focal.value;
    out.fov = focalToFov(out.focal);
    out.focus = this.path.focus(this.t);
    const breathPitch = breath
      ? MathUtils.degToRad(out.fov) *
        BREATH_AMPLITUDE *
        Math.sin((this.time / BREATH_PERIOD) * Math.PI * 2)
      : 0;
    const live = 1 - this.still;
    out.yaw = this.baseYaw + this.offsetYaw + this.cursorYaw.value * live;
    out.pitch = this.basePitch + this.offsetPitch + (this.cursorPitch.value + breathPitch) * live;
    out.roll = 0;
  }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
