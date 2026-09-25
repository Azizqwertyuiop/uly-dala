import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { BriefForm } from "@/components/brief/BriefForm";
import { getBriefProps } from "@/components/brief/briefProps";
import { PageShell, pageStyles } from "@/components/layout/PageShell";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { resolveLocale } from "@/lib/intl/locale";

const kinds = ["menu", "visit"] as const;
type Kind = (typeof kinds)[number];

export const dynamicParams = false;

export function generateStaticParams() {
  return kinds.map((kind) => ({ kind }));
}

async function load(params: PageProps<"/[locale]/request/[kind]">["params"]) {
  const { locale: raw, kind } = await params;
  if (!(kinds as readonly string[]).includes(kind)) notFound();
  const locale = resolveLocale(raw);
  return { locale, kind: kind as Kind, brief: getBriefProps(locale) };
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/request/[kind]">): Promise<Metadata> {
  const { kind, brief } = await load(params);
  return {
    title: `${brief.copy.variants[kind].title} — ULY DALA`,
    robots: { index: false, follow: true },
  };
}

/*
 * Мини-формы «Запросить меню» и «Приехать на просмотр» отдельной страницей —
 * адрес для CTA без JS. С JS эти же формы открываются в модальном окне.
 */
export default async function RequestPage({ params }: PageProps<"/[locale]/request/[kind]">) {
  const { locale, kind, brief } = await load(params);
  setRequestLocale(locale);
  const variant = brief.copy.variants[kind];

  return (
    <PageShell>
      <div className={layout.grid}>
        <div className={`${pageStyles.head} ${layout.narrow}`}>
          <h1 className={type.chapterTitle} data-reveal="">
            {variant.title}
          </h1>
          <p className={type.lead} data-reveal="">
            {variant.lead}
          </p>
          <BriefForm variant={kind} {...brief} />
        </div>
      </div>
    </PageShell>
  );
}
