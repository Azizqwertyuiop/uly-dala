import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell, pageStyles } from "@/components/layout/PageShell";
import { BriefLink } from "@/components/brief/BriefLink";
import { briefFallbackHref } from "@/components/brief/briefProps";
import { CASE_COVER } from "@/components/sections/caseTransition";
import { SceneImage } from "@/components/ui/SceneImage";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { caseText, cases, findCase } from "@/content/cases";
import { findFormat } from "@/content/formats";
import { Link } from "@/lib/intl/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { caseLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { resolveLocale } from "@/lib/intl/locale";

export const dynamicParams = false;

export function generateStaticParams() {
  return cases.map(({ slug }) => ({ slug }));
}

async function load(params: PageProps<"/[locale]/cases/[slug]">["params"]) {
  const { locale: raw, slug } = await params;
  const locale = resolveLocale(raw);
  const item = findCase(slug);
  if (!item) notFound();
  return { locale, item, text: caseText(item, locale) };
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/cases/[slug]">): Promise<Metadata> {
  const { locale, item, text } = await load(params);
  return pageMetadata({
    locale,
    path: `/cases/${item.slug}`,
    title: `${text.title} — ULY DALA`,
    description: text.summary,
    image: item.format,
    imageAlt: text.coverAlt,
    type: "article",
  });
}

/** Страница кейса. Контент — src/content/cases/. */
export default async function CasePage({ params }: PageProps<"/[locale]/cases/[slug]">) {
  const { locale, item, text } = await load(params);
  setRequestLocale(locale);
  const t = await getTranslations("casesPage");
  const formatsT = await getTranslations("formats");
  const format = findFormat(item.format);

  return (
    <PageShell>
      <JsonLd
        data={caseLd({
          locale,
          path: `/cases/${item.slug}`,
          name: text.title,
          description: text.summary,
          image: item.format,
          about: format ? formatsT(`${format.key}.title`) : text.title,
        })}
      />
      <div className={layout.grid}>
        <div className={`${pageStyles.head} ${layout.main}`}>
          <p className={type.eyebrow}>{t("label")}</p>
          <h1 className={type.chapterTitle} data-reveal="">
            {text.title}
          </h1>
          <p className={type.lead} data-reveal="">
            {text.summary}
          </p>
          {format && (
            <p className={type.body}>
              {t("format")}:{" "}
              <Link href={`/services/${format.slug}`} className={type.link}>
                {formatsT(`${format.key}.title`)}
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Обложка — общий элемент с кадром ленты архива на главной (переход 1000 мс). */}
      <div data-case-cover="">
        <SceneImage
          src={item.cover.src}
          alt={text.coverAlt}
          width={item.cover.width}
          height={item.cover.height}
          priority
          sizes="100vw"
          transitionName={CASE_COVER}
        />
      </div>

      <div className={layout.grid}>
        <div className={`${layout.stackLarge} ${layout.main}`}>
          {(["task", "solution", "result"] as const).map((part) => (
            <section key={part} className={pageStyles.section} aria-labelledby={`case-${part}`}>
              <h2 id={`case-${part}`} className={type.subTitle}>
                {t(part)}
              </h2>
              <p className={item.placeholder ? type.pending : type.body}>{text[part]}</p>
            </section>
          ))}
        </div>
      </div>

      <nav className={pageStyles.section} aria-labelledby="other-cases">
        <h2 id="other-cases" className={type.subTitle}>
          {t("otherCases")}
        </h2>
        <ul className={type.list}>
          {cases
            .filter((other) => other.slug !== item.slug)
            .map((other) => (
              <li key={other.slug}>
                <Link href={`/cases/${other.slug}`} className={type.link}>
                  {caseText(other, locale).title}
                </Link>
              </li>
            ))}
        </ul>
      </nav>

      <div>
        <BriefLink href={briefFallbackHref(locale, "brief")} source="brief" eventType={item.format}>
          {formatsT(`${format?.key ?? "conference"}.cta`)}
        </BriefLink>
      </div>
    </PageShell>
  );
}
