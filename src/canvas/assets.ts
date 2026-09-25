import type { ChapterId } from "@/components/sections/chapters";

/*
 * Манифест ассетов 3D (CLAUDE.md, раздел 6): путь, глава, варианты high / medium.
 * Файлы — результат конвейера `npm run assets` (scripts/optimize-assets.mjs) из assets-src/.
 * Бюджеты по главам проверяет e2e/budgets.spec.ts (раздел 12).
 * TODO(assets): настоящие модели и видео художника заменят заглушки с теми же именами.
 */

export type Tier = "high" | "medium";

export type ModelAsset = {
  kind: "model";
  chapter: ChapterId;
  variants: Record<Tier, string>;
  /** Имена узлов, которые код ищет в модели (контракт с художником — docs/assets.md). */
  nodes: readonly string[];
};

export type VideoAsset = {
  kind: "video";
  chapter: ChapterId;
  /** HEVC + alpha — Safari (и все браузеры iOS); VP9 + alpha WebM — остальные. */
  variants: Record<Tier, { hevc: string; vp9: string }>;
  /** Постер с альфой — при запрете автоплея. */
  poster: string;
  /** Пропорции кадра (ширина / высота). */
  aspect: number;
};

export type TextureAsset = { kind: "texture"; chapter: ChapterId | "global"; url: string };

const model = (name: string, chapter: ChapterId, nodes: readonly string[]): ModelAsset => ({
  kind: "model",
  chapter,
  variants: {
    high: `/assets/models/${name}.high.glb`,
    medium: `/assets/models/${name}.medium.glb`,
  },
  nodes,
});

export const assets = {
  horse: {
    kind: "video",
    chapter: "dawn",
    variants: {
      high: {
        hevc: "/assets/video/horse-test.high.mov",
        vp9: "/assets/video/horse-test.high.webm",
      },
      medium: {
        hevc: "/assets/video/horse-test.medium.mov",
        vp9: "/assets/video/horse-test.medium.webm",
      },
    },
    poster: "/assets/video/horse-test.poster.png",
    aspect: 16 / 9,
  },
  horsePlane: model("horse", "dawn", ["horse_plane"]),
  yurt: model("yurt", "assembly", ["kerege", "uyki", "shanyrak", "kiiz", "esik"]),
  ledWall: model("led_wall", "day", ["led_frame", "led_screen"]),
  dastarkhan: model("dastarkhan", "fire", [
    "dastarkhan_left",
    "dastarkhan_right",
    "dastarkhan_table",
  ]),
  blueNoise: { kind: "texture", chapter: "global", url: "/assets/noise/blue-noise-64.png" },
} as const satisfies Record<string, ModelAsset | VideoAsset | TextureAsset>;

/** Транскодер KTX2 (Basis) — локально, без CDN. */
export const BASIS_TRANSCODER_PATH = "/assets/decoders/basis/";

export function assetsOfChapter(chapter: ChapterId) {
  return Object.values(assets).filter((a) => a.chapter === chapter);
}
