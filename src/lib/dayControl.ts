import { formats, type FormatSlug } from "@/content/formats";

/*
 * Порядок форматов «Дня» — общий для DOM (табы) и 3D (площадки и путь камеры).
 * Табы пишут порядок по развилке (стор брифа); сцена и камера читают его в своём кадре
 * и перестраиваются, когда меняется version. Обычный объект — без перерисовок React в кадре.
 */
export const dayControl = {
  order: formats.map((f) => f.slug) as FormatSlug[],
  version: 0,
};

export function setDayOrder(order: readonly FormatSlug[]): void {
  if (order.length === dayControl.order.length && order.every((s, i) => s === dayControl.order[i]))
    return;
  dayControl.order = [...order];
  dayControl.version++;
}
