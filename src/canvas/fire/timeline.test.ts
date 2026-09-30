import { describe, expect, it } from "vitest";
import { PHASE } from "./camera";
import { computeFireLight, createFireLight, GLOW_FROM, GLOW_TO } from "./timeline";

const at = (p: number) => ({ ...computeFireLight(p, createFireLight()) });

describe("таймлайн «Огня»", () => {
  it("вечерний свет стягивается в уголь очага: радиус свечения от «весь кадр» до углей", () => {
    expect(at(0).glowRadius).toBeCloseTo(GLOW_FROM, 6);
    expect(at(PHASE.gather[1]).glowRadius).toBeCloseTo(GLOW_TO, 6);
    let prev = at(0).glowRadius;
    for (let i = 1; i <= 100; i++) {
      const r = at((PHASE.gather[1] * i) / 100).glowRadius;
      expect(r).toBeLessThanOrEqual(prev + 1e-9);
      prev = r;
    }
    // После сбора свечение перехода уходит — дальше светят сами угли.
    expect(at(PHASE.macro[1]).glow).toBe(0);
  });

  it("закат → ночь по прогрессу главы, очаг разгорается относительно ночи", () => {
    expect(at(0).night).toBe(0);
    expect(at(1).night).toBe(1);
    expect(at(1).sunElevation).toBeLessThan(at(0).sunElevation);
    expect(at(1).hearth).toBeGreaterThan(at(0).hearth);
    let prev = at(0);
    for (let i = 1; i <= 500; i++) {
      const next = at(i / 500);
      expect(next.night).toBeGreaterThanOrEqual(prev.night);
      expect(Math.abs(next.exposure - prev.exposure)).toBeLessThan(0.01);
      prev = next;
    }
  });
});
