import type { Locale } from "@/lib/i18n";
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

export function getMessages(locale: Locale): Messages {
  switch (locale) {
    case "ru":
      return ru;
    case "en":
      return en;
    case "kk":
      return withFallback(ru, kk as Tree) as Messages;
  }
}
