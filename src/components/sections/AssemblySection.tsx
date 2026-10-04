import { getLocale, getTranslations } from "next-intl/server";
import { BriefLink } from "@/components/brief/BriefLink";
import { briefFallbackHref } from "@/components/brief/briefProps";
import type { Locale } from "@/lib/i18n";
import { SceneImage } from "@/components/ui/SceneImage";
import type from "@/components/ui/type.module.css";
import { AssemblyRotate } from "./AssemblyRotate";
import { AudienceText } from "./AudienceText";
import { Chapter, ChapterTime } from "./Chapter";
import { ForkLinks } from "./ForkLinks";
import { FallbackClip } from "./FallbackClip";
import styles from "./sections.module.css";
import { assetUrl } from "@/lib/assets/url";

const parts = ["kerege", "uyki", "shanyrak", "kiiz"] as const;

/*
 * Глава 2. Сборка (CLAUDE.md, раздел 2). Детали юрты = службы агентства.
 *
 * Кинорежим (html[data-cinematic], есть 3D): дорожка 300vh (data-track), экран закреплён (sticky);
 * юрта собирается на скролле, подпись текущего этапа стоит у своей детали (сцена пишет data-phase
 * и --caption-xy), в финале — столп света и фраза. Юрту можно вращать (AssemblyRotate).
 * Обычная раскладка («Коротко», без WebGL, без JS): те же тексты, четыре статичных кадра этапов.
 * Весь текст — в DOM с самого начала; сцена только показывает нужное.
 */
export async function AssemblySection() {
  const t = await getTranslations("assembly");
  const chapters = await getTranslations("chapters");
  // Названия деталей юрты — казахские слова; в en они даны транслитерацией.
  const locale = (await getLocale()) as Locale;
  const partLang = locale === "en" ? undefined : "kk";

  return (
    <Chapter
      id="assembly"
      time={t("time")}
      name={chapters("assembly")}
      className={styles.assembly}
      hideTime
    >
      <div className={styles.assemblyTrack} data-track="assembly">
        <div className={styles.assemblyStage} data-assembly-stage="" data-phase="kerege">
          <FallbackClip chapter="assembly" className={styles.assemblyFrame}>
            <SceneImage
              sceneSlot
              src={assetUrl("/assets/placeholders/assembly.svg")}
              alt={t("sceneAlt")}
              width={1600}
              height={900}
              sizes="100vw"
            />
          </FallbackClip>

          <div className={`${styles.textBlock} ${styles.assemblyText}`}>
            <ChapterTime time={t("time")} name={chapters("assembly")} />
            <h2 id="assembly-title" className={type.chapterTitle} data-reveal="">
              {t("title")}
            </h2>
            <p className={type.lead} data-reveal="">
              {t("manifest")}
            </p>
          </div>

          <h3 className={`${type.eyebrow} ${styles.partsLabel}`}>{t("partsLabel")}</h3>
          <ol className={styles.parts}>
            {parts.map((part) => (
              <li key={part} className={styles.part} data-part={part}>
                <SceneImage
                  className={styles.partFrame}
                  src={assetUrl(`/assets/placeholders/assembly-${part}.svg`)}
                  alt={t(`parts.${part}.frameAlt`)}
                  width={1600}
                  height={900}
                  sizes="(min-width: 768px) 25vw, 100vw"
                />
                <div className={styles.partText}>
                  <p className={type.subTitle} lang={partLang}>
                    {t(`parts.${part}.name`)}
                  </p>
                  <p className={type.body}>{t(`parts.${part}.text`)}</p>
                </div>
              </li>
            ))}
          </ol>

          <figure className={styles.pillar}>
            <SceneImage
              sceneSlot
              className={styles.pillarFrame}
              src={assetUrl("/assets/placeholders/pillar.svg")}
              alt={t("pillarAlt")}
              width={1600}
              height={900}
              sizes="100vw"
            />
            <figcaption className={`${type.subTitle} ${styles.pillarPhrase}`}>
              {t("pillar")}
            </figcaption>
          </figure>

          <AssemblyRotate
            label={t("rotateLabel")}
            hint={t("rotateHint")}
            hintTouch={t("rotateHintTouch")}
          />
        </div>
      </div>

      <div className={styles.assemblyAfter}>
        <nav className={styles.fork} aria-labelledby="assembly-fork">
          <h3 id="assembly-fork" className={type.subTitle}>
            {t("forkQuestion")}
          </h3>
          <ForkLinks
            labels={{
              corporate: t("fork.corporate"),
              family: t("fork.family"),
              all: t("fork.all"),
            }}
          />
        </nav>

        <div>
          <BriefLink href={briefFallbackHref(locale, "brief")} source="brief">
            <AudienceText
              labels={{ all: t("cta"), corporate: t("ctaCorporate"), family: t("ctaFamily") }}
            />
          </BriefLink>
        </div>
      </div>
    </Chapter>
  );
}
