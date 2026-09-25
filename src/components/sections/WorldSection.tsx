import { getLocale, getTranslations } from "next-intl/server";
import { caseText, cases } from "@/content/cases";
import type { Locale } from "@/lib/i18n";
import { Link } from "@/lib/intl/navigation";
import { BriefLink } from "@/components/brief/BriefLink";
import { briefFallbackHref } from "@/components/brief/briefProps";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SceneImage } from "@/components/ui/SceneImage";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { Chapter } from "./Chapter";
import styles from "./sections.module.css";

export const zones = ["field", "tent", "yurt", "kitchen"] as const;

/*
 * Глава 5. Этот мир существует: фазенда + архив реальных событий.
 * TODO(client-data): реальные зоны и вместимость, время в пути, кейсы, логотипы, отзывы.
 */
export async function WorldSection() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("world");
  const chapters = await getTranslations("chapters");

  return (
    <Chapter id="world" time={t("time")} name={chapters("world")}>
      <div className={styles.split}>
        <div className={`${styles.textBlock} ${styles.splitText}`}>
          <h2 id="world-title" className={type.chapterTitle} data-reveal="">
            {t("title")}
          </h2>
          <p className={type.lead} data-reveal="">
            {t("lead")}
          </p>
          <p className={type.body}>{t("location")}</p>
        </div>
        <SceneImage
          className={styles.splitMedia}
          src="/assets/placeholders/world.svg"
          alt={t("sceneAlt")}
          width={1600}
          height={900}
          sizes="(min-width: 768px) 50vw, 100vw"
        />
      </div>

      <div className={styles.textBlock}>
        <h3 className={type.eyebrow}>{t("zonesLabel")}</h3>
        <ul className={layout.cards} style={{ "--cards": 4 } as React.CSSProperties}>
          {zones.map((zone) => (
            <li key={zone} className={layout.card}>
              <p className={type.subTitle}>{t(`zones.${zone}.name`)}</p>
              <p className={type.body}>{t(`zones.${zone}.text`)}</p>
              <p className={type.caption}>{t("capacityPending")}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.textBlock}>
        <h3 className={type.eyebrow}>{t("archiveLabel")}</h3>
        <ul className={layout.cards}>
          {cases.map((item) => {
            const text = caseText(item, locale);
            return (
              <li key={item.slug} className={styles.caseCard}>
                <Link href={`/cases/${item.slug}`} className={styles.caseLink}>
                  <SceneImage
                    className={styles.caseFrame}
                    src={item.cover.src}
                    alt={text.coverAlt}
                    width={item.cover.width}
                    height={item.cover.height}
                    sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                  />
                  <span className={type.subTitle}>{text.title}</span>
                </Link>
                <p className={type.body}>{text.summary}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={layout.cards} style={{ "--cards": 2 } as React.CSSProperties}>
        <div className={layout.card}>
          <h3 className={type.eyebrow}>{t("logosLabel")}</h3>
          <p className={type.pending}>{t("logosPending")}</p>
        </div>
        <div className={layout.card}>
          <h3 className={type.eyebrow}>{t("reviewsLabel")}</h3>
          <p className={type.pending}>{t("reviewsPending")}</p>
        </div>
      </div>

      <div className={layout.actions}>
        <BriefLink href={briefFallbackHref(locale, "visit")} source="visit">
          {t("cta")}
        </BriefLink>
        <ButtonLink href="/fazenda" variant="secondary">
          {t("fazendaLink")}
        </ButtonLink>
      </div>
    </Chapter>
  );
}
