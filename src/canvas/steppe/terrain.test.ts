import { describe, expect, it } from "vitest";
import { terrainHeight } from "./terrain";

describe("рельеф", () => {
  it("вдоль пути камеры почти ровный — камера на 0,6 м не уходит в землю", () => {
    for (let z = 20; z >= -400; z -= 5) {
      for (const x of [-10, 0, 10]) expect(Math.abs(terrainHeight(x, z))).toBeLessThan(0.45);
    }
  });

  it("вдали — мягкие холмы (метры, а не сантиметры)", () => {
    let max = 0;
    for (let x = -9000; x <= 9000; x += 500) {
      for (let z = -9000; z <= 9000; z += 500) max = Math.max(max, Math.abs(terrainHeight(x, z)));
    }
    expect(max).toBeGreaterThan(2);
    expect(max).toBeLessThan(12);
  });

  it("плавный: соседние точки через 1 м почти не отличаются", () => {
    for (let i = 0; i < 200; i++) {
      const x = (i * 137) % 5000,
        z = -((i * 71) % 5000);
      expect(Math.abs(terrainHeight(x + 1, z) - terrainHeight(x, z))).toBeLessThan(0.3);
    }
  });
});
