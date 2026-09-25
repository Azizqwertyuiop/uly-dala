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

/*
 * Главная: один день события, шесть глав (CLAUDE.md, раздел 2).
 * Это семантический базовый слой и одновременно режим «Коротко»: всё читается без JS и WebGL.
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  setRequestLocale(resolveLocale((await params).locale));
  const horizon = await getTranslations("horizon");
  const chapters = await getTranslations("chapters");

  return (
    <main id="main" tabIndex={-1}>
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
