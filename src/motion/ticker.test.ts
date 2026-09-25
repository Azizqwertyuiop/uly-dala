import { describe, expect, it } from "vitest";
import { Spring } from "./spring";
import { fakeTicker } from "./testing";
import { MAX_DELTA } from "./tokens";

describe("ticker", () => {
  it("вызывает фазы строго в порядке input → progress → timeline → damping → render", () => {
    const { ticker, run } = fakeTicker();
    const order: string[] = [];
    // Подписываемся в обратном порядке — порядок вызова от этого не зависит.
    for (const phase of ["render", "damping", "timeline", "progress", "input"] as const) {
      ticker.add(phase, () => order.push(phase));
    }
    run(1 / 60, 60);
    run(1 / 60, 60);
    expect(order.slice(-5)).toEqual(["input", "progress", "timeline", "damping", "render"]);
  });

  it("delta в секундах и не больше 0,1 с", () => {
    const { ticker, frameAfter } = fakeTicker();
    const deltas: number[] = [];
    ticker.add("input", (dt) => deltas.push(dt));
    frameAfter(16); // первый кадр — delta 0
    frameAfter(16);
    frameAfter(2000); // долгий кадр (сборщик мусора, отладчик)
    expect(deltas[0]).toBe(0);
    expect(deltas[1]).toBeCloseTo(0.016, 6);
    expect(deltas[2]).toBe(MAX_DELTA);
  });

  it("ровно один нативный rAF на кадр, сколько бы ни было подписчиков и сторонних rAF", () => {
    const { ticker, run, stats } = fakeTicker();
    for (let i = 0; i < 10; i++) ticker.add("render", () => {});
    // «Сторонняя библиотека» просит кадр через мост — и перепланирует себя каждый кадр.
    const loop = () => ticker.requestFrame(loop);
    ticker.requestFrame(loop);
    const before = stats.nativeCalls;
    run(1, 120);
    expect(stats.nativeCalls - before).toBe(120);
    expect(ticker.frames).toBe(120);
  });

  it("колбэки моста rAF выполняются один раз, в начале кадра, и отменяются", () => {
    const { ticker, run } = fakeTicker();
    const log: string[] = [];
    ticker.add("input", () => log.push("input"));
    ticker.requestFrame(() => log.push("bridged"));
    const cancelled = ticker.requestFrame(() => log.push("cancelled"));
    ticker.cancelFrame(cancelled);
    run(2 / 60, 60);
    expect(log).toEqual(["bridged", "input", "input"]);
  });

  it("пауза при document.hidden и без скачка времени после возврата", () => {
    const { ticker, run, setHidden, frameAfter } = fakeTicker();
    const deltas: number[] = [];
    ticker.add("input", (dt) => deltas.push(dt));
    run(0.1, 60);
    const time = ticker.time;
    setHidden(true);
    run(5, 60); // вкладка скрыта — кадров нет
    expect(ticker.time).toBe(time);
    setHidden(false);
    frameAfter(30_000);
    expect(deltas.at(-1)).toBe(0);
  });

  it("останавливается без подписчиков", () => {
    const f = fakeTicker();
    const off = f.ticker.add("render", () => {});
    f.run(0.05, 60);
    off();
    f.run(1 / 60, 60);
    expect(f.queued).toBe(false);
  });
});

describe("анимации одинаковы на 60 и 120 Гц (подмена delta)", () => {
  function simulate(hz: number) {
    const { ticker, run } = fakeTicker();
    const spring = new Spring(0, 0.45);
    spring.target = 1;
    const samples: number[] = [];
    ticker.add("damping", (dt) => spring.update(dt));
    run(1 / hz, hz); // первый кадр с dt = 0 — «старт»
    for (let i = 0; i < 12; i++) {
      run(0.1, hz);
      samples.push(spring.value);
    }
    return samples;
  }

  it("пружина через ticker даёт те же значения в те же моменты", () => {
    const at60 = simulate(60);
    const at120 = simulate(120);
    at60.forEach((value, i) => expect(at120[i]).toBeCloseTo(value, 9));
  });

  it("и на неровных кадрах (30–144 Гц вперемешку)", () => {
    const steady = new Spring(0, 0.35);
    const jittery = new Spring(0, 0.35);
    steady.target = jittery.target = 100;
    for (let i = 0; i < 60; i++) steady.update(1 / 60);
    const pattern = [1 / 30, 1 / 144, 1 / 90, 1 / 144, 1 / 60, 1 / 120];
    let t = 0;
    let i = 0;
    while (t < 1 - 1e-9) {
      const dt = Math.min(pattern[i++ % pattern.length]!, 1 - t);
      jittery.update(dt);
      t += dt;
    }
    expect(jittery.value).toBeCloseTo(steady.value, 9);
  });
});
