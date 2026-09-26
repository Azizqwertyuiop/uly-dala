import { describe, expect, it } from "vitest";
import {
  computeDayLight,
  createDayLight,
  DAY_FRAMING,
  DAY_LIGHT,
  DAY_STATES,
  DEFAULT_ORDER,
  KUDALYK_TEMPO,
  slotCenter,
  STATE_SPAN,
  stateAt,
  veil,
} from "./timeline";

describe("«День»: шесть состояний одной сцены", () => {
  it("дорожка делится на шесть равных частей", () => {
    expect(DAY_STATES).toBe(6);
    expect(stateAt(0)).toEqual({ index: 0, local: 0 });
    expect(stateAt(STATE_SPAN * 2.5).index).toBe(2);
    expect(stateAt(STATE_SPAN * 2.5).local).toBeCloseTo(0.5);
    expect(stateAt(1).index).toBe(5);
  });

  it("завеса света и тумана — на границах и на входе, в покое её нет", () => {
    expect(veil(0)).toBe(1);
    for (let k = 1; k < DAY_STATES; k++) expect(veil(k * STATE_SPAN)).toBeCloseTo(1, 6);
    for (let k = 0; k < DAY_STATES; k++) expect(veil((k + 0.5) * STATE_SPAN)).toBe(0);
  });

  it("свет состояния в покое — свой; меняется только внутри завесы", () => {
    const out = createDayLight();
    const order = DEFAULT_ORDER;
    order.forEach((slug, k) => {
      computeDayLight((k + 0.5) * STATE_SPAN, order, out);
      expect(out.sun).toBeCloseTo(DAY_LIGHT[slug].sun, 6);
      expect(out.dusk).toBeCloseTo(DAY_LIGHT[slug].dusk, 6);
      expect(out.veil).toBe(0);
    });
    // Скачков нет: свет непрерывен по всей дорожке.
    let prev = computeDayLight(0, order, createDayLight()).sun;
    for (let i = 1; i <= 3000; i++) {
      const s = computeDayLight(i / 3000, order, out).sun;
      expect(Math.abs(s - prev)).toBeLessThan(1);
      prev = s;
    }
  });

  it("свет смены «полдень → вечер» спрятан в завесе (туман густой)", () => {
    const order = DEFAULT_ORDER;
    const k = order.indexOf("wedding");
    const out = createDayLight();
    for (let i = -20; i <= 20; i++) {
      const p = k * STATE_SPAN + (i / 20) * STATE_SPAN * 0.3;
      computeDayLight(p, order, out);
      const mid = (DAY_LIGHT[order[k - 1]!].sun + DAY_LIGHT.wedding.sun) / 2;
      // Где свет «на полпути», завеса почти полная.
      if (Math.abs(out.sun - mid) < 5) expect(out.veil).toBeGreaterThan(0.6);
    }
  });

  it("порядок развилки меняет свет по слотам", () => {
    const family = [...DEFAULT_ORDER].sort((a, b) =>
      a === "kudalyk" ? -1 : b === "kudalyk" ? 1 : 0,
    );
    const out = computeDayLight(0.5 * STATE_SPAN, family, createDayLight());
    expect(out.sun).toBe(DAY_LIGHT.kudalyk.sun);
  });

  it("площадки — вдоль пути сбоку, не пересекаются", () => {
    for (let k = 1; k < DAY_STATES; k++) {
      const a = slotCenter(k - 1);
      const b = slotCenter(k);
      expect(a[0]).toBe(b[0]);
      expect(a[2] - b[2]).toBeGreaterThanOrEqual(10);
    }
  });

  it("кудалык спокойнее: наезд в 1,6 раза короче", () => {
    const len = (d: [number, number, number]) => Math.hypot(...d);
    expect(len(DAY_FRAMING.kudalyk.dolly) * KUDALYK_TEMPO).toBeCloseTo(
      len(DAY_FRAMING.conference.dolly),
      6,
    );
    // Камера на уровне человека, ≤ 1,8 м.
    for (const f of Object.values(DAY_FRAMING)) expect(f.position[1]).toBeLessThanOrEqual(1.8);
  });
});
