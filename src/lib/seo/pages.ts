import { cases } from "@/content/cases";
import { formats } from "@/content/formats";
import { services } from "@/content/services";
import type { PagePath } from "./site";

/*
 * Индексируемые страницы (CLAUDE.md, раздел 11): главная, каждый формат и услуга, фазенда, каждый кейс,
 * политика. Служебные (render-test, type-test, формы заявок без JS) — не в карте и noindex.
 * TODO(client-copy): страница «О нас» (раздел 11) — когда будут тексты.
 */
export function indexablePaths(): PagePath[] {
  return [
    "",
    ...formats.map((f) => `/services/${f.slug}` as const),
    ...services.map((s) => `/services/${s.slug}` as const),
    "/fazenda",
    ...cases.map((c) => `/cases/${c.slug}` as const),
    "/privacy",
  ];
}
