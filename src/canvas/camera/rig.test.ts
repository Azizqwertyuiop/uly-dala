import { Euler, MathUtils, Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { chapterIds } from "@/components/sections/chapters";
import { buildCameraPath, focalToFov, MAX_CAMERA_HEIGHT } from "./path";
import { CameraRigState, MAX_ANGULAR_SPEED } from "./rig";

/** Крен: насколько «правый» вектор камеры отклонён от горизонтали. Ноль — горизонт ровный. */
function rollOf(yaw: number, pitch: number, roll: number): number {
  const q = new Quaternion().setFromEuler(new Euler(pitch, yaw, roll, "YXZ"));
  const right = new Vector3(1, 0, 0).applyQuaternion(q);
  return Math.asin(MathUtils.clamp(right.y, -1, 1));
}

const SAMPLES = 2000;

describe("камера: закон «Горизонт» (крен 0)", () => {
  it("по всем точкам сплайна — с курсором по краям, с дыханием и в reduced motion", () => {
    const pointers = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
    ];
    for (const pointer of pointers) {
      for (const reduced of [false, true]) {
        const rig = new CameraRigState(0.35);
        rig.snap(0);
        let worst = 0;
        for (let i = 0; i <= SAMPLES; i++) {
          const out = rig.update(1 / 60, i / SAMPLES, pointer, 0.35, reduced);
          expect(out.roll).toBe(0);
          worst = Math.max(worst, Math.abs(rollOf(out.yaw, out.pitch, out.roll)));
        }
        expect(worst).toBeLessThan(1e-12);
      }
    }
  });

  it("в каждой точке сплайна «мгновенная» камера тоже без крена", () => {
    const rig = new CameraRigState();
    for (let i = 0; i <= SAMPLES; i++) {
      rig.snap(i / SAMPLES);
      expect(Math.abs(rollOf(rig.out.yaw, rig.out.pitch, rig.out.roll))).toBeLessThan(1e-12);
    }
  });
});

describe("камера: путь по всему сайту", () => {
  const path = buildCameraPath();

  it("проходит через ключевой кадр каждой главы", () => {
    const rig = new CameraRigState();
    chapterIds.forEach((_, i) => {
      rig.snap(path.keyT(i));
      const expected = path.positionAt(path.keyT(i));
      expect(
        rig.out.position.distanceTo(
          new Vector3(expected.x, Math.min(expected.y, MAX_CAMERA_HEIGHT), expected.z),
        ),
      ).toBeLessThan(1e-9);
    });
    expect(path.keyT(0)).toBe(0);
    expect(path.keyT(chapterIds.length - 1)).toBe(1);
  });

  it("высота в степи ≤ 1,8 м по всему пути", () => {
    for (let i = 0; i <= SAMPLES; i++) {
      const rig = new CameraRigState();
      rig.snap(i / SAMPLES);
      expect(rig.out.position.y).toBeLessThanOrEqual(MAX_CAMERA_HEIGHT);
      expect(rig.out.position.y).toBeGreaterThan(0.3);
    }
  });

  it("конец рассвета: 50 мм, камера над кругом примятой травы (на месте юрты)", () => {
    const rig = new CameraRigState();
    rig.snap(0.16);
    expect(rig.out.focal).toBe(50);
    expect(rig.out.position.z).toBeCloseTo(-52, 6);
    expect(rig.out.pitch).toBeLessThan(-0.15); // взгляд вниз
  });

  it("шаг коня и композиция — только высота и тангаж, крен остаётся 0", () => {
    const rig = new CameraRigState();
    rig.snap(0.18);
    const out = rig.update(1 / 60, 0.18, { x: 0.5, y: 0.5 }, 0.35, false, {
      pitch: 0.01,
      y: -0.012,
    });
    expect(out.roll).toBe(0);
    expect(Math.abs(rollOf(out.yaw, out.pitch, out.roll))).toBeLessThan(1e-12);
  });

  it("оптика: 135 мм снаружи, 35–50 мм в движении", () => {
    expect(path.focal(0)).toBe(135);
    expect(path.focal(path.keyT(1))).toBe(35);
    expect(path.focal(path.keyT(2))).toBe(50);
    expect(focalToFov(135)).toBeCloseTo(10.2, 1);
    expect(focalToFov(50)).toBeCloseTo(27, 0);
  });

  it("угловая скорость ≤ 25°/с, даже при прыжке через весь сайт", () => {
    const rig = new CameraRigState(0.05);
    rig.snap(0);
    let yaw = rig.out.yaw;
    let pitch = rig.out.pitch;
    for (let f = 0; f < 600; f++) {
      const dt = 1 / 60;
      // Прыжки: к концу сайта и обратно (клик по отметке горизонта).
      const t = f < 300 ? 1 : 0;
      const out = rig.update(dt, t, { x: 0, y: 0 }, 0.05, true);
      const dYaw = Math.abs(out.yaw - yaw);
      const dPitch = Math.abs(out.pitch - pitch);
      expect(Math.max(dYaw, dPitch)).toBeLessThanOrEqual(MAX_ANGULAR_SPEED * dt + 1e-9);
      yaw = out.yaw;
      pitch = out.pitch;
    }
  });

  it("курсор: не больше ±1,5° по рысканью и ±0,8° по тангажу", () => {
    const still = new CameraRigState();
    const moved = new CameraRigState();
    still.snap(0.3);
    moved.snap(0.3);
    for (let f = 0; f < 600; f++) {
      still.update(1 / 60, 0.3, { x: 0, y: 0 }, 0.35, true);
      moved.update(1 / 60, 0.3, { x: 1, y: 1 }, 0.35, false);
    }
    const yaw = Math.abs(MathUtils.radToDeg(moved.out.yaw - still.out.yaw));
    const pitch = Math.abs(MathUtils.radToDeg(moved.out.pitch - still.out.pitch));
    expect(yaw).toBeCloseTo(1.5, 1);
    // Тангаж: курсор 0,8° плюс микродыхание (0,3% кадра).
    expect(pitch).toBeLessThan(0.8 + 0.05);
    expect(pitch).toBeGreaterThan(0.7);
  });
});
