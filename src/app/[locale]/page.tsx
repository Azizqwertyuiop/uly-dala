import { getTranslations, setRequestLocale } from "next-intl/server";
import { HorizonNav } from "@/components/layout/HorizonNav";
import { chapterIds } from "@/components/sections/chapters";
import { AssemblySection } from "@/components/sections/AssemblySection";
import { DawnSection } from "@/components/sections/DawnSection";
import { DaySection } from "@/components/sections/DaySection";
import { FireSection } from "@/components/sections/FireSection";
import { ReturnSection } from "@/components/sections/ReturnSection";
import { WorldSection } from "@/components/sections/WorldSection";
import { resolveLocale } from "@/lib/intl/locale";
import { JsonLd } from "@/components/seo/JsonLd";
import { localBusinessLd, organizationLd, placeLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import type { Metadata } from "next";

/*
 * Главная: один день события, шесть глав (CLAUDE.md, раздел 2).
 * Это семантический базовый слой и одновременно режим «Коротко»: всё читается без JS и WebGL.
 */
export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "meta" });
  const hero = await getTranslations({ locale, namespace: "hero" });
  return pageMetadata({
    locale,
    path: "",
    title: t("title"),
    description: t("description"),
    image: "dawn",
    imageAlt: hero("sceneAlt"),
  });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const meta = await getTranslations("meta");
  const hero = await getTranslations("hero");
  const fazendaPage = await getTranslations("fazendaPage");
  const horizon = await getTranslations("horizon");
  const chapters = await getTranslations("chapters");

  return (
    <main id="main" tabIndex={-1}>
      <JsonLd
        data={[
          organizationLd({ locale, description: meta("description"), slogan: hero("title") }),
          localBusinessLd({ locale, description: meta("description") }),
          placeLd({
            locale,
            name: fazendaPage("metaTitle"),
            description: fazendaPage("metaDescription"),
          }),
        ]}
      />
      <HorizonNav
        label={horizon("label")}
        chapters={chapterIds.map((id) => ({ id, name: chapters(id) }))}
      />
      <DawnSection />
      <AssemblySection />
      <DaySection />
      <FireSection />
      <WorldSection />
      <ReturnSection />
    </main>
  );
}
