import type { ComponentType } from "react";
import { chapterIds, type ChapterId } from "@/components/sections/chapters";
import { canUseSplats } from "@/lib/capabilities";
import { assets } from "../assets";
import { currentProfile, currentTier, loadModel } from "../loaders";

/*
 * Реестр сцен глав (CLAUDE.md, раздел 7): { id, loader, range }.
 * У «Дня» сцены нет — там фото событий (шаг 20; FormatTabs): холст в этой главе не рисует.
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
  /** Сцены, в мире которых стоит эта (степь рассвета для «Сборки», «Огня», финала). */
  requires?: readonly ChapterId[];
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

const loaders: Partial<Record<ChapterId, SceneEntry["loader"]>> = {
  dawn: withModel(() => import("./DawnScene"), assets.horsePlane),
  assembly: withModel(() => import("./AssemblyScene"), assets.yurt),
  fire: withModel(() => import("./FireScene"), assets.dastarkhan),
  // «Этот мир существует»: сплаты фазенды — только high на десктопе (не iOS, не тач);
  // иначе видео облёта. Библиотека сплатов (Spark) и файл грузятся только в первом случае.
  world: async () => {
    const profile = currentProfile();
    if (profile && canUseSplats(profile, currentTier())) {
      const [mod, spark, bytes] = await Promise.all([
        import("./WorldScene"),
        import("@sparkjsdev/spark"),
        fetch(assets.fazendaSplat.url).then((r) => {
          if (!r.ok) throw new Error(`${assets.fazendaSplat.url}: ${r.status}`);
          return r.arrayBuffer();
        }),
      ]);
      return { Component: mod.default, data: { mode: "splats", spark, bytes } };
    }
    const mod = await import("./WorldScene");
    return { Component: mod.default, data: { mode: "video" } };
  },
  return: withModel(() => import("./ReturnScene")),
};

/** Оценка памяти GPU сцены, МБ (TODO(assets): уточнить по настоящим ассетам). */
const memory: Partial<Record<ChapterId, number>> = {
  dawn: 24, // видео 4K с альфой
  assembly: 12,
  fire: 8, // очаг, дым, стол, три сета, env map
  world: 16, // сплаты фазенды (заглушка 31k) или кадр видео облёта 960×540
  return: 2, // своё — только состояние; степь — у «Рассвета»
};

/** Юрта и очаг стоят в степи рассвета (DawnScene: небо, рельеф, трава, ветер). */
const requires: Partial<Record<ChapterId, readonly ChapterId[]>> = {
  assembly: ["dawn"],
  fire: ["dawn"],
  // Финал — та же степь рассвета (петля), без коня и юрты.
  return: ["dawn"],
};

const last = chapterIds.length - 1;

export const sceneRegistry: readonly SceneEntry[] = chapterIds.flatMap((id, index) => {
  const loader = loaders[id];
  if (!loader) return [];
  return [
    {
      id,
      index,
      loader,
      range: [Math.max(0, (index - 0.5) / last), Math.min(1, (index + 0.5) / last)] as [
        number,
        number,
      ],
      memoryMb: memory[id] ?? 0,
      requires: requires[id],
    },
  ];
});
