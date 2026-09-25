import type { ComponentType } from "react";
import { chapterIds, type ChapterId } from "@/components/sections/chapters";
import { assets } from "../assets";
import { currentTier, loadModel } from "../loaders";

/*
 * Реестр сцен глав (CLAUDE.md, раздел 7): { id, loader, range }.
 * loader — динамический импорт кода сцены + предзагрузка её ассетов (модели по уровню качества):
 * сцена считается загруженной, только когда всё для первого кадра уже на месте.
 * range — участок прогресса сайта (t, как у навигации-горизонта), где сцена на экране.
 * memoryMb — оценка памяти GPU (геометрия + текстуры) для учёта лимита.
 */

export type SceneProps = { anchor: [number, number, number]; data?: unknown };
export type LoadedScene = { Component: ComponentType<SceneProps>; data?: unknown };

export type SceneEntry = {
  id: ChapterId;
  index: number;
  loader: () => Promise<LoadedScene>;
  range: [number, number];
  memoryMb: number;
};

const withModel =
  (
    load: () => Promise<{ default: ComponentType<SceneProps> }>,
    model?: { variants: { high: string; medium: string } },
  ) =>
  async (): Promise<LoadedScene> => {
    const [mod, data] = await Promise.all([
      load(),
      model ? loadModel(model.variants[currentTier()]) : Promise.resolve(undefined),
    ]);
    return { Component: mod.default, data };
  };

const loaders: Record<ChapterId, SceneEntry["loader"]> = {
  dawn: withModel(() => import("./DawnScene"), assets.horsePlane),
  assembly: withModel(() => import("./AssemblyScene"), assets.yurt),
  day: withModel(() => import("./DayScene"), assets.ledWall),
  fire: withModel(() => import("./FireScene"), assets.dastarkhan),
  world: withModel(() => import("./WorldScene")),
  return: withModel(() => import("./ReturnScene")),
};

/** Оценка памяти GPU сцены, МБ (TODO(assets): уточнить по настоящим ассетам). */
const memory: Record<ChapterId, number> = {
  dawn: 24, // видео 4K с альфой
  assembly: 12,
  day: 6,
  fire: 6,
  world: 4,
  return: 4,
};

const last = chapterIds.length - 1;

export const sceneRegistry: readonly SceneEntry[] = chapterIds.map((id, index) => ({
  id,
  index,
  loader: loaders[id],
  range: [Math.max(0, (index - 0.5) / last), Math.min(1, (index + 0.5) / last)],
  memoryMb: memory[id],
}));
