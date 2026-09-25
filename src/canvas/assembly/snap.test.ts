import { describe, expect, it } from "vitest";
import { SNAP_DELAY, SNAP_DURATION, snapTarget, StageSnap } from "./snap";

const run = (s: StageSnap, seconds: number, target: number, enabled = true, hz = 60) => {
  const dt = 1 / hz;
  for (let t = 0; t < seconds - 1e-9; t += dt) s.update(dt, target, enabled);
  return s.value;
};

describe("мягкое притяжение Сборки", () => {
  it("зона — последние 6% этапа", () => {
    expect(snapTarget(0.25 * 0.95)).toBeCloseTo(0.25);
    expect(snapTarget(0.25 * 0.93)).toBeNull();
    expect(snapTarget(0.25 * 2.97)).toBeCloseTo(0.75);
    expect(snapTarget(0.25)).toBeNull(); // ровно на границе — уже следующий этап
    expect(snapTarget(0)).toBeNull();
    expect(snapTarget(1)).toBeNull();
  });

  it("пока скролл идёт — сцена следует за ним со сглаживанием, без притяжения", () => {
    const s = new StageSnap(0, 0.35);
    const dt = 1 / 60;
    let target = 0;
    for (let i = 0; i < 60; i++) {
      target = Math.min(0.2375, target + 0.004);
      s.update(dt, target, true);
    }
    expect(s.snapping).toBe(false);
    expect(s.value).toBeLessThanOrEqual(target);
  });

  it("остановка в зоне: 200 мс ничего, затем за 500 мс сцена доезжает до конца этапа", () => {
    const s = new StageSnap(0.24, 0.35);
    s.jump(0.24);
    run(s, SNAP_DELAY - 0.05, 0.24);
    expect(s.snapping).toBe(false);
    expect(s.value).toBeCloseTo(0.24, 5);
    run(s, 0.1, 0.24);
    expect(s.snapping).toBe(true);
    run(s, SNAP_DURATION, 0.24);
    expect(s.value).toBeCloseTo(0.25, 6);
    // Держится в конце этапа, пока человек не двинет скролл.
    run(s, 2, 0.24);
    expect(s.value).toBeCloseTo(0.25, 6);
  });

  it("остановка вне зоны — притяжения нет", () => {
    const s = new StageSnap(0.2, 0.35);
    s.jump(0.2);
    run(s, 2, 0.2);
    expect(s.snapping).toBe(false);
    expect(s.value).toBeCloseTo(0.2, 6);
  });

  it("скролл снова пошёл — притяжение отпускает, сцена плавно идёт за скроллом", () => {
    const s = new StageSnap(0.24, 0.35);
    s.jump(0.24);
    run(s, 1, 0.24);
    expect(s.value).toBeCloseTo(0.25, 5);
    s.update(1 / 60, 0.2, true);
    expect(s.snapping).toBe(false);
    // Без скачка: первый кадр после отпускания рядом с 0,25.
    expect(s.value).toBeGreaterThan(0.245);
    run(s, 2, 0.2);
    expect(s.value).toBeCloseTo(0.2, 3);
  });

  it("выключено (reduced motion) — не притягивает", () => {
    const s = new StageSnap(0.24, 0.35);
    s.jump(0.24);
    run(s, 2, 0.24, false);
    expect(s.value).toBeCloseTo(0.24, 6);
  });

  it("одинаково на 60 и 120 Гц", () => {
    const a = new StageSnap(0, 0.35);
    const b = new StageSnap(0, 0.35);
    run(a, 0.5, 0.2, true, 60);
    run(b, 0.5, 0.2, true, 120);
    expect(a.value).toBeCloseTo(b.value, 3);
    run(a, 1.2, 0.24, true, 60);
    run(b, 1.2, 0.24, true, 120);
    expect(a.value).toBeCloseTo(b.value, 3);
  });
});
