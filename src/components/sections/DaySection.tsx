import { getLocale, getTranslations } from "next-intl/server";
import { formatImage, formats } from "@/content/formats";
import type from "@/components/ui/type.module.css";
import { Chapter, ChapterTime } from "./Chapter";
import { FormatTabs, type FormatTabItem } from "./FormatTabs";
import styles from "./sections.module.css";

/** PDF-заглушка презентации (scripts/generate-pdf-stub.mjs). TODO(client-data): настоящая. */
const PRESENTATION_HREF = "/assets/docs/uly-dala-presentation.pdf";

/*
 * Глава 3. День (CLAUDE.md, раздел 2). Шесть форматов в одной сцене.
 * Кинорежим (есть 3D): дорожка 300vh (data-track), экран закреплён; табы синхронизированы
 * со скроллом, сцена показывает площадку текущего формата.
 * Обычная раскладка («Коротко», без WebGL): табы переключают панели с кадрами; без JS — список.
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
    alt: f(`${key}.sceneAlt`),
  }));

  return (
    <Chapter id="day" time={t("time")} name={chapters("day")} className={styles.day} hideTime>
      <div className={styles.dayTrack} data-track="day">
        <div className={styles.dayStage}>
          <div className={`${styles.textBlock} ${styles.dayHead}`}>
            <ChapterTime time={t("time")} name={chapters("day")} />
            <h2 id="day-title" className={type.chapterTitle} data-reveal="">
              {t("title")}
            </h2>
            <p className={type.lead} data-reveal="">
              {t("lead")}
            </p>
          </div>
          <div className={styles.dayTabs}>
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
        </div>
      </div>
    </Chapter>
  );
}
