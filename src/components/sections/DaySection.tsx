import { getLocale, getTranslations } from "next-intl/server";
import { formatImage, formats } from "@/content/formats";
import type from "@/components/ui/type.module.css";
import { Chapter, chapterStyles } from "./Chapter";
import { FormatTabs, type FormatTabItem } from "./FormatTabs";

/** Глава 3. День. Шесть форматов в одной сцене — табы (без JS — список). */
export async function DaySection() {
  const locale = await getLocale();
  const t = await getTranslations("day");
  const chapters = await getTranslations("chapters");
  const f = await getTranslations("formats");

  const items: FormatTabItem[] = formats.map(({ slug, key, audience }) => ({
    slug,
    audience,
    title: f(`${key}.title`),
    phrase: f(`${key}.phrase`),
    facts: [f(`${key}.facts.one`), f(`${key}.facts.two`), f(`${key}.facts.three`)],
    cta: f(`${key}.cta`),
    ctaHref: `/${locale}#brief`,
    pageHref: `/${locale}/services/${slug}`,
    image: formatImage(slug),
    alt: f(`${key}.sceneAlt`),
  }));

  return (
    <Chapter id="day" time={t("time")} name={chapters("day")}>
      <div className={chapterStyles.head}>
        <h2 id="day-title" className={type.chapterTitle}>
          {t("title")}
        </h2>
        <p className={type.lead}>{t("lead")}</p>
      </div>
      <FormatTabs label={t("tabsLabel")} formatPageLabel={t("formatPage")} items={items} />
    </Chapter>
  );
}
