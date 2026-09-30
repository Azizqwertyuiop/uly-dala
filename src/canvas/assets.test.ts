import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chapterIds } from "@/components/sections/chapters";
import { assets, assetsOfChapter, type Tier } from "./assets";
import { BUDGETS } from "./budgets";

const file = (url: string) => join(process.cwd(), "public", url);
const size = (url: string) => statSync(file(url)).size;

function urlsOf(asset: (typeof assets)[keyof typeof assets], tier: Tier): string[] {
  if (asset.kind === "model") return [asset.variants[tier]];
  if (asset.kind === "video") {
    // Браузер берёт одно из двух — считаем худший вариант.
    const v = asset.variants[tier];
    return [size(v.hevc) > size(v.vp9) ? v.hevc : v.vp9, asset.poster];
  }
  if (asset.kind === "clip") return [asset.url, asset.poster];
  return [asset.url];
}

describe("манифест ассетов", () => {
  it("все файлы существуют (запущен npm run assets)", () => {
    for (const asset of Object.values(assets)) {
      for (const tier of ["high", "medium"] as const) {
        for (const url of urlsOf(asset, tier)) expect(existsSync(file(url)), url).toBe(true);
      }
    }
    expect(existsSync(file("/assets/decoders/basis/basis_transcoder.wasm"))).toBe(true);
  });

  it("у каждой модели есть варианты high и medium", () => {
    for (const asset of Object.values(assets)) {
      if (asset.kind !== "model") continue;
      expect(asset.variants.high).toMatch(/\.high\.glb$/);
      expect(asset.variants.medium).toMatch(/\.medium\.glb$/);
    }
  });

  for (const tier of ["high", "medium"] as const) {
    it(`бюджеты глав (${tier}): «Рассвет» ≤ 2,5 МБ, остальные ≤ 4 МБ`, () => {
      for (const chapter of chapterIds) {
        const bytes = assetsOfChapter(chapter).reduce(
          (sum, a) => sum + urlsOf(a, tier).reduce((s, u) => s + size(u), 0),
          0,
        );
        const limit = chapter === "dawn" ? BUDGETS.firstScene : BUDGETS.chapter;
        expect(bytes, `${chapter}: ${(bytes / 1024).toFixed(0)} КБ`).toBeLessThanOrEqual(limit);
      }
    });
  }
});
