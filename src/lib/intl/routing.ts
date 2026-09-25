import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "@/lib/i18n";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Язык всегда в адресе: /kk, /ru, /en. Корень / ведёт на /ru (next.config.ts),
  // язык браузера НЕ используется для перенаправления (CLAUDE.md, раздел 11).
  localePrefix: "always",
  localeDetection: false,
});
