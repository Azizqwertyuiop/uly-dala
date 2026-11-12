import type { OgImage } from "@/lib/seo/metadata";

/*
 * Услуги без события целиком (решение заказчика 16.10.2026): агентство работает на любой
 * площадке — выездной кейтеринг, аренда техники, фотобудка. Страницы — /[locale]/services/[slug],
 * рядом с форматами. Тексты — messages.services.<key>. TODO(client-copy): тексты — черновик.
 */
export const services = [
  {
    slug: "catering",
    key: "catering",
    eventType: "catering",
    og: "coffee-break",
    items: ["one", "two", "three"],
  },
  {
    slug: "equipment-rental",
    key: "rental",
    eventType: "equipment-rental",
    og: "assembly",
    items: ["one", "two", "three", "four", "five"],
  },
  {
    slug: "photo-booth",
    key: "photoBooth",
    eventType: "equipment-rental",
    og: "world",
    items: ["one", "two", "three"],
  },
] as const satisfies readonly {
  slug: string;
  key: string;
  eventType: "catering" | "equipment-rental";
  og: OgImage;
  items: readonly string[];
}[];

export type Service = (typeof services)[number];
export type ServiceSlug = Service["slug"];

export function findService(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}
