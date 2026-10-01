import { describe, expect, it } from "vitest";
import { computeReturn, FIRST_FRAME, handoff, HANDOFF_FROM, NIGHT } from "./timeline";

describe("«Снова рассвет» — таймлайн", () => {
  it("начало — ночь фазенды: звёзды, трава примята", () => {
    const s = computeReturn(0);
    expect(s.stars).toBe(1);
    expect(s.predawn).toBe(1);
    expect(s.pressed).toBe(1);
    expect(s.sunElevation).toBe(NIGHT.sunElevation);
  });

  it("петля: последний кадр — первый кадр «Рассвета»", () => {
    const s = computeReturn(1);
    expect(s.stars).toBe(0);
    expect(s.predawn).toBe(0);
    expect(s.pressed).toBe(0);
    expect(s.sunElevation).toBeCloseTo(FIRST_FRAME.sunElevation);
    expect(s.groundFog).toBeCloseTo(FIRST_FRAME.groundFog);
    expect(s.exposure).toBeCloseTo(FIRST_FRAME.exposure);
  });

  it("звёзды гаснут, горизонт светлеет, трава поднимается — монотонно и без скачков", () => {
    let prev = computeReturn(0);
    for (let i = 1; i <= 400; i++) {
      const s = computeReturn(i / 400);
      expect(s.stars).toBeLessThanOrEqual(prev.stars);
      expect(s.predawn).toBeLessThanOrEqual(prev.predawn);
      expect(s.pressed).toBeLessThanOrEqual(prev.pressed);
      expect(s.sunElevation).toBeGreaterThanOrEqual(prev.sunElevation);
      expect(Math.abs(s.sunElevation - prev.sunElevation)).toBeLessThan(0.1);
      prev = { ...s };
    }
    // Звёзды гаснут раньше, чем поднимается трава.
    expect(computeReturn(0.45).stars).toBe(0);
    expect(computeReturn(0.45).pressed).toBeGreaterThan(0.5);
  });

  it("фазенда уступает степи в конце своей дорожки — окно ≤ 60vh", () => {
    expect(handoff(HANDOFF_FROM)).toBe(0);
    expect(handoff(1)).toBe(1);
    // Дорожка фазенды — 200svh, прокрутка по ней — 100svh.
    expect((1 - HANDOFF_FROM) * 100).toBeLessThanOrEqual(60);
  });
});
