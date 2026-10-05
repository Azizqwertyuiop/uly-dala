import type { ChapterId } from "@/components/sections/chapters";
import { assetUrl } from "@/lib/assets/url";

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

/**
 * Видео без альфы (облёт фазенды): один файл H.264 в MP4 на все браузеры — аппаратное
 * декодирование везде; ключевой кадр каждые 0,5 с (перемотка скроллом).
 */
export type ClipAsset = {
  kind: "clip";
  chapter: ChapterId;
  url: string;
  poster: string;
  aspect: number;
};

/** Gaussian Splatting (фазенда, только high и не iOS / не тач — canUseSplats). */
export type SplatAsset = { kind: "splat"; chapter: ChapterId; url: string };

const model = (name: string, chapter: ChapterId, nodes: readonly string[]): ModelAsset => ({
  kind: "model",
  chapter,
  variants: {
    high: assetUrl(`/assets/models/${name}.high.glb`),
    medium: assetUrl(`/assets/models/${name}.medium.glb`),
  },
  nodes,
});

export const assets = {
  horse: {
    kind: "video",
    chapter: "dawn",
    variants: {
      high: {
        hevc: assetUrl("/assets/video/horse-test.high.mov"),
        vp9: assetUrl("/assets/video/horse-test.high.webm"),
      },
      medium: {
        hevc: assetUrl("/assets/video/horse-test.medium.mov"),
        vp9: assetUrl("/assets/video/horse-test.medium.webm"),
      },
    },
    poster: assetUrl("/assets/video/horse-test.poster.png"),
    aspect: 16 / 9,
  },
  horsePlane: model("horse", "dawn", ["horse_plane"]),
  yurt: model("yurt", "assembly", ["kerege", "uyki", "shanyrak", "kiiz", "esik"]),
  dastarkhan: model("dastarkhan", "fire", [
    "dastarkhan_left",
    "dastarkhan_right",
    "dastarkhan_table",
  ]),
  // Фазенда (глава 5): сплаты на high (десктоп), облёт — на medium и там, где сплаты нельзя.
  // TODO(assets): настоящая съёмка — .spz вместо заглушки .splat, облёт 1080p (docs/assets.md).
  fazendaSplat: { kind: "splat", chapter: "world", url: assetUrl("/assets/splats/fazenda.splat") },
  fazendaFlyover: {
    kind: "clip",
    chapter: "world",
    url: assetUrl("/assets/video/fazenda-flyover.medium.mp4"),
    poster: assetUrl("/assets/video/fazenda-flyover.poster.png"),
    aspect: 16 / 9,
  },
  blueNoise: {
    kind: "texture",
    chapter: "global",
    url: assetUrl("/assets/noise/blue-noise-64.png"),
  },
} as const satisfies Record<
  string,
  ModelAsset | VideoAsset | ClipAsset | TextureAsset | SplatAsset
>;

/** Транскодер KTX2 (Basis) — локально, без CDN. */
export const BASIS_TRANSCODER_PATH = "/assets/decoders/basis/";
/** Воркер KTX2 файлом — со своей CSP (scripts/ktx2-worker.mjs). */
export const KTX2_WORKER_URL = "/assets/decoders/basis/ktx2-worker.js";

export function assetsOfChapter(chapter: ChapterId) {
  return Object.values(assets).filter((a) => a.chapter === chapter);
}
