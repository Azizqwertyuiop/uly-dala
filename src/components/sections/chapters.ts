/** Главы главной страницы в порядке сюжета (CLAUDE.md, раздел 2). id — стабильные якоря. */
export const chapterIds = ["dawn", "assembly", "day", "fire", "world", "return"] as const;

export type ChapterId = (typeof chapterIds)[number];

export type Tone = "light" | "dark";

export const chapterTone: Record<ChapterId, Tone> = {
  dawn: "dark",
  assembly: "light",
  day: "light",
  fire: "dark",
  world: "dark",
  return: "dark",
};
