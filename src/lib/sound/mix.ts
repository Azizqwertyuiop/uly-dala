import type { ChapterId } from "@/components/sections/chapters";
import { assetUrl } from "@/lib/assets/url";

/*
 * Звук (CLAUDE.md, раздел 8) — чистая часть: слоты записей, микс по главам, порывы.
 * По умолчанию выключен; файлы грузятся только после включения. Никакого «этнического эмбиента»,
 * только записи с фазенды: ветер, трава, угли, ночь. UI-звук один — порыв при отправке брифа.
 */

/** Постоянные слои (петли) и один разовый звук. */
export const BEDS = ["wind", "grass", "embers", "night"] as const;
export type Bed = (typeof BEDS)[number];
export const SOUND_SLOTS = [...BEDS, "gust"] as const;
export type SoundSlot = (typeof SOUND_SLOTS)[number];

/**
 * Файлы слотов. TODO(client-audio): записи с фазенды (ветер, трава, лошади, угли) вместо
 * синтетических заглушек (scripts/make-audio-placeholders.mjs) — с теми же именами.
 */
export const SOUND_FILES: Record<SoundSlot, string> = {
  wind: assetUrl("/assets/audio/wind.m4a"),
  grass: assetUrl("/assets/audio/grass.m4a"),
  embers: assetUrl("/assets/audio/embers.m4a"),
  night: assetUrl("/assets/audio/night.m4a"),
  gust: assetUrl("/assets/audio/gust.m4a"),
};

/** Петли в файлах: ровно целое число периодов модуляции — без щелчка на стыке. */
export const LOOP = { start: 1, end: 7 } as const;

/** Громкость слоёв в главе (0…1). */
export const CHAPTER_MIX: Record<ChapterId, Record<Bed, number>> = {
  dawn: { wind: 0.7, grass: 0.55, embers: 0, night: 0 },
  assembly: { wind: 0.55, grass: 0.45, embers: 0, night: 0 },
  day: { wind: 0.45, grass: 0.4, embers: 0, night: 0 },
  fire: { wind: 0.2, grass: 0.15, embers: 0.8, night: 0.25 },
  world: { wind: 0.25, grass: 0.1, embers: 0.15, night: 0.6 },
  return: { wind: 0.7, grass: 0.55, embers: 0, night: 0.15 },
};

/** Кроссфейд между главами: постоянная времени, с (≈ 95% за 3τ). */
export const CROSSFADE_TAU = 0.8;
/** Реакция на порыв (вверх быстро, вниз — как затухает поле ветра). */
export const GUST_ATTACK = 0.12;
export const GUST_RELEASE = 0.9;

/**
 * Громкости слоёв: микс главы × порыв. Шелест травы усиливается на порывах (до ×2),
 * ветер — слегка; угли и ночь от ветра не зависят.
 */
export function bedGains(
  chapter: ChapterId | null,
  gust: number,
  out: Record<Bed, number> = { wind: 0, grass: 0, embers: 0, night: 0 },
): Record<Bed, number> {
  const g = Math.min(Math.max(gust, 0), 1);
  const mix = chapter ? CHAPTER_MIX[chapter] : CHAPTER_MIX.dawn;
  out.wind = Math.min(1, mix.wind * (0.8 + 0.5 * g));
  out.grass = Math.min(1, mix.grass * (0.5 + 1.5 * g));
  out.embers = mix.embers;
  out.night = mix.night;
  return out;
}

/**
 * Сила порыва для звука: из сцены степи (программные порывы и курсор), если значение свежее;
 * иначе (нет 3D, другая глава) — по скорости курсора.
 */
export function gustLevel(
  bus: { gust: number; gustAt: number },
  now: number,
  pointerSpeed: number,
): number {
  const fromScene = now - bus.gustAt < 0.5 ? bus.gust : 0;
  const fromPointer = 1 - Math.exp(-pointerSpeed / 2.5);
  return Math.max(fromScene, fromPointer);
}
