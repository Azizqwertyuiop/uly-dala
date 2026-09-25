import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell, pageStyles } from "@/components/layout/PageShell";
import { zones } from "@/components/sections/WorldSection";
import { BriefLink } from "@/components/brief/BriefLink";
import { briefFallbackHref } from "@/components/brief/briefProps";
import { SceneImage } from "@/components/ui/SceneImage";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { resolveLocale } from "@/lib/intl/locale";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/fazenda">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "fazendaPage" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

/*
 * Фазенда. TODO(client-data): реальные зоны, вместимость, адрес и время в пути, фото и облёт.
 */
export default async function FazendaPage({ params }: PageProps<"/[locale]/fazenda">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations("fazendaPage");
  const world = await getTranslations("world");

  return (
    <PageShell tone="dark">
      <div className={layout.grid}>
        <div className={`${pageStyles.head} ${layout.main}`}>
          <h1 className={type.chapterTitle} data-reveal="">
            {t("title")}
          </h1>
          <p className={type.lead} data-reveal="">
            {t("lead")}
          </p>
          <p className={type.body}>{world("location")}</p>
        </div>
      </div>

      <SceneImage
        src="/assets/placeholders/fazenda.svg"
        alt={world("sceneAlt")}
        width={1600}
        height={900}
        priority
        sizes="100vw"
      />

      <section className={pageStyles.section} aria-labelledby="zones-title">
        <h2 id="zones-title" className={type.subTitle}>
          {world("zonesLabel")}
        </h2>
        <ul className={layout.cards} style={{ "--cards": 4 } as React.CSSProperties}>
          {zones.map((zone) => (
            <li key={zone} className={layout.card}>
              <h3 className={type.subTitle}>{world(`zones.${zone}.name`)}</h3>
              <p className={type.body}>{world(`zones.${zone}.text`)}</p>
              <p className={type.caption}>{world("capacityPending")}</p>
            </li>
          ))}
        </ul>
      </section>

      <div>
        <BriefLink href={briefFallbackHref(locale, "visit")} source="visit">
          {world("cta")}
        </BriefLink>
      </div>
    </PageShell>
  );
}
