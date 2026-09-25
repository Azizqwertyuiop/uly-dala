import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/color";
import { duration, ease, stagger } from "@/motion/tokens";
import { palette, zIndex } from "./tokens";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

function cssVar(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css);
  if (!match?.[1]) throw new Error(`В tokens.css нет --${name}`);
  return match[1].trim();
}

describe("дизайн-токены", () => {
  it("палитра в CSS совпадает с TS", () => {
    for (const [name, hex] of Object.entries(palette)) {
      expect(cssVar(name).toLowerCase(), name).toBe(hex.toLowerCase());
    }
  });

  it("z-слои в CSS совпадают с TS", () => {
    for (const [name, value] of Object.entries(zIndex)) {
      expect(Number(cssVar(`z-${name}`)), name).toBe(value);
    }
  });

  it("кривые в CSS совпадают с TS", () => {
    for (const [name, points] of Object.entries(ease)) {
      expect(cssVar(`ease-${name}`), name).toBe(`cubic-bezier(${points.join(", ")})`);
    }
  });

  it("длительности и stagger в CSS совпадают с TS", () => {
    for (const [name, ms] of Object.entries(duration)) {
      expect(cssVar(`duration-${name}`), name).toBe(`${ms}ms`);
    }
    for (const [name, ms] of Object.entries(stagger)) {
      expect(cssVar(`stagger-${name}`), name).toBe(`${ms}ms`);
    }
  });

  it("нет упругих кривых: все контрольные точки по y в [0, 1]", () => {
    for (const [name, [, y1, , y2]] of Object.entries(ease)) {
      expect(y1, name).toBeGreaterThanOrEqual(0);
      expect(y1, name).toBeLessThanOrEqual(1);
      expect(y2, name).toBeGreaterThanOrEqual(0);
      expect(y2, name).toBeLessThanOrEqual(1);
    }
  });

  it("контраст --kumys на --indigo ≥ 7:1 (текст первого экрана)", () => {
    const ratio = contrastRatio(cssVar("kumys"), cssVar("indigo"));
    console.info(`Контраст --kumys на --indigo: ${ratio.toFixed(2)}:1`);
    expect(ratio).toBeGreaterThanOrEqual(7);
  });
});
