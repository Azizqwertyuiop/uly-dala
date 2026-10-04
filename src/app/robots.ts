import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo/site";

/**
 * robots.txt: всё открыто, кроме служебных страниц и API; ссылка на карту сайта.
 * Превью для PR (NEXT_PUBLIC_SITE_ENV=preview, docs/deploy.md) закрыто от поиска целиком.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.NEXT_PUBLIC_SITE_ENV === "preview")
    return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Формы заявок не закрыты: им достаточно noindex (запрет обхода спрятал бы его от поиска).
      disallow: ["/api/", "/*/render-test", "/*/type-test"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
