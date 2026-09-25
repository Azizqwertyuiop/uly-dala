import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SkipLink } from "@/components/layout/SkipLink";
import { UiBootstrap } from "@/components/layout/UiBootstrap";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { contacts, whatsappHref } from "@/content/contacts";
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
  const t = await getTranslations({ locale, namespace: "common" });
  const whatsapp = await getTranslations({ locale, namespace: "whatsapp" });

  return (
    <html lang={locale} className={fontVariables}>
      <body>
        {/* Клиенту передаётся только язык (для ссылок), тексты рендерятся на сервере. */}
        <NextIntlClientProvider messages={null}>
          <SkipLink label={t("skipLink")} />
          <SiteHeader />
          {children}
          <SiteFooter />
          {contacts.whatsapp && (
            <WhatsAppButton
              href={whatsappHref(contacts.whatsapp)}
              label={whatsapp("label")}
              showAfter="assembly"
            />
          )}
          <UiBootstrap />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
