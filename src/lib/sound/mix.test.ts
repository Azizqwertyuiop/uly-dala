import { describe, expect, it } from "vitest";
import { chapterIds } from "@/components/sections/chapters";
import { bedGains, BEDS, CHAPTER_MIX, gustLevel, SOUND_FILES, SOUND_SLOTS } from "./mix";

describe("звук — микс", () => {
  it("у каждой главы есть микс, у каждого слота — файл", () => {
    for (const id of chapterIds)
      for (const bed of BEDS) expect(CHAPTER_MIX[id][bed]).toBeGreaterThanOrEqual(0);
    for (const slot of SOUND_SLOTS) expect(SOUND_FILES[slot]).toMatch(/^\/assets\/audio\/.+\.m4a$/);
  });

  it("шелест усиливается на порывах, угли — нет", () => {
    const calm = bedGains("dawn", 0);
    const windy = { ...bedGains("dawn", 1) };
    expect(windy.grass).toBeGreaterThan(calm.grass * 1.8);
    expect(windy.wind).toBeGreaterThan(calm.wind);
    expect(bedGains("fire", 1).embers).toBe(bedGains("fire", 0).embers);
  });

  it("огонь — угли, финал — снова степь (как рассвет)", () => {
    expect(CHAPTER_MIX.fire.embers).toBeGreaterThan(CHAPTER_MIX.fire.wind);
    expect(CHAPTER_MIX.return.wind).toBe(CHAPTER_MIX.dawn.wind);
    expect(CHAPTER_MIX.return.grass).toBe(CHAPTER_MIX.dawn.grass);
  });

  it("порыв: из сцены, если свежий; иначе — от курсора", () => {
    expect(gustLevel({ gust: 0.8, gustAt: 10 }, 10.1, 0)).toBe(0.8);
    expect(gustLevel({ gust: 0.8, gustAt: 1 }, 10, 0)).toBe(0);
    expect(gustLevel({ gust: 0, gustAt: -Infinity }, 10, 5)).toBeGreaterThan(0.8);
  });
});
