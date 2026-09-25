import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell, pageStyles } from "@/components/layout/PageShell";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SceneImage } from "@/components/ui/SceneImage";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { findFormat, formatImage, formats } from "@/content/formats";
import { Link } from "@/lib/intl/navigation";
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
  return { title: `${t(`${format.key}.title`)} — ULY DALA`, description: t(`${format.key}.lead`) };
}

/** Страница формата: /[locale]/services/[slug]. */
export default async function ServicePage({ params }: PageProps<"/[locale]/services/[slug]">) {
  const { locale, format } = await load(params);
  setRequestLocale(locale);
  const t = await getTranslations("formats");
  const page = await getTranslations("servicePage");
  const { key, slug } = format;

  return (
    <PageShell>
      <div className={layout.grid}>
        <div className={`${pageStyles.head} ${layout.main}`}>
          <h1 className={type.chapterTitle}>{t(`${key}.title`)}</h1>
          <p className={type.lead}>{t(`${key}.phrase`)}</p>
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
          {/* TODO(brief): предзаполнение брифа форматом — шаг 5. */}
          <ButtonLink href="/#brief">{t(`${key}.cta`)}</ButtonLink>
        </div>
      </section>

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
