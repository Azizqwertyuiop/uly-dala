import type { Locale } from "@/lib/i18n";

/*
 * Логотипы клиентов и отзывы (глава 5). TODO(client-data): только с письменного разрешения
 * клиентов (CLAUDE.md, раздел 17). Пока списки пусты — показывается «появятся после согласования».
 */

export type ClientLogo = {
  name: string;
  /** SVG-логотип в одном цвете (currentColor) — единый вид на тёмном фоне. */
  src: string;
  width: number;
  height: number;
};

export type Review = {
  /** Цитата: ru и en; kk — от копирайтера, без него показывается ru. */
  quote: { ru: string; en: string } & Partial<Record<Locale, string>>;
  author: string;
  role: { ru: string; en: string } & Partial<Record<Locale, string>>;
};

export const clientLogos: readonly ClientLogo[] = [];
export const reviews: readonly Review[] = [];

/** На главной — не больше трёх отзывов (раздел 2). */
export const MAX_REVIEWS = 3;

export function pickReviews(list: readonly Review[], locale: Locale) {
  return list.slice(0, MAX_REVIEWS).map((r) => ({
    quote: r.quote[locale] ?? r.quote.ru,
    author: r.author,
    role: r.role[locale] ?? r.role.ru,
  }));
}
