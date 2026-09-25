import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/lib/i18n";

/** Язык из сегмента [locale]. Неизвестный язык — 404. */
export function resolveLocale(value: string): Locale {
  if (!isLocale(value)) notFound();
  return value;
}
