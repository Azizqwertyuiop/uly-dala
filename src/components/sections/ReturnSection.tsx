import { getTranslations } from "next-intl/server";
import { SceneImage } from "@/components/ui/SceneImage";
import type from "@/components/ui/type.module.css";
import { Chapter, chapterStyles } from "./Chapter";
import styles from "./sections.module.css";

/*
 * Глава 6. Снова рассвет + бриф.
 * TODO(brief): бриф-предложение с полями и обычной формой (работает без JS) — шаг 5.
 */
export async function ReturnSection() {
  const t = await getTranslations("return");
  const chapters = await getTranslations("chapters");

  return (
    <Chapter id="return" time={t("time")} name={chapters("return")}>
      <div className={chapterStyles.head}>
        <h2 id="return-title" className={type.chapterTitle}>
          {t("title")}
        </h2>
      </div>
      <SceneImage
        src="/assets/placeholders/return.svg"
        alt={t("sceneAlt")}
        width={1600}
        height={900}
        sizes="100vw"
      />
      <div id="brief" className={styles.brief}>
        <h3 className={type.subTitle}>{t("briefTitle")}</h3>
        <p className={styles.briefSentence}>{t("briefSentence")}</p>
        <p className={type.pending}>{t("briefPending")}</p>
      </div>
    </Chapter>
  );
}
