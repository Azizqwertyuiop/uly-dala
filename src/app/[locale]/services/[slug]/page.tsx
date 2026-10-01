import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell, pageStyles } from "@/components/layout/PageShell";
import { BriefLink } from "@/components/brief/BriefLink";
import { briefFallbackHref } from "@/components/brief/briefProps";
import { SceneImage } from "@/components/ui/SceneImage";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { findFormat, formatImage, formats } from "@/content/formats";
import { Link } from "@/lib/intl/navigation";
import { faqLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo/JsonLd";
import { resolveLocale } from "@/lib/intl/locale";

export const dynamicParams = false;

export function generateStaticParams() {
  return formats.map(({ slug }) => ({ slug }));
}

async function load(params: PageProps<"/[locale]/services/[slug]">["params"]) {
  const { locale: raw, slug } = await params;
  const locale = resolveLocale(raw);
  const format = findFormat(slug);
  if (!format) notFound();
  return { locale, format };
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/services/[slug]">): Promise<Metadata> {
  const { locale, format } = await load(params);
  const t = await getTranslations({ locale, namespace: "formats" });
  return pageMetadata({
    locale,
    path: `/services/${format.slug}`,
    title: t(`${format.key}.metaTitle`),
    description: t(`${format.key}.metaDescription`),
    image: format.slug,
    imageAlt: t(`${format.key}.sceneAlt`),
  });
}

/** Страница формата: /[locale]/services/[slug]. */
export default async function ServicePage({ params }: PageProps<"/[locale]/services/[slug]">) {
  const { locale, format } = await load(params);
  setRequestLocale(locale);
  const t = await getTranslations("formats");
  const page = await getTranslations("servicePage");
  const { key, slug } = format;
  // Частые вопросы — видимым текстом на странице и в FAQPage (раздел 11; скрытого текста нет).
  const faq = ([1, 2, 3] as const).map((n) => ({
    q: t(`${key}.faq.q${n}`),
    a: t(`${key}.faq.a${n}`),
  }));

  return (
    <PageShell>
      <div className={layout.grid}>
        <div className={`${pageStyles.head} ${layout.main}`}>
          <h1 className={type.chapterTitle} data-reveal="">
            {t(`${key}.title`)}
          </h1>
          <p className={type.lead} data-reveal="">
            {t(`${key}.phrase`)}
          </p>
          <p className={type.body}>{t(`${key}.lead`)}</p>
        </div>
      </div>

      <SceneImage
        src={formatImage(slug)}
        alt={t(`${key}.sceneAlt`)}
        width={1600}
        height={900}
        priority
        sizes="100vw"
      />

      <section className={pageStyles.section} aria-labelledby="facts-title">
        <h2 id="facts-title" className={type.subTitle}>
          {page("factsLabel")}
        </h2>
        <ul className={type.list}>
          <li>{t(`${key}.facts.one`)}</li>
          <li>{t(`${key}.facts.two`)}</li>
          <li>{t(`${key}.facts.three`)}</li>
        </ul>
        <div>
          <BriefLink href={briefFallbackHref(locale, "brief")} source="brief" eventType={slug}>
            {t(`${key}.cta`)}
          </BriefLink>
        </div>
      </section>

      <section className={pageStyles.section} aria-labelledby="faq-title">
        <h2 id="faq-title" className={type.subTitle}>
          {page("faqLabel")}
        </h2>
        <dl className={layout.stack}>
          {faq.map(({ q, a }) => (
            <div key={q} className={layout.stack}>
              <dt className={type.lead}>{q}</dt>
              <dd className={type.body}>{a}</dd>
            </div>
          ))}
        </dl>
      </section>
      <JsonLd data={faqLd(faq)} />

      <nav className={pageStyles.section} aria-labelledby="other-formats">
        <h2 id="other-formats" className={type.subTitle}>
          {page("otherFormats")}
        </h2>
        <ul className={type.list}>
          {formats
            .filter((other) => other.slug !== slug)
            .map((other) => (
              <li key={other.slug}>
                <Link href={`/services/${other.slug}`} className={type.link}>
                  {t(`${other.key}.title`)}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </PageShell>
  );
}
