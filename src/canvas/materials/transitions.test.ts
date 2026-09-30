import { describe, expect, it } from "vitest";
import { revealLight, TRANSITIONS, TRANSITIONS_GLSL, transitionIndex } from "./transitions";

describe("шейдерные переходы изображений", () => {
  it("ровно три: туман, дым, свет (раздел 5)", () => {
    expect(TRANSITIONS).toEqual(["fog", "smoke", "light"]);
    for (const fn of ["revealFog", "revealSmoke", "revealLight", "smokeShift", "reveal("]) {
      expect(TRANSITIONS_GLSL).toContain(fn);
    }
    expect(transitionIndex("smoke")).toBe(1);
  });

  it("«свет»: сначала светлое, потом тени; в начале — ничего, в конце — всё", () => {
    expect(revealLight(1, 0)).toBe(0);
    expect(revealLight(0, 1)).toBe(1);
    // На середине светлые пиксели видны, тёмные — ещё нет.
    expect(revealLight(0.9, 0.5)).toBeGreaterThan(0.9);
    expect(revealLight(0.1, 0.5)).toBeLessThan(0.1);
    // Монотонно по прогрессу для любой яркости.
    for (const luma of [0, 0.25, 0.5, 0.75, 1]) {
      let prev = 0;
      for (let p = 0; p <= 1.0001; p += 0.01) {
        const m = revealLight(luma, p);
        expect(m).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = m;
      }
      expect(revealLight(luma, 1)).toBe(1);
    }
  });
});
