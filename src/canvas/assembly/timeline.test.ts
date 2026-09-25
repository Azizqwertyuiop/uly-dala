import { describe, expect, it } from "vitest";
import {
  computeAssembly,
  createAssemblyState,
  KEREGE_PANELS,
  pathFraction,
  POLE_COUNT,
  POLE_PAIRS,
  POLE_RANK,
  SETTLE_PATH,
  SETTLE_TIME,
  STAGE_SPAN,
  UYKI_STAGGER,
  type AssemblyState,
} from "./timeline";

const at = (p: number) => {
  const s = computeAssembly(p, createAssemblyState());
  return { ...s, panels: [...s.panels], accordion: [...s.accordion], poles: [...s.poles] };
};
const all = (xs: number[], v: number) => xs.every((x) => x === v);
const scalars = (s: AssemblyState) =>
  [
    ...s.panels,
    ...s.accordion,
    s.tech,
    s.door,
    ...s.poles,
    s.crown,
    s.cover,
    s.doorOpen,
    s.pillar,
    s.techOn,
  ] as number[];

describe("таймлайн сборки", () => {
  it("p = 0 — пустая степь, p = 1 — всё собрано и светится", () => {
    const empty = at(0);
    expect(scalars(computeAssembly(0, createAssemblyState())).every((v) => v === 0)).toBe(true);
    expect(empty.phase).toBe("kerege");
    const done = computeAssembly(1, createAssemblyState());
    expect(scalars(done).every((v) => v === 1)).toBe(true);
    expect(done.phase).toBe("pillar");
  });

  it("4 этапа по 25%: кереге → уықи → шаңырақ → кийиз", () => {
    expect(STAGE_SPAN).toBe(0.25);
    expect(at(0.1).phase).toBe("kerege");
    expect(at(0.3).phase).toBe("uyki");
    expect(at(0.6).phase).toBe("shanyrak");
    expect(at(0.8).phase).toBe("kiiz");
    expect(at(0.97).phase).toBe("pillar");
  });

  it("порядок не ломается ни при каком p: следующая деталь — только после предыдущего этапа", () => {
    for (let i = 0; i <= 2000; i++) {
      const s = at(i / 2000);
      if (s.poles.some((u) => u > 0)) expect(all(s.panels, 1)).toBe(true);
      if (s.crown > 0) expect(all(s.poles, 1)).toBe(true);
      if (s.cover > 0) expect(s.crown).toBe(1);
      if (s.pillar > 0) expect(s.cover).toBe(1);
    }
  });

  it("монотонность: с ростом p ни одна деталь не откатывается (и наоборот — при скролле назад)", () => {
    let prev = scalars(computeAssembly(0, createAssemblyState()));
    for (let i = 1; i <= 1000; i++) {
      const next = scalars(computeAssembly(i / 1000, createAssemblyState()));
      next.forEach((v, k) => expect(v).toBeGreaterThanOrEqual(prev[k]! - 1e-6));
      prev = next;
    }
  });

  it("полная обратимость: после прыжков туда-обратно состояние то же (чистая функция)", () => {
    const out = createAssemblyState();
    const reference = scalars(computeAssembly(0.42, createAssemblyState()));
    for (const p of [0.9, 0.05, 1, 0.3, 0, 0.77]) computeAssembly(p, out);
    expect(scalars(computeAssembly(0.42, out))).toEqual(reference);
  });

  it("быстрый скролл (прыжок через этапы) даёт то же, что медленный", () => {
    const slow = createAssemblyState();
    for (let i = 0; i <= 700; i++) computeAssembly(i / 1000, slow);
    const fast = computeAssembly(0.7, createAssemblyState());
    expect(scalars(fast)).toEqual(scalars(slow));
  });

  it("кереге: панели по очереди, гармошка раскрывается у места", () => {
    const s = at(STAGE_SPAN * 0.3);
    expect(s.panels[0]).toBeGreaterThan(s.panels[KEREGE_PANELS - 1]!);
    for (let k = 0; k < KEREGE_PANELS; k++) {
      if (s.panels[k]! < 0.55) expect(s.accordion[k]).toBe(0);
    }
  });

  it("уықи: пары напротив друг друга, сдвиг между парами — 3% этапа", () => {
    expect(POLE_COUNT).toBe(POLE_PAIRS * 2);
    expect(new Set(POLE_RANK).size).toBe(POLE_PAIRS);
    const s = at(STAGE_SPAN * 1.3);
    for (let i = 0; i < POLE_PAIRS; i++) expect(s.poles[i]).toBe(s.poles[i + POLE_PAIRS]);
    // Пара с очередью 0 и пара с очередью 1: старт отличается ровно на 3% этапа.
    const first = POLE_RANK.indexOf(0);
    const second = POLE_RANK.indexOf(1);
    const local = 0.1;
    const s2 = at(STAGE_SPAN * (1 + local));
    const u1 = s2.poles[first]!;
    const u2 = s2.poles[second]!;
    const shifted = at(STAGE_SPAN * (1 + local + UYKI_STAGGER)).poles[second]!;
    expect(u1).toBeGreaterThan(u2);
    expect(shifted).toBeCloseTo(u1, 5);
  });

  it("шаңырақ опускается медленнее всех деталей", () => {
    // Длительность в долях этапа: пока шаңырақ идёт, жердь успела бы пройти путь много раз.
    let crownFrames = 0;
    let poleFrames = 0;
    for (let i = 0; i <= 1000; i++) {
      const s = at(i / 1000);
      if (s.crown > 0 && s.crown < 1) crownFrames++;
      if (s.poles[0]! > 0 && s.poles[0]! < 1) poleFrames++;
    }
    expect(crownFrames).toBeGreaterThan(poleFrames * 3);
  });

  it("последние 8% пути — settle: на них уходит 20% времени, без рывка на стыке", () => {
    expect(pathFraction(0)).toBe(0);
    expect(pathFraction(1)).toBe(1);
    expect(pathFraction(1 - SETTLE_TIME)).toBeCloseTo(1 - SETTLE_PATH, 6);
    const e = 1e-4;
    const t = 1 - SETTLE_TIME;
    const before = (pathFraction(t) - pathFraction(t - e)) / e;
    const after = (pathFraction(t + e) - pathFraction(t)) / e;
    expect(after / before).toBeGreaterThan(0.9);
    expect(after / before).toBeLessThan(1.1);
    // Монотонно, без отскока.
    let prev = 0;
    for (let u = 0; u <= 1; u += 0.001) {
      expect(pathFraction(u)).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = pathFraction(u);
    }
  });

  it("финал: войлок закрыт → открывается дверь → столп света → техника", () => {
    const s = at(0.75 + STAGE_SPAN * 0.95);
    expect(s.cover).toBe(1);
    expect(s.doorOpen).toBe(1);
    expect(s.pillar).toBeGreaterThan(0.9);
    expect(s.techOn).toBeGreaterThan(0.9);
    expect(at(0.75 + STAGE_SPAN * 0.5).pillar).toBe(0);
  });
});
