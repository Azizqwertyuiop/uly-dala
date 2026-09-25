import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PageShell, pageStyles } from "@/components/layout/PageShell";
import { RenderTestClient } from "@/canvas/RenderTestClient";
import type from "@/components/ui/type.module.css";
import { resolveLocale } from "@/lib/intl/locale";

export const metadata: Metadata = {
  title: "Проверка рендера",
  robots: { index: false, follow: false },
};

/*
 * Служебная страница: видео с альфой без ореолов и градиент без полос (критерии шага 8).
 * Открыть в Safari и Chrome: /ru/render-test. Не индексируется.
 */
export default async function RenderTestPage({ params }: PageProps<"/[locale]/render-test">) {
  setRequestLocale(resolveLocale((await params).locale));
  return (
    <PageShell>
      <div className={pageStyles.head}>
        <h1 className={type.chapterTitle}>Проверка рендера</h1>
        <p className={type.body}>
          Видео с альфой без ореолов и тёмный градиент без полос. Откройте страницу в Safari и
          Chrome.
        </p>
      </div>
      <RenderTestClient />
    </PageShell>
  );
}
