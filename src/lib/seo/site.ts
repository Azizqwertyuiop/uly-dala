import { defaultLocale, locales, type Locale } from "@/lib/i18n";

/*
 * Адрес сайта и языковые версии страниц (CLAUDE.md, раздел 11).
 * Адрес — NEXT_PUBLIC_SITE_URL (TODO(client-data): домен). Без него — localhost (разработка).
 */

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Путь страницы внутри языка: "" — главная, "/fazenda", "/services/kudalyk"… */
export type PagePath = "" | `/${string}`;

export const localePath = (locale: Locale, path: PagePath) => `/${locale}${path}`;

/** hreflang: kk, ru, en и x-default (язык по умолчанию — ru: корень показывает его). */
export function languageAlternates(path: PagePath): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of locales) map[l] = `${siteUrl()}${localePath(l, path)}`;
  map["x-default"] = `${siteUrl()}${localePath(defaultLocale, path)}`;
  return map;
}

/** Локаль Open Graph. */
export const ogLocale: Record<Locale, string> = { kk: "kk_KZ", ru: "ru_RU", en: "en_US" };
