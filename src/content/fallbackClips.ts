import type { ChapterId } from "@/components/sections/chapters";
import { assetUrl } from "@/lib/assets/url";

/*
 * Видео-секвенции уровня fallback (CLAUDE.md, раздел 6): вместо 3D — короткие клипы,
 * которые перематывает скролл (currentTime ← прогресс; без автоплея — работают и там,
 * где он запрещён: энергосбережение, встроенные браузеры). У «Рассвета» в начале клипа —
 * интро с серебряной волной (по времени, один раз), дальше — скролл главы.
 *
 * Источники — по порядку предпочтения браузера: AV1 / VP9 (WebM, меньше), H.264 (MP4, везде).
 * TODO(assets): AV1 и VP9 — из офлайн-рендеров через ffmpeg (docs/assets.md); сейчас — только
 * H.264-заглушки, снятые с нашей же 3D-сцены (npm run assets:fallback).
 */

export type ClipSource = { src: string; type: string };

export type FallbackClip = {
  sources: readonly ClipSource[];
  /** Портрет телефона: снято в вертикальном кадре с портретными ключами камеры. */
  portrait: readonly ClipSource[];
  /** Длина клипа, с. */
  duration: number;
  /** Интро по времени в начале клипа (только «Рассвет»), с. */
  intro: number;
  /** Где держать центр кадра при обрезке под портрет (object-position по X, %). */
  focusX: number;
};

const mp4 = (chapter: ChapterId, variant = ""): ClipSource => ({
  src: assetUrl(`/assets/video/fallback/${chapter}${variant}.mp4`),
  type: 'video/mp4; codecs="avc1.640028"',
});
const both = (chapter: ChapterId) => ({
  sources: [mp4(chapter)],
  portrait: [mp4(chapter, ".portrait")],
});

/** Кадров в секунду и длительности — как снимает scripts/render-fallback-clips.mjs. */
export const CLIP_FPS = 24;
export const DAWN_INTRO_SECONDS = 4.5;
export const SCROLL_SECONDS = 2;

/** У «Дня» нет общего кадра (в fallback — кадры форматов), клипа нет. */
export const fallbackClips: Partial<Record<ChapterId, FallbackClip>> = {
  dawn: {
    ...both("dawn"),
    duration: DAWN_INTRO_SECONDS + SCROLL_SECONDS,
    intro: DAWN_INTRO_SECONDS,
    // Конь — на правой трети кадра: в портрете он должен остаться в кадре.
    focusX: 66,
  },
  assembly: { ...both("assembly"), duration: SCROLL_SECONDS, intro: 0, focusX: 60 },
  fire: { ...both("fire"), duration: SCROLL_SECONDS, intro: 0, focusX: 50 },
  world: { ...both("world"), duration: SCROLL_SECONDS, intro: 0, focusX: 50 },
  return: { ...both("return"), duration: SCROLL_SECONDS, intro: 0, focusX: 50 },
};

/** Время клипа по прогрессу: интро (если есть) — отдельно, скролл — после него. */
export function clipTime(clip: FallbackClip, scroll: number, introTime: number | null): number {
  const end = clip.duration - 1 / CLIP_FPS;
  if (introTime !== null && introTime < clip.intro) return Math.max(0, introTime);
  const p = Math.min(Math.max(scroll, 0), 1);
  return Math.min(end, clip.intro + p * (clip.duration - clip.intro - 1 / CLIP_FPS));
}
