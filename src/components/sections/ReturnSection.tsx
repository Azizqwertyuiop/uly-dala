import { getLocale, getTranslations } from "next-intl/server";
import { BriefForm } from "@/components/brief/BriefForm";
import { getBriefProps } from "@/components/brief/briefProps";
import { SceneImage } from "@/components/ui/SceneImage";
import type from "@/components/ui/type.module.css";
import type { Locale } from "@/lib/i18n";
import { Chapter, chapterStyles } from "./Chapter";
import styles from "./sections.module.css";

/** Глава 6. Снова рассвет + бриф-предложение (CLAUDE.md, разделы 2 и 9). */
export async function ReturnSection() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("return");
  const chapters = await getTranslations("chapters");
  const brief = getBriefProps(locale);

  return (
    <Chapter id="return" time={t("time")} name={chapters("return")}>
      <div className={chapterStyles.head}>
        <h2 id="return-title" className={type.chapterTitle} data-reveal="">
          {t("title")}
        </h2>
      </div>
      <SceneImage
        sceneSlot
        src="/assets/placeholders/return.svg"
        alt={t("sceneAlt")}
        width={1600}
        height={900}
        sizes="100vw"
      />
      <section id="brief" className={styles.brief} aria-labelledby="brief-title">
        <h3 id="brief-title" className={type.subTitle}>
          {brief.copy.variants.brief.title}
        </h3>
        <p className={type.lead} data-reveal="">
          {brief.copy.variants.brief.lead}
        </p>
        <BriefForm variant="brief" withSentence {...brief} />
      </section>
    </Chapter>
  );
}
