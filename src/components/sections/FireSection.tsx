import { getLocale, getTranslations } from "next-intl/server";
import { BriefLink } from "@/components/brief/BriefLink";
import { briefFallbackHref } from "@/components/brief/briefProps";
import { menu, menuSets } from "@/content/menu";
import type { Locale } from "@/lib/i18n";
import { SceneImage } from "@/components/ui/SceneImage";
import type from "@/components/ui/type.module.css";
import { Chapter, ChapterTime } from "./Chapter";
import { FirePlan, type FireSetItem } from "./FirePlan";
import { FallbackClip } from "./FallbackClip";
import styles from "./sections.module.css";

/*
 * Глава 4. Огонь (CLAUDE.md, раздел 2). Шеф, кухня, дастархан.
 * Кинорежим (есть 3D): дорожка 200vh, экран закреплён; макро у очага → dolly zoom в вид сверху,
 * дастархан как план; подписи блюд — над блюдами, сеты — переключатель. Закат → ночь.
 * Обычная раскладка («Коротко», без WebGL, без JS): кадр, сеты и вертикальные списки блюд.
 */
export async function FireSection() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("fire");
  const chapters = await getTranslations("chapters");

  const sets: FireSetItem[] = menuSets.map((id) => ({
    id,
    name: t(`sets.${id}.name`),
    text: t(`sets.${id}.text`),
    dishes: menu[id].map((d) => {
      // id блюд — из content/menu.ts; ключи текстов проверяет тест на полноту переводов.
      const key = `dishes.${id}.${d.id}` as "dishes.traditional.tea";
      return { id: d.id, name: t(`${key}.name`), note: t(`${key}.note`) };
    }),
  }));

  return (
    <Chapter id="fire" time={t("time")} name={chapters("fire")} className={styles.fire} hideTime>
      <div className={styles.fireTrack} data-track="fire">
        <div className={styles.fireStage} data-fire-stage="" data-phase="gather">
          <FallbackClip chapter="fire" className={styles.fireFrame}>
            <SceneImage
              sceneSlot
              src="/assets/placeholders/fire.svg"
              alt={t("sceneAlt")}
              width={1600}
              height={900}
              sizes="100vw"
            />
          </FallbackClip>
          <div className={`${styles.textBlock} ${styles.fireHead}`}>
            <ChapterTime time={t("time")} name={chapters("fire")} />
            <h2 id="fire-title" className={type.chapterTitle} data-reveal="">
              {t("title")}
            </h2>
            <p className={type.lead} data-reveal="">
              {t("lead")}
            </p>
          </div>
          <FirePlan
            sets={sets}
            labels={{ sets: t("setsLabel"), plan: t("planLabel"), list: t("listLabel") }}
            cta={
              <BriefLink href={briefFallbackHref(locale, "menu")} source="menu">
                {t("cta")}
              </BriefLink>
            }
          />
        </div>
      </div>
    </Chapter>
  );
}
