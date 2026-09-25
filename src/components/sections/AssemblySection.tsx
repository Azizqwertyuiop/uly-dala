import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SceneImage } from "@/components/ui/SceneImage";
import type from "@/components/ui/type.module.css";
import { Chapter } from "./Chapter";
import styles from "./sections.module.css";

const parts = ["kerege", "uyki", "shanyrak", "kiiz"] as const;

/*
 * Глава 2. Сборка. Детали юрты = службы агентства.
 * Развилка пока ведёт к форматам; влияние на порядок форматов и бриф — шаг с состоянием (Zustand).
 */
export async function AssemblySection() {
  const t = await getTranslations("assembly");
  const chapters = await getTranslations("chapters");
  // Названия деталей юрты — казахские слова; в en они даны транслитерацией.
  const partLang = (await getLocale()) === "en" ? undefined : "kk";

  return (
    <Chapter id="assembly" time={t("time")} name={chapters("assembly")}>
      <div className={styles.split}>
        <div className={`${styles.textBlock} ${styles.splitText}`}>
          <h2 id="assembly-title" className={type.chapterTitle}>
            {t("title")}
          </h2>
          <p className={type.lead}>{t("manifest")}</p>
        </div>
        <SceneImage
          className={styles.splitMedia}
          src="/assets/placeholders/assembly.svg"
          alt={t("sceneAlt")}
          width={1600}
          height={900}
          sizes="(min-width: 768px) 50vw, 100vw"
        />
      </div>

      <div className={styles.textBlock}>
        <h3 className={type.eyebrow}>{t("partsLabel")}</h3>
        <ol className={styles.parts}>
          {parts.map((part) => (
            <li key={part} className={styles.part}>
              <p className={type.subTitle} lang={partLang}>
                {t(`parts.${part}.name`)}
              </p>
              <p className={type.body}>{t(`parts.${part}.text`)}</p>
            </li>
          ))}
        </ol>
      </div>

      <figure className={styles.pillar}>
        <SceneImage
          src="/assets/placeholders/pillar.svg"
          alt={t("pillarAlt")}
          width={1600}
          height={900}
          sizes="100vw"
        />
        <figcaption className={type.subTitle}>{t("pillar")}</figcaption>
      </figure>

      <nav className={styles.fork} aria-labelledby="assembly-fork">
        <h3 id="assembly-fork" className={type.subTitle}>
          {t("forkQuestion")}
        </h3>
        <ul className={styles.forkList}>
          <li>
            <a href="#day" className={type.link}>
              {t("fork.corporate")}
            </a>
          </li>
          <li>
            <a href="#day" className={type.link}>
              {t("fork.family")}
            </a>
          </li>
          <li>
            <a href="#day" className={type.link}>
              {t("fork.all")}
            </a>
          </li>
        </ul>
      </nav>

      <div>
        <ButtonLink href="/#brief">{t("cta")}</ButtonLink>
      </div>
    </Chapter>
  );
}
