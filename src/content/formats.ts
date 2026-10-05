import { assetUrl } from "@/lib/assets/url";
import dayPhotos from "./day-photos.json";

/*
 * Шесть форматов главы «День» (CLAUDE.md, раздел 2). Порядок — «Посмотреть всё».
 * Тексты — в messages (formats.<key>), здесь только структура.
 */

export const formats = [
  { slug: "conference", key: "conference", audience: "corporate" },
  { slug: "coffee-break", key: "coffeeBreak", audience: "corporate" },
  { slug: "team-building", key: "teamBuilding", audience: "corporate" },
  { slug: "kudalyk", key: "kudalyk", audience: "family" },
  { slug: "wedding", key: "wedding", audience: "family" },
  { slug: "private-party", key: "privateParty", audience: "family" },
] as const;

export type Format = (typeof formats)[number];
export type FormatSlug = Format["slug"];
export type FormatKey = Format["key"];

export function findFormat(slug: string): Format | undefined {
  return formats.find((format) => format.slug === slug);
}

/*
 * Фото событий по форматам (глава «День», страницы форматов). Только реальные снимки
 * ULY DALA с правами на публикацию (CLAUDE.md, разделы 15, 17; требования — docs/assets.md).
 * Список ведёт scripts/optimize-photos.mjs (npm run assets:photos): формат → ширины файлов.
 * Формата нет — пустой кадр-заглушка и подпись «Фото события — скоро».
 * TODO(client-data): фото по каждому формату — заказчик присылает по одному.
 */
const DAY_PHOTOS = dayPhotos as Partial<Record<FormatSlug, number[]>>;
const photoUrl = (slug: FormatSlug, width: number) =>
  assetUrl(`/assets/photos/day/${slug}-${width}.jpg`);

export const hasFormatPhoto = (slug: FormatSlug) => Boolean(DAY_PHOTOS[slug]?.length);

export function formatImage(slug: FormatSlug): string {
  const widths = DAY_PHOTOS[slug];
  return widths?.length
    ? photoUrl(slug, widths.at(-1)!)
    : assetUrl(`/assets/placeholders/format-${slug}.svg`);
}

/** srcset снимка (750/1200/1800 px) — браузер берёт размер под экран; у заглушки нет. */
export function formatSrcSet(slug: FormatSlug): string | undefined {
  return DAY_PHOTOS[slug]?.map((w) => `${photoUrl(slug, w)} ${w}w`).join(", ");
}
