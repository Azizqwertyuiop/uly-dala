import { chapterIds, type ChapterId } from "@/components/sections/chapters";

/*
 * Мир сцены: главы стоят вдоль оси −Z, по одной на каждые CHAPTER_SPACING метров.
 * Единицы — метры (высота камеры 0,6 м на рассвете и т. д.).
 * TODO(assets): при появлении настоящих сцен якоря и ключевые кадры камеры подгоняются под них.
 */
export const CHAPTER_SPACING = 60;

export const chapterIndex = (id: ChapterId) => chapterIds.indexOf(id);

/** Якорь главы в мире: [x, y, z]. */
export function chapterAnchor(index: number): [number, number, number] {
  return [0, 0, -index * CHAPTER_SPACING];
}

/** Темп главы → токены движения (раздел 5). */
export const chapterTempoId = {
  dawn: "dawn",
  assembly: "assembly",
  day: "day",
  fire: "fire",
  world: "world",
  return: "dawnAgain",
} as const satisfies Record<ChapterId, string>;
