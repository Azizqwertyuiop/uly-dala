import { describe, expect, it } from "vitest";
import {
  assemblyWeight,
  assemblyYawOffset,
  dayWeight,
  narrowness,
  PORTRAIT_COVERAGE,
  sceneFov,
} from "./framing";
import { buildCameraPath, trackT } from "./path";

describe("композиция «Сборки» по пропорциям", () => {
  const path = buildCameraPath();

  it("широкий экран — без доворота; портрет — полный", () => {
    expect(narrowness(16 / 9)).toBe(0);
    expect(narrowness(1.2)).toBe(0);
    expect(narrowness(390 / 844)).toBe(1);
  });

  it("доворот только во время «Сборки» и только снаружи юрты", () => {
    expect(assemblyWeight(0)).toBe(0);
    expect(assemblyWeight(trackT(1, 0.3))).toBe(1);
    expect(assemblyWeight(trackT(1, 1))).toBe(0);
    expect(assemblyWeight(0.6)).toBe(0);
  });

  it("на телефоне угол обзора шире: горизонтальный охват ≥ 70% вертикального", () => {
    const t = trackT(1, 0.3);
    const aspect = 390 / 844;
    const fov = sceneFov(37.8, t, aspect);
    const horizontal = 2 * Math.atan(Math.tan(((fov / 2) * Math.PI) / 180) * aspect);
    const design = (37.8 * Math.PI) / 180;
    expect(horizontal).toBeGreaterThanOrEqual(design * PORTRAIT_COVERAGE * 0.97);
    expect(sceneFov(37.8, t, 16 / 9)).toBe(37.8);
    expect(sceneFov(10.2, 0, aspect)).toBe(10.2); // рассвет не трогаем
  });

  it("на телефоне юрта — в центре кадра: взгляд после доворота направлен на неё", () => {
    const t = trackT(1, 0.1);
    const yaw = assemblyYawOffset(path, t, 390 / 844);
    expect(Math.abs(yaw)).toBeGreaterThan(0.1);
    // Юрта правее цели взгляда → доворот вправо (рысканье по часовой: yaw уменьшается).
    expect(yaw).toBeLessThan(0);
    expect(assemblyYawOffset(path, t, 16 / 9)).toBe(0);
  });

  it("«День»: доворот и широкий кадр на телефоне — на всей дорожке главы", () => {
    expect(dayWeight(trackT(2, 0.5))).toBe(1);
    expect(dayWeight(trackT(1, 0.5))).toBe(0);
    expect(dayWeight(0.7)).toBe(0);
    expect(sceneFov(27, trackT(2, 0.5), 390 / 844)).toBeGreaterThan(27);
  });
});
