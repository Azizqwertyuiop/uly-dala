import { setRequestLocale } from "next-intl/server";
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

  return (
    <main id="main" tabIndex={-1}>
      <DawnSection />
      <AssemblySection />
      <DaySection />
      <FireSection />
      <WorldSection />
      <ReturnSection />
    </main>
  );
}
