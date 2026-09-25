/** Языки сайта. Порядок — как в переключателе меню: KZ / RU / EN. */
export const locales = ["kk", "ru", "en"] as const;

export type Locale = (typeof locales)[number];

/** Язык по умолчанию (CLAUDE.md, раздел 7). */
export const defaultLocale: Locale = "ru";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
