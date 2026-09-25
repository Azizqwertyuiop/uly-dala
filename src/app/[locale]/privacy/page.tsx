import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell, pageStyles } from "@/components/layout/PageShell";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { resolveLocale } from "@/lib/intl/locale";

const sections = ["operator", "data", "purpose", "storage", "rights"] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "privacyPage" });
  return { title: t("metaTitle") };
}

/* TODO(legal): окончательный текст — юрист заказчика (CLAUDE.md, раздел 14). */
export default async function PrivacyPage({ params }: PageProps<"/[locale]/privacy">) {
  setRequestLocale(resolveLocale((await params).locale));
  const t = await getTranslations("privacyPage");

  return (
    <PageShell>
      <div className={layout.grid}>
        <div className={`${layout.stackLarge} ${layout.narrow}`}>
          <div className={pageStyles.head}>
            <h1 className={type.chapterTitle}>{t("title")}</h1>
            <p className={type.pending}>{t("draftNote")}</p>
          </div>
          {sections.map((section) => (
            <section
              key={section}
              className={pageStyles.section}
              aria-labelledby={`privacy-${section}`}
            >
              <h2 id={`privacy-${section}`} className={type.subTitle}>
                {t(`sections.${section}.title`)}
              </h2>
              <p className={type.body}>{t(`sections.${section}.text`)}</p>
            </section>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
