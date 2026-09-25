import { describe, expect, it } from "vitest";
import { bezierEasing, bezierStartSlope } from "./bezier";
import { ease } from "./tokens";

describe("bezierEasing", () => {
  it("концы: 0 → 0, 1 → 1; за пределами — зажато", () => {
    const f = bezierEasing(ease.settle);
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(1);
    expect(f(-1)).toBe(0);
    expect(f(2)).toBe(1);
  });

  it("линейная кривая — тождество", () => {
    const f = bezierEasing([0.25, 0.25, 0.75, 0.75]);
    for (const t of [0.1, 0.33, 0.5, 0.9]) expect(f(t)).toBeCloseTo(t, 4);
  });

  it("монотонна для всех токенов (без отскока)", () => {
    for (const curve of Object.values(ease)) {
      const f = bezierEasing(curve);
      let prev = 0;
      for (let t = 0; t <= 1.0001; t += 0.01) {
        const v = f(t);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-6);
        expect(v).toBeLessThanOrEqual(1 + 1e-6);
        prev = v;
      }
    }
  });

  it("settle — быстрый старт, мягкая посадка", () => {
    const f = bezierEasing(ease.settle);
    expect(f(0.25)).toBeGreaterThan(0.6);
    expect(1 - f(0.9)).toBeLessThan(0.02);
    expect(bezierStartSlope(ease.settle)).toBeCloseTo(1 / 0.22, 5);
  });
});
