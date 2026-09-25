/*
 * План загрузки сцен (CLAUDE.md, раздел 7):
 * - текущая глава — всегда;
 * - следующая — когда пройдено 50% текущей;
 * - всё, что дальше двух глав от текущей, — выгружается (dispose);
 * - сумма памяти GPU не превышает лимит (iOS — 300 МБ): сначала выгружаются дальние,
 *   потом отменяется предзагрузка. Текущая глава не выгружается никогда.
 */

export type PlanEntry = { id: string; index: number; memoryMb: number };

export type ScenePlan = { load: string[]; dispose: string[]; keep: string[]; memoryMb: number };

export const PRELOAD_AT = 0.5;
export const KEEP_DISTANCE = 2;

export function planScenes(opts: {
  current: number;
  local: number;
  loaded: ReadonlySet<string>;
  registry: readonly PlanEntry[];
  memoryLimitMb: number;
}): ScenePlan {
  const { current, local, loaded, registry, memoryLimitMb } = opts;
  const byId = new Map(registry.map((e) => [e.id, e]));
  const distance = (e: PlanEntry) => Math.abs(e.index - current);

  const wanted = registry.filter(
    (e) => e.index === current || (e.index === current + 1 && local >= PRELOAD_AT),
  );
  let keep = registry.filter((e) => loaded.has(e.id) && distance(e) <= KEEP_DISTANCE);
  let load = wanted.filter((e) => !loaded.has(e.id));

  const total = () => [...keep, ...load].reduce((sum, e) => sum + e.memoryMb, 0);

  // Лимит памяти: выгружаем самые дальние загруженные (кроме текущей и нужных сейчас).
  const needed = new Set(wanted.map((e) => e.id));
  const evictable = keep.filter((e) => !needed.has(e.id)).sort((a, b) => distance(b) - distance(a));
  while (total() > memoryLimitMb && evictable.length > 0) {
    const victim = evictable.shift()!;
    keep = keep.filter((e) => e.id !== victim.id);
  }
  // Всё ещё много — отказываемся от предзагрузки следующей главы.
  if (total() > memoryLimitMb) load = load.filter((e) => e.index === current);

  const keepIds = new Set(keep.map((e) => e.id));
  const dispose = [...loaded].filter((id) => byId.has(id) && !keepIds.has(id));
  return {
    load: load.map((e) => e.id),
    dispose,
    keep: [...keepIds],
    memoryMb: total(),
  };
}
