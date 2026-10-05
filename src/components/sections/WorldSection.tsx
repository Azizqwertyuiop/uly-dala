import { getLocale, getTranslations } from "next-intl/server";
import { WORLD_ZONES } from "@/canvas/world/timeline";
import { caseText, cases } from "@/content/cases";
import { clientLogos, pickReviews, reviews } from "@/content/clients";
import { extrasCapacity, fazenda, FAZENDA_EXTRAS, mapLinks } from "@/content/fazenda";
import type { Locale } from "@/lib/i18n";
import { BriefLink } from "@/components/brief/BriefLink";
import { briefFallbackHref } from "@/components/brief/briefProps";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SceneImage } from "@/components/ui/SceneImage";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { CaseLink } from "./CaseLink";
import { Chapter } from "./Chapter";
import { FazendaMap } from "./FazendaMap";
import { FallbackClip } from "./FallbackClip";
import styles from "./sections.module.css";
import { assetUrl } from "@/lib/assets/url";

export const zones = WORLD_ZONES;

/*
 * Глава 5. Этот мир существует (CLAUDE.md, раздел 2).
 * 1) Лента реальных событий: кадры архива — WebGL-двойники поверх <img>, проявляются «дымом»;
 *    клик → страница кейса общим элементом (CaseLink).
 * 2) Дорога (схема, время в пути, 2GIS / Google Maps), клиенты и отзывы.
 * 3) Фазенда: дорожка 200vh, экран закреплён; «свет» → облёт с остановками в четырёх зонах
 *    (сплаты на high, видео на medium; сцена пишет data-zone), CTA «Приехать на просмотр».
 *    В конце дорожки фазенда гаснет — под ней уже ночная степь финала (глава 6, вплотную).
 *    Без 3D — фото и список зон.
 * TODO(client-data): вместимость, адрес и время в пути, кейсы, логотипы, отзывы.
 */
export async function WorldSection() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("world");
  const chapters = await getTranslations("chapters");
  const links = mapLinks(fazenda.location);
  const picked = pickReviews(reviews, locale);

  return (
    <Chapter id="world" time={t("time")} name={chapters("world")} className={styles.world}>
      <div className={styles.textBlock}>
        <h2 id="world-title" className={type.chapterTitle} data-reveal="">
          {t("title")}
        </h2>
        <p className={type.lead} data-reveal="">
          {t("lead")}
        </p>
      </div>

      <div className={styles.textBlock}>
        <h3 className={type.eyebrow}>{t("archiveLabel")}</h3>
        <ul className={styles.archive}>
          {cases.map((item) => {
            const text = caseText(item, locale);
            return (
              <li key={item.slug} className={styles.caseCard}>
                <CaseLink href={`/cases/${item.slug}`} className={styles.caseLink}>
                  <SceneImage
                    className={styles.caseFrame}
                    src={item.cover.src}
                    alt={text.coverAlt}
                    width={item.cover.width}
                    height={item.cover.height}
                    sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                    gl="smoke"
                  />
                  <span className={type.subTitle}>{text.title}</span>
                </CaseLink>
                <p className={type.body}>{text.summary}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={styles.worldInfo}>
        <div className={styles.textBlock}>
          <h3 className={type.eyebrow}>{t("mapLabel")}</h3>
          <FazendaMap title={t("mapTitle")} city={t("mapCity")} fazenda={t("mapFazenda")} />
          <p className={`${type.body} ${styles.tabular}`}>
            {fazenda.travelMinutes === null
              ? t("travelPending")
              : t("travel", { minutes: fazenda.travelMinutes })}{" "}
            {t("mapNote")}
          </p>
          {links ? (
            <p className={styles.worldLinks}>
              <a
                className={type.link}
                href={links.twoGis}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("map2gis")}
              </a>
              <a
                className={type.link}
                href={links.google}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("mapGoogle")}
              </a>
            </p>
          ) : (
            <p className={type.pending}>{t("mapPending")}</p>
          )}
        </div>

        <div className={styles.textBlock}>
          <h3 className={type.eyebrow}>{t("logosLabel")}</h3>
          {clientLogos.length > 0 ? (
            <ul className={styles.logos}>
              {clientLogos.map((logo) => (
                <li key={logo.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- одноцветный SVG, без оптимизации */}
                  <img src={logo.src} alt={logo.name} width={logo.width} height={logo.height} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={type.pending}>{t("logosPending")}</p>
          )}
        </div>

        <div className={styles.textBlock}>
          <h3 className={type.eyebrow}>{t("reviewsLabel")}</h3>
          {picked.length > 0 ? (
            <ul className={styles.reviews}>
              {picked.map((review) => (
                <li key={review.author}>
                  <figure className={styles.review}>
                    <blockquote className={type.lead}>
                      <p>{review.quote}</p>
                    </blockquote>
                    <figcaption className={type.caption}>
                      {review.author}, {review.role}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          ) : (
            <p className={type.pending}>{t("reviewsPending")}</p>
          )}
        </div>
      </div>

      {/* Ещё на фазенде: места и активности помимо зон облёта (без остановок камеры). */}
      <div className={styles.worldExtras}>
        <h3 className={type.eyebrow} id="world-extras">
          {t("extrasLabel")}
        </h3>
        <ul className={styles.worldExtrasList} aria-labelledby="world-extras">
          {FAZENDA_EXTRAS.map((extra) => {
            const capacity = extrasCapacity[extra];
            return (
              <li key={extra} className={styles.worldExtra} data-extra={extra}>
                <p className={type.subTitle}>{t(`extras.${extra}.name`)}</p>
                <p className={type.body}>{t(`extras.${extra}.text`)}</p>
                {capacity !== undefined && (
                  <p className={`${type.caption} ${styles.tabular}`}>
                    {t("capacity", { count: capacity })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className={styles.worldTrack} data-track="world">
        <div className={styles.worldStage} data-world-stage="" data-zone={zones[0]}>
          <FallbackClip chapter="world" className={styles.worldFrame}>
            <SceneImage
              sceneSlot
              src={assetUrl("/assets/placeholders/fazenda.svg")}
              alt={t("sceneAlt")}
              width={1600}
              height={900}
              sizes="100vw"
            />
          </FallbackClip>
          <div className={`${styles.textBlock} ${styles.worldHead}`}>
            <h3 className={type.subTitle}>{t("fazendaLabel")}</h3>
            <p className={type.body}>{t("location")}</p>
            <p className={`${type.caption} ${styles.worldHint}`}>{t("zonesHint")}</p>
            <div className={layout.actions}>
              <BriefLink href={briefFallbackHref(locale, "visit")} source="visit">
                {t("cta")}
              </BriefLink>
              <ButtonLink href="/fazenda" variant="secondary">
                {t("fazendaLink")}
              </ButtonLink>
            </div>
          </div>
          <div className={styles.worldZonesBlock}>
            <h3 className={type.eyebrow} id="world-zones">
              {t("zonesLabel")}
            </h3>
            <ol className={styles.worldZones} aria-labelledby="world-zones">
              {zones.map((zone) => {
                const capacity = fazenda.capacity[zone];
                return (
                  <li key={zone} className={styles.worldZone} data-zone-item={zone}>
                    <p className={type.subTitle}>{t(`zones.${zone}.name`)}</p>
                    <p className={type.body}>{t(`zones.${zone}.text`)}</p>
                    <p className={`${type.caption} ${styles.tabular}`}>
                      {capacity === null
                        ? t("capacityPending")
                        : t("capacity", { count: capacity })}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </Chapter>
  );
}
