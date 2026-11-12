import { getLocale, getTranslations } from "next-intl/server";
import { BriefLink } from "@/components/brief/BriefLink";
import { briefFallbackHref } from "@/components/brief/briefProps";
import type { Locale } from "@/lib/i18n";
import { SceneImage } from "@/components/ui/SceneImage";
import type from "@/components/ui/type.module.css";
import { contacts, telHref, whatsappHref } from "@/content/contacts";
import home from "@/components/home/home.module.css";
import { AssemblyRotate } from "./AssemblyRotate";
import { Chapter } from "./Chapter";
import { FallbackClip } from "./FallbackClip";
import styles from "./sections.module.css";
import { assetUrl } from "@/lib/assets/url";

const parts = ["kerege", "uyki", "shanyrak", "kiiz"] as const;

/*
 * Первый экран главной-визитки (решение заказчика 12.11.2026): юрта собирается на скролле,
 * поверх — кто мы, что делаем и две кнопки (заявка, WhatsApp/звонок). Детали юрты = службы.
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
  const hero = await getTranslations("home.hero");
  const proof = await getTranslations("hero");
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

          <div className={`${styles.textBlock} ${styles.assemblyText}`} data-home-hero="">
            <p className={type.eyebrow}>{hero("eyebrow")}</p>
            <h1 id="assembly-title" className={type.chapterTitle}>
              {hero("title")}
            </h1>
            <p className={type.lead}>{hero("lead")}</p>
            <div className={home.actions}>
              <BriefLink
                href={briefFallbackHref(locale, "brief")}
                source="brief"
                variant="link"
                className={home.cta}
              >
                {hero("ctaBrief")}
              </BriefLink>
              {contacts.whatsapp ? (
                <a href={whatsappHref(contacts.whatsapp)} className={home.ctaSecondary}>
                  {hero("ctaWhatsapp")}
                </a>
              ) : contacts.phone ? (
                <a href={telHref(contacts.phone)} className={home.ctaSecondary}>
                  {hero("ctaCall")}
                </a>
              ) : null}
            </div>
            <p className={type.proof}>{proof("proof")}</p>
          </div>

          <h2 className={`${type.eyebrow} ${styles.partsLabel}`}>{t("partsLabel")}</h2>
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
    </Chapter>
  );
}
