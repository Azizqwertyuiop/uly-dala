import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { defaultLocale } from "./src/lib/i18n";

const withNextIntl = createNextIntlPlugin("./src/lib/intl/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Своя 404 для адресов вне /kk, /ru, /en (src/app/global-not-found.tsx).
    globalNotFound: true,
  },
  async rewrites() {
    // Корень без перенаправления (CLAUDE.md, раздел 11): / показывает страницу языка по умолчанию,
    // canonical — /ru (без дубля). Язык браузера предлагает плашка (LanguageSuggest), а не редирект.
    return { beforeFiles: [{ source: "/", destination: `/${defaultLocale}` }] };
  },
};

export default withNextIntl(nextConfig);
