import { describe, expect, it } from "vitest";
import { contrastRatio, relativeLuminance } from "./color";

describe("color", () => {
  it("считает яркость по WCAG", () => {
    expect(relativeLuminance("#000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("считает контраст по WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
    // Эталон WebAIM: #767676 на белом = 4.54:1
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  it("отвергает некорректный цвет", () => {
    expect(() => relativeLuminance("indigo")).toThrow();
  });
});
