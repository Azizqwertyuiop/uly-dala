import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/ButtonLink";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { Chapter } from "./Chapter";
import { HeroFrame } from "./HeroFrame";
import { FallbackClip } from "./FallbackClip";
import styles from "./sections.module.css";

/*
 * Глава 1. Рассвет — первый экран (CLAUDE.md, раздел 2). Единственный <h1> главной.
 * Кинорежим (html[data-cinematic]): 150vh, экран закреплён (sticky), сцена — на холсте.
 * «Коротко», reduced motion, без JS: обычный поток и статичный кадр.
 * CTA кликабельны с первой секунды — анимация их не ждёт.
 */
export async function DawnSection() {
  const t = await getTranslations("hero");
  const chapters = await getTranslations("chapters");

  return (
    <Chapter
      id="dawn"
      time={t("time")}
      name={chapters("dawn")}
      className={styles.dawn}
      innerClassName={styles.dawnStage}
    >
      <FallbackClip chapter="dawn" className={styles.heroFrame}>
        <HeroFrame label={t("sceneAlt")} />
      </FallbackClip>
      {/* Прелоадер: линия горизонта прочерчивается по прогрессу загрузки 3D. */}
      <span className={styles.preloader} aria-hidden="true" />
      <div className={styles.heroText} data-hero-text="">
        {/* Портрет телефона: заголовок — сверху, CTA — снизу (под большим пальцем), между ними —
            горизонт и конь. На широком экране обе группы идут подряд. */}
        <div className={styles.heroHead}>
          {/* Вариант «glow»: текст сразу виден, свет проходит поверх по таймлайну интро (4,2 с). */}
          <h1
            id="dawn-title"
            className={type.heroTitle}
            data-reveal="glow"
            data-reveal-wait="intro"
            data-reveal-text={t("title")}
          >
            {t("title")}
          </h1>
          <p
            className={type.lead}
            data-reveal="glow"
            data-reveal-wait="intro"
            data-reveal-text={t("subtitle")}
          >
            {t("subtitle")}
          </p>
        </div>
        <div className={styles.heroFoot}>
          <p className={type.proof}>{t("proof")}</p>
          <div className={layout.actions}>
            <ButtonLink href="/#brief" dawnHover>
              {t("ctaPrimary")}
            </ButtonLink>
            <ButtonLink href="/fazenda" variant="secondary">
              {t("ctaSecondary")}
            </ButtonLink>
          </div>
        </div>
      </div>
      <p className={styles.scrollHint} aria-hidden="true">
        {t("scrollHint")}
      </p>
    </Chapter>
  );
}
