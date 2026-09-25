import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SceneImage } from "@/components/ui/SceneImage";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { Chapter } from "./Chapter";
import styles from "./sections.module.css";

/** Глава 1. Рассвет — первый экран. Единственный <h1> главной. */
export async function DawnSection() {
  const t = await getTranslations("hero");
  const chapters = await getTranslations("chapters");

  return (
    <Chapter id="dawn" time={t("time")} name={chapters("dawn")}>
      <div className={styles.hero}>
        <div className={styles.heroText}>
          {/* Первый экран — вариант «glow»: текст сразу виден, свет проходит поверх. */}
          <h1
            id="dawn-title"
            className={type.heroTitle}
            data-reveal="glow"
            data-reveal-text={t("title")}
          >
            {t("title")}
          </h1>
          <p className={type.lead} data-reveal="glow" data-reveal-text={t("subtitle")}>
            {t("subtitle")}
          </p>
          <p className={type.proof}>{t("proof")}</p>
          <div className={layout.actions}>
            <ButtonLink href="/#brief">{t("ctaPrimary")}</ButtonLink>
            <ButtonLink href="/fazenda" variant="secondary">
              {t("ctaSecondary")}
            </ButtonLink>
          </div>
        </div>
        <SceneImage
          className={styles.heroMedia}
          src="/assets/placeholders/dawn.svg"
          alt={t("sceneAlt")}
          width={1600}
          height={900}
          priority
          sizes="(min-width: 1280px) 75vw, 100vw"
        />
      </div>
    </Chapter>
  );
}
