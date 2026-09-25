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

export const formatImage = (slug: FormatSlug) => `/assets/placeholders/format-${slug}.svg`;
