/*
 * План загрузки сцен (CLAUDE.md, раздел 7):
 * - текущая глава — всегда;
 * - следующая — когда пройдено 50% текущей;
 * - всё, что дальше двух глав от текущей, — выгружается (dispose);
 * - сумма памяти GPU не превышает лимит (iOS — 300 МБ): сначала выгружаются дальние,
 *   потом отменяется предзагрузка. Текущая глава не выгружается никогда;
 * - зависимости (requires): глава, которая стоит в чужом мире (юрта и площадки «Дня» — в степи
 *   рассвета), тянет его за собой — и при обновлении страницы посреди сайта тоже.
 */

export type PlanEntry = {
  id: string;
  index: number;
  memoryMb: number;
  requires?: readonly string[];
};

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

  const direct = registry.filter(
    (e) => e.index === current || (e.index === current + 1 && local >= PRELOAD_AT),
  );
  // Зависимости — раньше зависящих: мир загружается первым.
  const required = direct.flatMap((e) => e.requires ?? []).map((id) => byId.get(id)!);
  const wanted = [...new Set([...required.filter(Boolean), ...direct])];
  const neededIds = new Set(wanted.map((e) => e.id));
  let keep = registry.filter(
    (e) => loaded.has(e.id) && (distance(e) <= KEEP_DISTANCE || neededIds.has(e.id)),
  );
  let load = wanted.filter((e) => !loaded.has(e.id));

  const total = () => [...keep, ...load].reduce((sum, e) => sum + e.memoryMb, 0);

  // Лимит памяти: выгружаем самые дальние загруженные (кроме текущей и нужных сейчас).
  const needed = new Set(wanted.map((e) => e.id));
  const evictable = keep.filter((e) => !needed.has(e.id)).sort((a, b) => distance(b) - distance(a));
  while (total() > memoryLimitMb && evictable.length > 0) {
    const victim = evictable.shift()!;
    keep = keep.filter((e) => e.id !== victim.id);
  }
  // Всё ещё много — отказываемся от предзагрузки следующей главы (зависимости текущей остаются).
  if (total() > memoryLimitMb) {
    const current_ = registry.find((e) => e.index === current);
    const mustHave = new Set([current_?.id, ...(current_?.requires ?? [])]);
    load = load.filter((e) => mustHave.has(e.id));
  }

  const keepIds = new Set(keep.map((e) => e.id));
  const dispose = [...loaded].filter((id) => byId.has(id) && !keepIds.has(id));
  return {
    load: load.map((e) => e.id),
    dispose,
    keep: [...keepIds],
    memoryMb: total(),
  };
}
