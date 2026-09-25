import { getLocale, getTranslations } from "next-intl/server";
import { BriefLink } from "@/components/brief/BriefLink";
import { briefFallbackHref } from "@/components/brief/briefProps";
import type { Locale } from "@/lib/i18n";
import { SceneImage } from "@/components/ui/SceneImage";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { Chapter } from "./Chapter";
import styles from "./sections.module.css";

const sets = ["coffeeBreak", "banquet", "traditional"] as const;

/** Глава 4. Огонь. Шеф, кухня, дастархан. */
export async function FireSection() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("fire");
  const chapters = await getTranslations("chapters");

  return (
    <Chapter id="fire" time={t("time")} name={chapters("fire")}>
      <div className={styles.split}>
        <div className={`${styles.textBlock} ${styles.splitText}`}>
          <h2 id="fire-title" className={type.chapterTitle} data-reveal="">
            {t("title")}
          </h2>
          <p className={type.lead} data-reveal="">
            {t("lead")}
          </p>
        </div>
        <SceneImage
          className={styles.splitMedia}
          src="/assets/placeholders/fire.svg"
          alt={t("sceneAlt")}
          width={1600}
          height={900}
          sizes="(min-width: 768px) 50vw, 100vw"
        />
      </div>

      <div className={styles.textBlock}>
        <h3 className={type.eyebrow}>{t("setsLabel")}</h3>
        <ul className={layout.cards}>
          {sets.map((set) => (
            <li key={set} className={layout.card}>
              <p className={type.subTitle}>{t(`sets.${set}.name`)}</p>
              <p className={type.body}>{t(`sets.${set}.text`)}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <BriefLink href={briefFallbackHref(locale, "menu")} source="menu">
          {t("cta")}
        </BriefLink>
      </div>
    </Chapter>
  );
}
