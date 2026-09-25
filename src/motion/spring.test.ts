import { describe, expect, it } from "vitest";
import { Spring, springStep, VectorSpring } from "./spring";

describe("критически демпфированная пружина", () => {
  it("сходится к цели", () => {
    const s = new Spring(0, 0.3);
    s.target = 10;
    for (let i = 0; i < 240; i++) s.update(1 / 60);
    expect(s.value).toBeCloseTo(10, 4);
    expect(s.settled).toBe(true);
  });

  it("не перелетает цель (нет отскока) — движение монотонно", () => {
    const s = new Spring(0, 0.45);
    s.target = 1;
    let prev = 0;
    for (let i = 0; i < 600; i++) {
      s.update(1 / 120);
      expect(s.value).toBeGreaterThanOrEqual(prev - 1e-12);
      expect(s.value).toBeLessThanOrEqual(1 + 1e-12);
      prev = s.value;
    }
  });

  it("smoothTime задаёт темп: за smoothTime проходит заметную, но не всю часть пути", () => {
    const s = new Spring(0, 0.5);
    s.target = 1;
    for (let i = 0; i < 30; i++) s.update(1 / 60);
    expect(s.value).toBeGreaterThan(0.5);
    expect(s.value).toBeLessThan(0.7);
  });

  it("один шаг на 1 с = шестьдесят шагов по 1/60 с", () => {
    const a = { value: 3, velocity: -2 };
    const b = { value: 3, velocity: -2 };
    springStep(a, 7, 0.4, 1);
    for (let i = 0; i < 60; i++) springStep(b, 7, 0.4, 1 / 60);
    expect(a.value).toBeCloseTo(b.value, 9);
    expect(a.velocity).toBeCloseTo(b.velocity, 9);
  });

  it("сохраняет скорость при смене цели на ходу — без рывка", () => {
    const s = new Spring(0, 0.3);
    s.target = 1;
    for (let i = 0; i < 10; i++) s.update(1 / 60);
    const velocity = s.velocity;
    s.target = 2;
    s.update(1e-6);
    expect(s.velocity).toBeCloseTo(velocity, 3);
  });

  it("snap и нулевое smoothTime — сразу в цель", () => {
    const s = new Spring(0, 0.3);
    s.target = 5;
    s.snap();
    expect(s.value).toBe(5);
    expect(s.velocity).toBe(0);
    const out = { value: 0, velocity: 3 };
    springStep(out, 2, 0, 1 / 60);
    expect(out).toEqual({ value: 2, velocity: 0 });
  });
});

describe("пружина для векторов", () => {
  it("каждая компонента ведёт себя как отдельная пружина", () => {
    const v = new VectorSpring([0, 10, -5], 0.35);
    v.setTarget([1, 0, 5]);
    const singles = [new Spring(0, 0.35), new Spring(10, 0.35), new Spring(-5, 0.35)];
    singles.forEach((s, i) => (s.target = [1, 0, 5][i]!));
    for (let f = 0; f < 45; f++) {
      v.update(1 / 60);
      singles.forEach((s) => s.update(1 / 60));
    }
    singles.forEach((s, i) => expect(v.value[i]).toBeCloseTo(s.value, 12));
  });

  it("не выделяет память в кадре: update возвращает тот же буфер", () => {
    const v = new VectorSpring([0, 0], 0.3);
    expect(v.update(1 / 60)).toBe(v.value);
    v.setTarget([4, 4]);
    v.snap();
    expect([...v.value]).toEqual([4, 4]);
  });
});
