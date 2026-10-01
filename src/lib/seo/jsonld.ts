import type {
  CreativeWork,
  FAQPage,
  LocalBusiness,
  Organization,
  Place,
  WithContext,
} from "schema-dts";
import { contacts } from "@/content/contacts";
import { fazenda } from "@/content/fazenda";
import type { Locale } from "@/lib/i18n";
import { localePath, siteUrl, type PagePath } from "./site";

/*
 * Структурированные данные (CLAUDE.md, раздел 11): Organization, LocalBusiness, Place (фазенда),
 * CreativeWork (кейсы), FAQPage (страницы форматов). Типы schema-dts — проверка словаря
 * schema.org при сборке. Только подтверждённое: телефон, адрес, координаты — когда появятся
 * (TODO(client-data)); без выдуманных цифр, рейтингов и отзывов.
 */

const id = (fragment: string) => `${siteUrl()}/#${fragment}`;

/** Город — без адреса улицы, пока заказчик его не подтвердил. */
const almaty = (locale: Locale) => ({
  "@type": "PostalAddress" as const,
  addressLocality: locale === "en" ? "Almaty" : "Алматы",
  addressCountry: "KZ",
});

export function organizationLd(opts: {
  locale: Locale;
  description: string;
  slogan: string;
}): WithContext<Organization> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": id("organization"),
    name: "ULY DALA",
    url: siteUrl(),
    logo: `${siteUrl()}/icon.svg`,
    slogan: opts.slogan,
    description: opts.description,
    areaServed: almaty(opts.locale).addressLocality,
    ...(contacts.phone ? { telephone: `+${contacts.phone}` } : {}),
  };
}

export function localBusinessLd(opts: {
  locale: Locale;
  description: string;
}): WithContext<LocalBusiness> {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": id("business"),
    name: "ULY DALA",
    url: `${siteUrl()}${localePath(opts.locale, "")}`,
    image: `${siteUrl()}/og/dawn.jpg`,
    description: opts.description,
    address: almaty(opts.locale),
    areaServed: almaty(opts.locale).addressLocality,
    parentOrganization: { "@id": id("organization") },
    location: { "@id": id("fazenda") },
    ...(contacts.phone ? { telephone: `+${contacts.phone}` } : {}),
  };
}

export function placeLd(opts: {
  locale: Locale;
  name: string;
  description: string;
}): WithContext<Place> {
  const geo = fazenda.location;
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    "@id": id("fazenda"),
    name: opts.name,
    description: opts.description,
    url: `${siteUrl()}${localePath(opts.locale, "/fazenda")}`,
    image: `${siteUrl()}/og/world.jpg`,
    address: almaty(opts.locale),
    ...(geo ? { geo: { "@type": "GeoCoordinates", latitude: geo.lat, longitude: geo.lng } } : {}),
  };
}

export function caseLd(opts: {
  locale: Locale;
  path: PagePath;
  name: string;
  description: string;
  image: string;
  about: string;
}): WithContext<CreativeWork> {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: opts.name,
    description: opts.description,
    url: `${siteUrl()}${localePath(opts.locale, opts.path)}`,
    image: `${siteUrl()}/og/${opts.image}.jpg`,
    inLanguage: opts.locale,
    about: opts.about,
    creator: { "@id": id("organization") },
  };
}

export function faqLd(items: readonly { q: string; a: string }[]): WithContext<FAQPage> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

/** Для <script type="application/ld+json">: «<» экранируется — строка не закроет тег. */
export function serializeLd(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
