import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  createFirePose,
  firePose,
  focalToFovRad,
  ORTHO_FOV,
  PHASE,
  PLAN_CENTER,
  PLAN_DEPTH,
  PLAN_WIDTH,
  TOP_PITCH,
} from "./camera";

const at = (p: number, aspect = 16 / 9, narrow = false) => {
  const pose = firePose(p, aspect, narrow, createFirePose());
  return { ...pose, position: pose.position.clone(), target: pose.target.clone() };
};

/** Камера в позе: крен 0 (YXZ), угол обзора по фокусному. */
function cameraOf(pose: ReturnType<typeof at>, aspect: number) {
  const cam = new PerspectiveCamera(
    MathUtils.radToDeg(focalToFovRad(pose.focal)),
    aspect,
    0.25,
    20000,
  );
  cam.position.copy(pose.position);
  const d = pose.target.clone().sub(pose.position);
  cam.rotation.order = "YXZ";
  cam.rotation.set(Math.atan2(d.y, Math.hypot(d.x, d.z)), Math.atan2(-d.x, -d.z), 0);
  cam.updateMatrixWorld();
  return cam;
}

describe("камера «Огня»: макро → dolly zoom → план сверху", () => {
  it("переход перспектива → орто без рывка: поза непрерывна по всей дорожке", () => {
    let prev = at(0);
    for (let i = 1; i <= 4000; i++) {
      const p = i / 4000;
      const next = at(p);
      // Шаг скролла 1/4000 — ни одного скачка: смещение цели и направление взгляда малы.
      const dirPrev = prev.target.clone().sub(prev.position).normalize();
      const dirNext = next.target.clone().sub(next.position).normalize();
      expect(dirPrev.angleTo(dirNext)).toBeLessThan(0.01);
      expect(next.target.distanceTo(prev.target)).toBeLessThan(0.02);
      expect(Math.abs(Math.log(next.focal / prev.focal))).toBeLessThan(0.01);
      prev = next;
    }
  });

  it("dolly zoom: объект в кадре не прыгает по размеру (ширина в кадре меняется плавно, монотонно)", () => {
    let prevW = 0;
    for (let i = 0; i <= 200; i++) {
      const p = PHASE.dolly[0] + ((PHASE.dolly[1] - PHASE.dolly[0]) * i) / 200;
      const pose = at(p);
      const w = 2 * pose.target.distanceTo(pose.position) * Math.tan(focalToFovRad(pose.focal) / 2);
      if (i > 0) expect(w).toBeGreaterThanOrEqual(prevW - 1e-6);
      prevW = w;
    }
  });

  it("в конце — вид сверху: тангаж −89,5°, угол обзора 1,5° (почти орто)", () => {
    const end = at(1);
    const d = end.target.clone().sub(end.position);
    expect(Math.atan2(d.y, Math.hypot(d.x, d.z))).toBeCloseTo(TOP_PITCH, 4);
    expect(MathUtils.radToDeg(focalToFovRad(end.focal))).toBeCloseTo(ORTHO_FOV, 3);
    expect(end.still).toBe(1);
    expect(end.ortho).toBe(1);
  });

  it("план вписан в кадр при любых пропорциях; на широком — правее, место тексту", () => {
    const [cx, cy, cz] = PLAN_CENTER;
    const corners = [
      [cx - PLAN_WIDTH / 2, cy, cz - PLAN_DEPTH / 2],
      [cx + PLAN_WIDTH / 2, cy, cz - PLAN_DEPTH / 2],
      [cx - PLAN_WIDTH / 2, cy, cz + PLAN_DEPTH / 2],
      [cx + PLAN_WIDTH / 2, cy, cz + PLAN_DEPTH / 2],
    ].map(([x, y, z]) => new Vector3(x, y, z));
    for (const aspect of [21 / 9, 16 / 9, 4 / 3, 1, 3 / 4]) {
      const cam = cameraOf(at(1, aspect), aspect);
      const xs: number[] = [];
      for (const c of corners) {
        const v = c.clone().project(cam);
        expect(Math.abs(v.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(v.y)).toBeLessThanOrEqual(1);
        xs.push(v.x);
      }
      // Широкий экран: левая часть кадра (под текст) свободна от плана.
      if (aspect >= 1.2) expect(Math.min(...xs)).toBeGreaterThan(-0.2);
    }
  });

  it("телефон: вместо плана — список блюд, камера остаётся у очага (без dolly zoom)", () => {
    const end = at(1, 390 / 844, true);
    expect(end.focal).toBeLessThan(100);
    expect(end.ortho).toBe(0);
    expect(end.position.y).toBeLessThan(1.8);
  });
});
