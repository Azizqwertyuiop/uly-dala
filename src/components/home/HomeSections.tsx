import { getLocale, getTranslations } from "next-intl/server";
import { BriefForm } from "@/components/brief/BriefForm";
import { BriefLink } from "@/components/brief/BriefLink";
import { briefFallbackHref, getBriefProps } from "@/components/brief/briefProps";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { clientLogos, pickReviews, reviews } from "@/content/clients";
import { contacts, formatPhone, telHref, whatsappHref } from "@/content/contacts";
import { FAZENDA_EXTRAS } from "@/content/fazenda";
import { formatImage, formatSrcSet, formats, hasFormatPhoto } from "@/content/formats";
import gallery from "@/content/gallery.json";
import { instagramHref, stats } from "@/content/home";
import { team } from "@/content/team";
import { assetUrl } from "@/lib/assets/url";
import type { Locale } from "@/lib/i18n";
import { Link } from "@/lib/intl/navigation";
import { GalleryGrid } from "./GalleryGrid";
import styles from "./home.module.css";

/*
 * Главная-визитка (решение заказчика 12.11.2026): после первого экрана со сборкой юрты —
 * обычные понятные блоки. Блоки без подтверждённых данных (цифры, клиенты, отзывы) не
 * показываются, пока данных нет (TODO(client-data)): пустых заглушек клиент не видит.
 * Исключение — команда: рамки под фото и имена видны до получения данных (по просьбе заказчика).
 */

type Tone = "light" | "dark";

function Section({
  id,
  tone = "light",
  title,
  lead,
  children,
}: {
  id: string;
  tone?: Tone;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} data-tone={tone} className={styles.section}>
      <div className={`${layout.container} ${styles.inner}`}>
        <div className={styles.head}>
          <h2 id={`${id}-title`} className={styles.title}>
            {title}
          </h2>
          {lead && <p className={type.lead}>{lead}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Цифры доверия — только подтверждённые; пока их нет, блок скрыт. */
export async function Stats() {
  const t = await getTranslations("home.stats");
  const items = (["years", "events", "guests"] as const).filter((k) => stats[k] !== null);
  if (items.length === 0) return null;
  return (
    <Section id="stats" title={t("title")}>
      <dl className={styles.stats}>
        {items.map((k) => (
          <div key={k} className={styles.stat}>
            <dt className={type.body}>{t(k)}</dt>
            <dd className={styles.statValue}>{stats[k]}+</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/**
 * Услуги карточками со ссылкой. Свадьба и кудалык, кофе-брейк и кейтеринг, аренда техники и фотобудка — по одной карточке
 * (решение заказчика 12.11.2026); отдельные страницы этих услуг остаются (SEO, раздел 11).
 */
const SERVICE_CARDS = [
  { key: "conference", href: "conference", photo: "conference" },
  { key: "team-building", href: "team-building", photo: "team-building" },
  { key: "coffee-catering", href: "catering", photo: "coffee-break" },
  { key: "wedding-kudalyk", href: "wedding", photo: "wedding" },
  { key: "private-party", href: "private-party", photo: "private-party" },
  { key: "equipment-booth", href: "equipment-rental", photo: null },
] as const;

type CombinedKey = "coffee-catering" | "wedding-kudalyk" | "equipment-booth";
const isCombined = (key: string): key is CombinedKey =>
  key === "coffee-catering" || key === "wedding-kudalyk" || key === "equipment-booth";

export async function Services() {
  const t = await getTranslations("home.services");
  const f = await getTranslations("formats");
  const pending = (await getTranslations("home.team"))("photoPending");
  const cards = SERVICE_CARDS.map(({ key, href, photo }) => {
    const title = isCombined(key)
      ? t(`titles.${key}`)
      : f(`${formats.find((x) => x.slug === key)!.key}.title`);
    const shown = photo !== null && hasFormatPhoto(photo);
    return {
      slug: href,
      title,
      text: t(`cards.${key}`),
      image: shown ? formatImage(photo) : null,
      srcSet: shown ? formatSrcSet(photo) : undefined,
    };
  });
  return (
    <Section id="services" title={t("title")} lead={t("lead")}>
      <ul className={styles.cards}>
        {cards.map((c) => (
          <li key={c.slug} className={styles.card}>
            <Link href={`/services/${c.slug}`} className={styles.cardLink} data-cta="format">
              <span className={styles.cardMedia} aria-hidden="true">
                {!c.image && <span className={styles.cardPending}>{pending}</span>}
                {c.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- свои размеры и srcset
                  <img
                    src={c.image}
                    srcSet={c.srcSet}
                    sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw"
                    alt=""
                    width={1500}
                    height={1000}
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </span>
              <span className={styles.cardTitle}>{c.title}</span>
              <span className={type.body}>{c.text}</span>
              <span className={styles.cardMore}>{t("more")} →</span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Логотипы клиентов — только с разрешения; пока их нет, блок скрыт. */
export async function Clients() {
  if (clientLogos.length === 0) return null;
  const t = await getTranslations("home.clients");
  return (
    <Section id="clients" title={t("title")}>
      <ul className={styles.logos}>
        {clientLogos.map((logo) => (
          <li key={logo.name}>
            {/* eslint-disable-next-line @next/next/no-img-element -- одноцветный SVG */}
            <img src={logo.src} alt={logo.name} width={logo.width} height={logo.height} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Галерея тимбилдингов: сетка превью, по клику — крупно (без JS — ссылка на файл). */
export async function Gallery() {
  if (gallery.length === 0) return null;
  const t = await getTranslations("home.gallery");
  const total = gallery.length;
  const photos = gallery.map((g, i) => ({
    thumb: assetUrl(`/assets/photos/gallery/${g.name}-thumb.jpg`),
    full: assetUrl(`/assets/photos/gallery/${g.name}-full.jpg`),
    width: g.width,
    height: g.height,
    alt: t("alt", { n: i + 1 }),
    open: t("open", { n: i + 1, total }),
    counter: t("counter", { n: i + 1, total }),
  }));
  return (
    <Section id="gallery" title={t("title")} lead={t("lead")}>
      <GalleryGrid
        photos={photos}
        labels={{ dialog: t("dialog"), close: t("close"), prev: t("prev"), next: t("next") }}
      />
    </Section>
  );
}

export async function Why() {
  const t = await getTranslations("home.why");
  const items = ["venue", "equipment", "chef", "turnkey"] as const;
  return (
    <Section id="why" tone="dark" title={t("title")}>
      <ul className={styles.features}>
        {items.map((k) => (
          <li key={k} className={styles.feature}>
            <h3 className={styles.featureTitle}>{t(`${k}.title`)}</h3>
            <p className={type.body}>{t(`${k}.text`)}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export async function Steps() {
  const t = await getTranslations("home.steps");
  const items = ["one", "two", "three"] as const;
  return (
    <Section id="steps" title={t("title")}>
      <ol className={styles.steps}>
        {items.map((k, i) => (
          <li key={k} className={styles.step}>
            <span className={styles.stepNumber} aria-hidden="true">
              {i + 1}
            </span>
            <h3 className={styles.featureTitle}>{t(`${k}.title`)}</h3>
            <p className={type.body}>{t(`${k}.text`)}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export async function Fazenda() {
  const t = await getTranslations("home.fazenda");
  const w = await getTranslations("world");
  const locale = (await getLocale()) as Locale;
  const photo = hasFormatPhoto("private-party");
  return (
    <Section id="fazenda" title={t("title")} lead={t("lead")}>
      <div className={styles.fazenda}>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element -- свои размеры и srcset
          <img
            className={styles.fazendaImage}
            src={formatImage("private-party")}
            srcSet={formatSrcSet("private-party")}
            sizes="(min-width: 768px) 50vw, 100vw"
            alt={t("imageAlt")}
            width={1500}
            height={1000}
            loading="lazy"
            decoding="async"
          />
        )}
        <div className={styles.fazendaText}>
          <ul className={styles.tags}>
            {FAZENDA_EXTRAS.map((extra) => (
              <li key={extra} className={styles.tag}>
                {w(`extras.${extra}.name`)}
              </li>
            ))}
          </ul>
          <div className={layout.actions}>
            <BriefLink href={briefFallbackHref(locale, "visit")} source="visit">
              {t("visit")}
            </BriefLink>
            <Link href="/fazenda" className={type.link} data-cta="fazenda">
              {t("more")}
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}

/** Команда: три организатора; пока фото нет — рамка «Фото скоро» (TODO(client-data)). */
export async function Team() {
  const t = await getTranslations("home.team");
  return (
    <Section id="team" title={t("title")} lead={t("lead")}>
      <ul className={styles.team}>
        {team.map((m) => (
          <li key={m.key} className={styles.member}>
            <div className={styles.memberPhoto}>
              {m.photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- фото организатора
                <img
                  src={m.photo}
                  alt={t(`${m.key}.name`)}
                  width={800}
                  height={1000}
                  loading="lazy"
                />
              ) : (
                <span className={styles.memberPending}>{t("photoPending")}</span>
              )}
            </div>
            <h3 className={styles.featureTitle}>{t(`${m.key}.name`)}</h3>
            <p className={type.body}>{t(`${m.key}.role`)}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Отзывы — только согласованные с клиентами; пока их нет, блок скрыт. */
export async function Reviews() {
  if (reviews.length === 0) return null;
  const t = await getTranslations("home.reviews");
  const locale = (await getLocale()) as Locale;
  return (
    <Section id="reviews" title={t("title")}>
      <ul className={styles.reviews}>
        {pickReviews(reviews, locale).map((r) => (
          <li key={r.author}>
            <figure className={styles.review}>
              <blockquote className={type.lead}>
                <p>{r.quote}</p>
              </blockquote>
              <figcaption className={type.caption}>
                {r.author}, {r.role}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Заявка и прямые контакты. id="brief" — сюда ведут «Обсудить мероприятие» и форма без JS. */
export async function Contact() {
  const t = await getTranslations("home.contact");
  const locale = (await getLocale()) as Locale;
  const brief = getBriefProps(locale);
  const instagram = instagramHref();
  return (
    <section id="brief" aria-labelledby="brief-title" data-tone="dark" className={styles.section}>
      <div className={`${layout.container} ${styles.inner} ${styles.contact}`}>
        <div className={styles.head}>
          <h2 id="brief-title" className={styles.title}>
            {t("title")}
          </h2>
          <p className={type.lead}>{t("lead")}</p>
          {(contacts.whatsapp || contacts.phone || instagram) && (
            <div className={styles.direct}>
              <p className={type.eyebrow}>{t("directLabel")}</p>
              <ul className={styles.directList}>
                {contacts.whatsapp && (
                  <li>
                    <a href={whatsappHref(contacts.whatsapp)} className={type.link}>
                      {t("whatsapp")}
                    </a>
                  </li>
                )}
                {contacts.phone && (
                  <li>
                    <a href={telHref(contacts.phone)} className={type.link}>
                      {formatPhone(contacts.phone)}
                    </a>
                  </li>
                )}
                {instagram && (
                  <li>
                    <a href={instagram} className={type.link} rel="noopener noreferrer">
                      {t("instagram")}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
        <div className={styles.form}>
          {/* Короткая форма: обязательны только имя, телефон и согласие. */}
          <BriefForm
            variant="brief"
            fields={["eventType", "name", "phone", "comment"]}
            {...brief}
          />
        </div>
      </div>
    </section>
  );
}
