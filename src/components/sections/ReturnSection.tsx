import { getLocale, getTranslations } from "next-intl/server";
import { BriefForm } from "@/components/brief/BriefForm";
import { getBriefProps } from "@/components/brief/briefProps";
import { SceneImage } from "@/components/ui/SceneImage";
import type from "@/components/ui/type.module.css";
import type { Locale } from "@/lib/i18n";
import { Chapter, ChapterTime } from "./Chapter";
import { FallbackClip } from "./FallbackClip";
import styles from "./sections.module.css";

/*
 * Глава 6. Снова рассвет + бриф-предложение (CLAUDE.md, разделы 2 и 9).
 * Кинорежим: дорожка 180vh, экран закреплён — та же степь, что на первом экране (петля),
 * но пустая: звёзды гаснут, горизонт светлеет, круг примятой травы поднимается.
 * Финальная фраза проявляется светом; под ней — бриф. Без 3D — кадр, фраза и бриф подряд.
 */
export async function ReturnSection() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("return");
  const chapters = await getTranslations("chapters");
  const brief = getBriefProps(locale);

  return (
    <Chapter
      id="return"
      time={t("time")}
      name={chapters("return")}
      className={styles.finale}
      hideTime
    >
      <div className={styles.finaleTrack} data-track="return">
        <div className={styles.finaleStage} data-return-stage="">
          <FallbackClip chapter="return" className={styles.finaleFrame}>
            <SceneImage
              sceneSlot
              src="/assets/placeholders/return.svg"
              alt={t("sceneAlt")}
              width={1600}
              height={900}
              sizes="100vw"
            />
          </FallbackClip>
          <div className={styles.finaleText}>
            <ChapterTime time={t("time")} name={chapters("return")} />
            <h2 id="return-title" className={type.chapterTitle} data-reveal="">
              {t("title")}
            </h2>
          </div>
        </div>
      </div>
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
