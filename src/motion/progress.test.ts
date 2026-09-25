import { describe, expect, it } from "vitest";
import {
  computeProgress,
  createProgressState,
  DIRECTION_THRESHOLD,
  type ChapterBound,
} from "./progress";

// Шесть глав: 0–1000, 1000–3000, 3000–5000, 5000–6000, 6000–7500, 7500–8000; экран 800.
const bounds: ChapterBound[] = [
  { id: "dawn", top: 0, height: 1000 },
  { id: "assembly", top: 1000, height: 2000 },
  { id: "day", top: 3000, height: 2000 },
  { id: "fire", top: 5000, height: 1000 },
  { id: "world", top: 6000, height: 1500 },
  { id: "return", top: 7500, height: 500 },
];
const VH = 800;
const MAX = 8400 - VH; // документ 8400 (с футером)

function at(scrollY: number, state = createProgressState(), anchor = { y: 0 }, dt = 1 / 60) {
  computeProgress(state, anchor, scrollY, bounds, VH, MAX, dt);
  return state;
}

describe("progress", () => {
  it("в самом верху — первая глава", () => {
    const p = at(0);
    expect(p).toMatchObject({
      chapterIndex: 0,
      chapterId: "dawn",
      global: 0,
      local: 0,
      horizon: 0,
    });
  });

  it("глава — та, чей верх прошёл середину экрана; локальный прогресс внутри", () => {
    // «Сборка» текущая с 600 (1000 − 400) до 2600 (3000 − 400); 1600 — её середина.
    const p = at(1600);
    expect(p.chapterId).toBe("assembly");
    expect(p.local).toBeCloseTo(0.5);
    expect(p.horizon).toBeCloseTo((1 + 0.5) / 5);
  });

  it("граница главы — ровно по середине экрана", () => {
    expect(at(3000 - VH / 2 - 1).chapterId).toBe("assembly");
    expect(at(3000 - VH / 2).chapterId).toBe("day");
  });

  it("в самом низу страницы — последняя глава целиком, даже если она короче экрана", () => {
    const p = at(MAX);
    expect(p).toMatchObject({ chapterId: "return", local: 1, horizon: 1, global: 1 });
  });

  it("глобальный прогресс ограничен 0…1", () => {
    expect(at(-50).global).toBe(0);
    expect(at(MAX + 500).global).toBe(1);
  });

  it("скорость — px/с, сглаженная, одинаковая на 60 и 120 Гц", () => {
    const speed = (hz: number) => {
      const state = createProgressState();
      const anchor = { y: 0 };
      let y = 0;
      for (let i = 0; i < hz; i++) {
        y += 1200 / hz; // 1200 px/с
        computeProgress(state, anchor, y, bounds, VH, MAX, 1 / hz);
      }
      return state.velocity;
    };
    expect(speed(60)).toBeCloseTo(1200, 0);
    expect(speed(120)).toBeCloseTo(speed(60), 0);
  });

  it("направление с гистерезисом: мелкое дрожание его не меняет", () => {
    const state = createProgressState();
    const anchor = { y: 1000 };
    at(1000, state, anchor);
    expect(state.direction).toBe(0);
    at(1000 + DIRECTION_THRESHOLD + 1, state, anchor);
    expect(state.direction).toBe(1);
    at(1000 + DIRECTION_THRESHOLD - 2, state, anchor); // откат на 3 px — шум
    expect(state.direction).toBe(1);
    at(1000 - 20, state, anchor);
    expect(state.direction).toBe(-1);
  });

  it("без глав (внутренние страницы) — только глобальный прогресс", () => {
    const state = createProgressState();
    computeProgress(state, { y: 0 }, 300, [], VH, 600, 1 / 60);
    expect(state).toMatchObject({ chapterId: null, chapterIndex: 0, global: 0.5, horizon: 0.5 });
  });
});
