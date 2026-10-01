import type { Metadata } from "next";
import { locales, type Locale } from "@/lib/i18n";
import { languageAlternates, localePath, ogLocale, siteUrl, type PagePath } from "./site";

/*
 * Метаданные страницы на трёх языках (CLAUDE.md, раздел 11): title, description, canonical,
 * hreflang (kk, ru, en, x-default), Open Graph и Twitter. OG-изображения — ключевые кадры сцен
 * (public/og/*.jpg, scripts/render-og-images.mjs), 1200×630.
 */

/** Ключевые кадры для OG. */
export const OG_IMAGES = [
  "dawn",
  "assembly",
  "fire",
  "world",
  "return",
  "conference",
  "coffee-break",
  "team-building",
  "kudalyk",
  "wedding",
  "private-party",
] as const;
export type OgImage = (typeof OG_IMAGES)[number];

export const OG_SIZE = { width: 1200, height: 630 } as const;

export function pageMetadata(opts: {
  locale: Locale;
  path: PagePath;
  title: string;
  description: string;
  image: OgImage;
  imageAlt: string;
  type?: "website" | "article";
  index?: boolean;
}): Metadata {
  const url = `${siteUrl()}${localePath(opts.locale, opts.path)}`;
  const image = { url: `${siteUrl()}/og/${opts.image}.jpg`, ...OG_SIZE, alt: opts.imageAlt };
  return {
    metadataBase: new URL(siteUrl()),
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url, languages: languageAlternates(opts.path) },
    openGraph: {
      type: opts.type ?? "website",
      url,
      siteName: "ULY DALA",
      title: opts.title,
      description: opts.description,
      locale: ogLocale[opts.locale],
      alternateLocale: locales.filter((l) => l !== opts.locale).map((l) => ogLocale[l]),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [image.url],
    },
    ...(opts.index === false ? { robots: { index: false, follow: true } } : {}),
  };
}
