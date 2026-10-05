import { getLocale, getTranslations } from "next-intl/server";
import { formatImage, formatSrcSet, formats, hasFormatPhoto } from "@/content/formats";
import type from "@/components/ui/type.module.css";
import { Chapter, ChapterTime } from "./Chapter";
import { FormatTabs, type FormatTabItem } from "./FormatTabs";
import styles from "./sections.module.css";

/** PDF-заглушка презентации (scripts/generate-pdf-stub.mjs). TODO(client-data): настоящая. */
const PRESENTATION_HREF = "/assets/docs/uly-dala-presentation.pdf";

/*
 * Глава 3. День (CLAUDE.md, раздел 2). Шесть форматов — фото настоящих событий, без 3D.
 * Обычная глава (не закреплённая): табы переключают формат кликом, стрелками или свайпом
 * по фото; без JS — список всех форматов. Холст здесь не рисует (src/canvas/onScreen.ts).
 */
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
    srcSet: formatSrcSet(slug),
    // Пока снимка нет — честное описание пустого кадра и подпись под ним.
    alt: hasFormatPhoto(slug)
      ? f(`${key}.sceneAlt`)
      : t("photoPendingAlt", { format: f(`${key}.title`) }),
    pending: hasFormatPhoto(slug) ? undefined : t("photoPending"),
  }));

  return (
    <Chapter id="day" time={t("time")} name={chapters("day")} className={styles.day} hideTime>
      <div className={styles.dayStage}>
        <div className={styles.textBlock}>
          <ChapterTime time={t("time")} name={chapters("day")} />
          <h2 id="day-title" className={type.chapterTitle} data-reveal="">
            {t("title")}
          </h2>
          <p className={type.lead} data-reveal="">
            {t("lead")}
          </p>
        </div>
        <FormatTabs
          label={t("tabsLabel")}
          formatPageLabel={t("formatPage")}
          items={items}
          presentation={{
            label: t("presentation"),
            meta: t("presentationMeta"),
            href: PRESENTATION_HREF,
          }}
        />
      </div>
    </Chapter>
  );
}
