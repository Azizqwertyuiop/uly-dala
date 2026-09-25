import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { defaultLocale } from "./src/lib/i18n";

const withNextIntl = createNextIntlPlugin("./src/lib/intl/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    // Корень ведёт на язык по умолчанию. По Accept-Language НЕ перенаправляем (CLAUDE.md, раздел 11):
    // позже здесь появится плашка с предложением языка.
    return [{ source: "/", destination: `/${defaultLocale}`, permanent: false }];
  },
};

export default withNextIntl(nextConfig);
