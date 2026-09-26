import { MathUtils } from "three";
import { describe, expect, it } from "vitest";
import {
  computeDawnState,
  computeMorning,
  MORNING_FROM,
  MORNING_TO,
  horizonFraction,
  horizonPitch,
  horseOffsetX,
  INTRO,
  STEP_AMPLITUDE,
  STEP_PERIOD,
  stepBob,
  WAVE_FROM,
  WAVE_TO,
} from "./dawn";

const at = (introTime: number | null, local = 0, waveEnabled = true) =>
  computeDawnState({ local, introTime, waveEnabled });

describe("интро рассвета (таймлайн раздела 2, от готовности сцены)", () => {
  it("небо → конь → волна → текст → подсказка", () => {
    expect(at(0).skyReveal).toBe(0);
    expect(at(1).skyReveal).toBe(1);
    expect(at(1).horseAlpha).toBe(0);
    expect(at(2).horseAlpha).toBe(1);
    expect(at(1.9).waveStrength).toBe(0);
    expect(at(2.75).waveStrength).toBeCloseTo(1, 1);
    expect(at(2.6).textReveal).toBe(false);
    expect(at(INTRO.text).textReveal).toBe(true);
    expect(at(4.4).hintVisible).toBe(false);
    expect(at(4.5).hintVisible).toBe(true);
  });

  it("волна катится от горизонта к камере", () => {
    const fronts = [2.05, 2.5, 3, 3.45].map((t) => at(t).waveFront);
    for (let i = 1; i < fronts.length; i++) expect(fronts[i]).toBeLessThan(fronts[i - 1]!);
    expect(fronts[0]).toBeLessThan(WAVE_FROM);
    expect(fronts.at(-1)).toBeGreaterThan(WAVE_TO);
  });

  it("волна — только при первом визите", () => {
    expect(at(2.75, 0, false).waveStrength).toBe(0);
    expect(at(2.75, 0, false).skyReveal).toBe(1);
  });

  it("без интро (обновление посреди страницы, reduced motion) — сразу конечное состояние", () => {
    const s = at(null);
    expect(s).toMatchObject({
      skyReveal: 1,
      horseAlpha: 1,
      waveStrength: 0,
      textReveal: true,
      introDone: true,
    });
    expect(s.hintVisible).toBe(false);
  });
});

describe("скролл главы (150vh)", () => {
  it("восход: солнце с −1° поднимается, туман рассеивается", () => {
    expect(at(null, 0).sunElevation).toBe(-1);
    expect(at(null, 1).sunElevation).toBe(3);
    expect(at(null, 0).groundFog).toBe(1);
    expect(at(null, 1).groundFog).toBeCloseTo(0.25);
  });

  it("текст уходит, конь смотрит в камеру и уходит шагом", () => {
    expect(at(null, 0.2).textOut).toBe(false);
    expect(at(null, 0.4).textOut).toBe(true);
    expect(at(null, 0.1).horseClip).toBe("idle");
    expect(at(null, 0.45).horseClip).toBe("look");
    expect(at(null, 0.7).horseClip).toBe("walk");
    expect(at(null, 0.5).horseWalk).toBe(0);
    expect(at(null, 1).horseWalk).toBe(1);
    expect(at(null, 1).horseAlpha).toBe(0);
  });

  it("подсказка скролла пропадает, как только начали листать", () => {
    expect(at(5, 0).hintVisible).toBe(true);
    expect(at(5, 0.05).hintVisible).toBe(false);
  });
});

describe("композиция первого экрана", () => {
  const fov = 10.16; // 135 мм

  it("горизонт на 72% сверху, на мобильных — на 68%", () => {
    expect(horizonFraction(16 / 9)).toBe(0.72);
    expect(horizonFraction(9 / 19.5)).toBe(0.68);
    for (const aspect of [16 / 9, 9 / 19.5]) {
      const pitch = horizonPitch(fov, aspect);
      // Проекция направления с тангажом 0 при камере, поднятой на pitch.
      const ndc = -Math.tan(pitch) / Math.tan(MathUtils.degToRad(fov) / 2);
      expect((1 - ndc) / 2).toBeCloseTo(horizonFraction(aspect), 6);
    }
  });

  it("конь — на правой трети кадра, ~275 м", () => {
    const aspect = 16 / 9;
    const x = horseOffsetX(fov, aspect);
    const ndc = x / (Math.tan(MathUtils.degToRad(fov) / 2) * aspect * 275);
    expect(ndc).toBeCloseTo(1 / 3, 6);
  });
});

describe("шаг коня на переходе в Сборку", () => {
  it("ритм 0,6 с, только внутри 40vh перехода", () => {
    expect(stepBob(0.3, 0)).toBe(0);
    expect(stepBob(0.3, 1)).toBe(0);
    expect(Math.abs(stepBob(STEP_PERIOD / 2, 0.5))).toBeCloseTo(STEP_AMPLITUDE, 6);
    expect(stepBob(STEP_PERIOD * 2, 0.5)).toBeCloseTo(0, 6);
  });
});

describe("утро «Сборки»", () => {
  const end = at(null, 1);

  it("на рассвете утра нет; на переходе — непрерывно, без склейки", () => {
    const before = computeMorning(end, MORNING_FROM, 0);
    expect(before.daylight).toBe(0);
    expect(before.sunElevation).toBe(end.sunElevation);
    expect(before.exposure).toBe(end.exposure);
    expect(before.groundFog).toBe(end.groundFog);
    const e = 1e-3;
    const a = computeMorning(end, MORNING_FROM + 0.05, 0);
    const b = computeMorning(end, MORNING_FROM + 0.05 + e, 0);
    expect(Math.abs(b.daylight - a.daylight)).toBeLessThan(0.05);
  });

  it("к 07:00 — светло, солнце выше, туман почти ушёл, экспозиция 1", () => {
    const m = computeMorning(end, MORNING_TO, 1);
    expect(m.daylight).toBe(1);
    expect(m.sunElevation).toBeCloseTo(end.sunElevation + 7, 6);
    expect(m.groundFog).toBeCloseTo(end.groundFog * 0.2, 6);
    expect(m.exposure).toBe(1);
  });
});
