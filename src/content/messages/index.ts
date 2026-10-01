import type { Locale } from "@/lib/i18n";
import { typograph } from "@/lib/typography";
import en from "./en";
import kk from "./kk";
import ru, { type Messages } from "./ru";

export type { Messages };

type Tree = { [key: string]: string | Tree };

/** Недостающие ключи берутся из ru (базового языка). */
function withFallback(base: Tree, overrides: Tree): Tree {
  const result: Tree = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const baseValue = base[key];
    result[key] =
      typeof value === "object" && typeof baseValue === "object"
        ? withFallback(baseValue, value)
        : value;
  }
  return result;
}

/** Типографика ко всем строкам сразу — компонентам не нужно помнить о ней. */
function typographTree(tree: Tree, locale: Locale): Tree {
  const result: Tree = {};
  for (const [key, value] of Object.entries(tree)) {
    result[key] =
      typeof value === "string" ? typograph(value, locale) : typographTree(value, locale);
  }
  return result;
}

function raw(locale: Locale): Messages {
  switch (locale) {
    case "ru":
      return ru;
    case "en":
      return en;
    case "kk":
      return withFallback(ru, kk as Tree) as Messages;
  }
}

/** Число строк в дереве сообщений. */
function countStrings(tree: Tree): number {
  let n = 0;
  for (const value of Object.values(tree)) n += typeof value === "string" ? 1 : countStrings(value);
  return n;
}

/**
 * Язык, на котором страница на самом деле написана (атрибут lang, WCAG 3.1.1).
 * Казахские тексты пишет копирайтер (TODO(kk-copywriter)); пока перевод неполный, на /kk
 * показывается русский — и lang="ru", чтобы скринридер читал его русским голосом.
 * Как только kk.ts покрывает все строки ru.ts, страница объявляет kk сама.
 */
export function contentLanguage(locale: Locale): Locale {
  if (locale !== "kk") return locale;
  return countStrings(kk as Tree) >= countStrings(ru as Tree) ? "kk" : "ru";
}

const cache = new Map<Locale, Messages>();

export function getMessages(locale: Locale): Messages {
  let messages = cache.get(locale);
  if (!messages) {
    messages = typographTree(raw(locale) as Tree, locale) as Messages;
    cache.set(locale, messages);
  }
  return messages;
}
