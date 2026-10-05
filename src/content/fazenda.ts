import type { WorldZone } from "@/canvas/world/timeline";

/*
 * Фазенда: адрес, время в пути, вместимость зон (CLAUDE.md, разделы 2, 3, 17).
 * TODO(client-data): всё, что здесь null, — ждёт подтверждения заказчика.
 * Неподтверждённые цифры не показываются: вместо них — «уточняется».
 */

export type GeoPoint = { lat: number; lng: number };

export const fazenda: {
  location: GeoPoint | null;
  /** Время в пути от центра Алматы, минуты. */
  travelMinutes: number | null;
  /** Вместимость зон, гостей. */
  capacity: Record<WorldZone, number | null>;
} = {
  location: null,
  travelMinutes: null,
  capacity: { field: null, tent: null, yurt: null, kitchen: null },
};

/*
 * Ещё на фазенде — места и активности помимо зон облёта (список от заказчика, 5 октября 2026).
 * Порядок — как показывается. Вместимость — только подтверждённая заказчиком.
 */
export const FAZENDA_EXTRAS = [
  "gazebo",
  "fireplaceGazebo",
  "banya",
  "cabins",
  "cinema",
  "horses",
  "archery",
  "atv",
] as const;
export type FazendaExtra = (typeof FAZENDA_EXTRAS)[number];

/** Вместимость, гостей (подтверждено заказчиком). */
export const extrasCapacity: Partial<Record<FazendaExtra, number>> = { gazebo: 60 };

/** Ссылки на карты — только при известной точке; без неё ссылки не показываются. */
export function mapLinks(point: GeoPoint | null) {
  if (!point) return null;
  const lat = point.lat.toFixed(6);
  const lng = point.lng.toFixed(6);
  return {
    // 2GIS: точка на карте Алматы (долгота, широта).
    twoGis: `https://2gis.kz/almaty/geo/${lng}%2C${lat}`,
    // Google Maps: маршрут до точки от текущего положения.
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lng}`,
  };
}
