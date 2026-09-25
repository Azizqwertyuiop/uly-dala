import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { resolveLocale } from "@/lib/intl/locale";
import { routing } from "@/lib/intl/routing";
import { fontVariables } from "@/styles/fonts";
import "@/styles/tokens.css";
import "../globals.css";

// Только kk, ru, en; любой другой первый сегмент пути — 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const locale = resolveLocale((await params).locale);
  setRequestLocale(locale);

  return (
    <html lang={locale} className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
