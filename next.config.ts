import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { defaultLocale } from "./src/lib/i18n";
import { KTX2_WORKER_CSP, KTX2_WORKER_PATH, securityHeaders } from "./src/lib/security/headers";

const withNextIntl = createNextIntlPlugin("./src/lib/intl/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Своя 404 для адресов вне /kk, /ru, /en (src/app/global-not-found.tsx).
    globalNotFound: true,
  },
  async headers() {
    // Заголовки безопасности (CLAUDE.md, раздел 14) — на все адреса.
    const headers = securityHeaders({
      dev: process.env.NODE_ENV === "development",
      https: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
    });
    const csp = (list: typeof headers, value: string) =>
      list.map((h) => (h.key === "Content-Security-Policy" ? { ...h, value } : h));
    return [
      // Все адреса, кроме воркера KTX2: два заголовка CSP складываются, eval был бы запрещён.
      { source: `/:path((?!${KTX2_WORKER_PATH.slice(1).replace(/[.]/g, "\\.")}$).*)`, headers },
      { source: KTX2_WORKER_PATH, headers: csp(headers, KTX2_WORKER_CSP) },
    ];
  },
  async rewrites() {
    // Корень без перенаправления (CLAUDE.md, раздел 11): / показывает страницу языка по умолчанию,
    // canonical — /ru (без дубля). Язык браузера предлагает плашка (LanguageSuggest), а не редирект.
    return { beforeFiles: [{ source: "/", destination: `/${defaultLocale}` }] };
  },
};

export default withNextIntl(nextConfig);
