import { getTranslations, setRequestLocale } from "next-intl/server";
import { AssemblySection } from "@/components/sections/AssemblySection";
import {
  Clients,
  Contact,
  Fazenda,
  Gallery,
  Services,
  Steps,
  Team,
  Why,
} from "@/components/home/HomeSections";
import { resolveLocale } from "@/lib/intl/locale";
import { JsonLd } from "@/components/seo/JsonLd";
import { localBusinessLd, organizationLd, placeLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import type { Metadata } from "next";

/*
 * Главная-визитка (решение заказчика 12.11.2026, CLAUDE.md, раздел 2):
 * первый экран — сборка юрты на скролле (3D), дальше — простые продающие блоки.
 * Всё читается без JS и WebGL; блоки без подтверждённых данных скрыты.
 */
export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "meta" });
  const assembly = await getTranslations({ locale, namespace: "assembly" });
  return pageMetadata({
    locale,
    path: "",
    title: t("title"),
    description: t("description"),
    image: "assembly",
    imageAlt: assembly("sceneAlt"),
  });
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);
  const meta = await getTranslations("meta");
  const home = await getTranslations("home.hero");
  const fazendaPage = await getTranslations("fazendaPage");

  return (
    <main id="main" tabIndex={-1}>
      <JsonLd
        data={[
          organizationLd({ locale, description: meta("description"), slogan: home("title") }),
          localBusinessLd({ locale, description: meta("description") }),
          placeLd({
            locale,
            name: fazendaPage("metaTitle"),
            description: fazendaPage("metaDescription"),
          }),
        ]}
      />
      {/*
       * Точка отсчёта 3D: глава «Рассвет» нулевой высоты. Её сцена — мир (небо, степь, трава),
       * в котором стоит юрта; камера и прогресс считают главы по порядку сюжета (src/motion/progress.ts).
       */}
      <section data-chapter="dawn" aria-hidden="true" style={{ height: 0, overflow: "hidden" }} />
      <AssemblySection />
      <Services />
      <Gallery />
      <Clients />
      <Why />
      <Steps />
      <Fazenda />
      <Team />
      <Contact />
    </main>
  );
}
