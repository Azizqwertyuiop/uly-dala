import type { ComponentType } from "react";
import { chapterIds, type ChapterId } from "@/components/sections/chapters";

/*
 * Реестр сцен глав (CLAUDE.md, раздел 7): { id, loader, range }.
 * loader — динамический импорт: код сцены грузится, только когда он нужен.
 * range — участок прогресса сайта (t, как у навигации-горизонта), где сцена на экране.
 * memoryMb — оценка памяти GPU (геометрия + текстуры) для учёта лимита.
 * TODO(assets): настоящие сцены заменят примитивы-заглушки с теми же id.
 */

export type SceneProps = { anchor: [number, number, number] };

export type SceneEntry = {
  id: ChapterId;
  index: number;
  loader: () => Promise<{ default: ComponentType<SceneProps> }>;
  range: [number, number];
  memoryMb: number;
};

const loaders: Record<ChapterId, SceneEntry["loader"]> = {
  dawn: () => import("./DawnScene"),
  assembly: () => import("./AssemblyScene"),
  day: () => import("./DayScene"),
  fire: () => import("./FireScene"),
  world: () => import("./WorldScene"),
  return: () => import("./ReturnScene"),
};

const last = chapterIds.length - 1;

export const sceneRegistry: readonly SceneEntry[] = chapterIds.map((id, index) => ({
  id,
  index,
  loader: loaders[id],
  range: [Math.max(0, (index - 0.5) / last), Math.min(1, (index + 0.5) / last)],
  memoryMb: 4,
}));
