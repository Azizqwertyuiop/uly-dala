import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "@/lib/i18n";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Язык всегда в адресе: /kk, /ru, /en. Корень / показывает /ru без перенаправления
  // (next.config.ts, rewrite); язык браузера только предлагается плашкой (CLAUDE.md, раздел 11).
  localePrefix: "always",
  localeDetection: false,
});
