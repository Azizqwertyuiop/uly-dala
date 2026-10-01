import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n";
import { indexablePaths } from "@/lib/seo/pages";
import { languageAlternates, localePath, siteUrl } from "@/lib/seo/site";

/** sitemap.xml: каждая страница на трёх языках, у каждой — hreflang (kk, ru, en, x-default). */
export default function sitemap(): MetadataRoute.Sitemap {
  return indexablePaths().flatMap((path) =>
    locales.map((locale) => ({
      url: `${siteUrl()}${localePath(locale, path)}`,
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : path.startsWith("/services") ? 0.8 : 0.6,
      alternates: { languages: languageAlternates(path) },
    })),
  );
}
