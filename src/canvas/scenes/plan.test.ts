import { describe, expect, it } from "vitest";
import { planScenes } from "./plan";

const registry = ["dawn", "assembly", "day", "fire", "world", "return"].map((id, index) => ({
  id,
  index,
  memoryMb: 50,
}));
const plan = (current: number, local: number, loaded: string[], memoryLimitMb = 1024) =>
  planScenes({ current, local, loaded: new Set(loaded), registry, memoryLimitMb });

describe("менеджер сцен", () => {
  it("текущая глава загружается сразу", () => {
    expect(plan(0, 0, []).load).toEqual(["dawn"]);
    // Обновление страницы посреди сайта — сразу нужная глава, без предыдущих.
    expect(plan(3, 0.2, []).load).toEqual(["fire"]);
  });

  it("следующая — после 50% текущей", () => {
    expect(plan(0, 0.49, ["dawn"]).load).toEqual([]);
    expect(plan(0, 0.5, ["dawn"]).load).toEqual(["assembly"]);
  });

  it("dispose дальше двух глав", () => {
    const p = plan(3, 0.1, ["dawn", "assembly", "day", "fire"]);
    expect(p.dispose).toEqual(["dawn"]);
    expect(p.keep.sort()).toEqual(["assembly", "day", "fire"]);
  });

  it("лимит памяти (iOS 300 МБ): сначала выгружаются дальние, текущая остаётся всегда", () => {
    // 120 МБ — это текущая глава и предзагрузка следующей (по 50 МБ). Прошлые уходят, дальняя первой.
    const p = plan(3, 0.6, ["assembly", "day", "fire"], 120);
    expect(p.dispose).toEqual(["assembly", "day"]);
    expect(p.load).toEqual(["world"]);
    expect(p.memoryMb).toBeLessThanOrEqual(120);
    expect(p.keep).toEqual(["fire"]);

    const roomy = plan(3, 0.6, ["assembly", "day", "fire"], 170);
    expect(roomy.dispose).toEqual(["assembly"]);
  });

  it("если памяти нет даже на предзагрузку — от неё отказываемся", () => {
    const p = plan(3, 0.9, ["fire"], 60);
    expect(p.load).toEqual([]);
    expect(p.keep).toEqual(["fire"]);
  });
});
