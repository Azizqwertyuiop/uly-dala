import { describe, expect, it } from "vitest";
import { createInputState, normalize, updateInput, type RawPointer } from "./input";

describe("input", () => {
  it("нормализует координаты: центр — 0, края — ±1, y вверх", () => {
    expect(normalize(500, 400, 1000, 800)).toEqual({ x: 0, y: 0 });
    expect(normalize(0, 0, 1000, 800)).toEqual({ x: -1, y: 1 });
    expect(normalize(1000, 800, 1000, 800)).toEqual({ x: 1, y: -1 });
  });

  it("скорость в нормализованных единицах в секунду, одинаковая на 60 и 120 Гц", () => {
    const run = (hz: number) => {
      const state = createInputState();
      const raw: RawPointer = { x: -1, y: 0, moved: true };
      updateInput(state, raw, 1 / hz);
      for (let i = 1; i <= hz / 2; i++) {
        raw.x = -1 + (i / (hz / 2)) * 1; // из −1 в 0 за 0,5 с = 2 ед./с
        raw.moved = true;
        updateInput(state, raw, 1 / hz);
      }
      return state;
    };
    expect(run(60).vx).toBeCloseTo(2, 1);
    expect(run(120).vx).toBeCloseTo(run(60).vx, 2);
    expect(run(60).speed).toBeCloseTo(Math.abs(run(60).vx), 6);
  });

  it("курсор остановился — скорость затухает", () => {
    const state = createInputState();
    const raw: RawPointer = { x: 0, y: 0, moved: true };
    updateInput(state, raw, 1 / 60);
    raw.x = 0.5;
    raw.moved = true;
    updateInput(state, raw, 1 / 60);
    expect(state.vx).toBeGreaterThan(1);
    for (let i = 0; i < 60; i++) updateInput(state, raw, 1 / 60);
    expect(state.vx).toBeLessThan(0.01);
    expect(state.x).toBe(0.5);
  });
});
