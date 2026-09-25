import type { Locale } from "@/lib/i18n";
import type { FormatSlug } from "@/content/formats";

export interface CaseText {
  title: string;
  summary: string;
  task: string;
  solution: string;
  result: string;
  coverAlt: string;
}

export interface Case {
  slug: string;
  format: FormatSlug;
  cover: { src: string; width: number; height: number };
  /** Заглушка до получения реального кейса от заказчика. */
  placeholder: boolean;
  /** kk необязателен: без перевода показывается ru. */
  text: { ru: CaseText; en: CaseText } & Partial<Record<Exclude<Locale, "ru" | "en">, CaseText>>;
}
