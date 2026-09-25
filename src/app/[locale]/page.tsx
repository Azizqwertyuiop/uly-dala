import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { resolveLocale } from "@/lib/intl/locale";

// Пустая главная. Главы появятся на следующих шагах (CLAUDE.md, раздел 2).
export default function HomePage({ params }: PageProps<"/[locale]">) {
  const locale = resolveLocale(use(params).locale);
  setRequestLocale(locale);
  const t = useTranslations("brand");

  return (
    <main id="main">
      <h1>{t("name")}</h1>
    </main>
  );
}
