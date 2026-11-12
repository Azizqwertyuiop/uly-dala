import type { Locale } from "@/lib/i18n";

/*
 * Клиенты и отзывы — один блок на главной (решение заказчика 12.11.2026).
 * Названия клиентов — от заказчика; логотипы — только с письменного разрешения (раздел 17).
 * Отзывы — фото (скриншоты) от заказчика; пока файла нет — пустая рамка «Фото отзыва скоро».
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

/** Клиенты, названные заказчиком (12.11.2026). Пока логотипов нет — названия текстом. */
export const clientNames: readonly ({ ru: string; en: string } & Partial<
  Record<Locale, string>
>)[] = [
  { ru: "БЦ Promenade", en: "Promenade Business Centre" },
  { ru: "Freedom Broker", en: "Freedom Broker" },
  { ru: "Hero’s Journey", en: "Hero’s Journey" },
  { ru: "Клиника Aston", en: "Aston Clinic" },
  { ru: "Компания номер один", en: "Kompaniya Nomer Odin" },
];

/** «И ещё более N клиентов» — число со слов заказчика (12.11.2026). */
export const MORE_CLIENTS = 10;

/**
 * Фото отзывов: путь к файлу (public/assets/photos/reviews/, через assetUrl) или null —
 * пустая рамка. Заказчик загрузит позже.
 */
export const reviewShots: readonly (string | null)[] = [null, null, null];
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
