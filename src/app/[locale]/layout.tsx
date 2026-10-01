import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BriefModal } from "@/components/brief/BriefModal";
import { getBriefProps } from "@/components/brief/briefProps";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CanvasRoot } from "@/components/layout/CanvasRoot";
import { SoundController } from "@/components/layout/SoundController";
import { MotionBootstrap } from "@/components/layout/MotionBootstrap";
import { SkipLink } from "@/components/layout/SkipLink";
import { UiBootstrap } from "@/components/layout/UiBootstrap";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { contacts, whatsappHref } from "@/content/contacts";
import { resolveLocale } from "@/lib/intl/locale";
import { routing } from "@/lib/intl/routing";
import { REVEAL_HEAD_SCRIPT } from "@/motion/reveal-head";
import { fontVariables } from "@/styles/fonts";
import "lenis/dist/lenis.css";
import "@/styles/tokens.css";
import "../globals.css";

/*
 * Вьюпорт (CLAUDE.md, раздел 13): viewport-fit=cover — страница под «чёлкой» и полосой «Домой»,
 * отступы — через env(safe-area-inset-*). Масштабирование не запрещается (доступность).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1C2230",
};

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
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Атрибут data-reveal ставится до первой отрисовки — отсюда suppressHydrationWarning. */}
        <script dangerouslySetInnerHTML={{ __html: REVEAL_HEAD_SCRIPT }} />
      </head>
      <body>
        {/* Клиенту передаётся только язык (для ссылок), тексты рендерятся на сервере. */}
        <NextIntlClientProvider messages={null}>
          <SkipLink label={t("skipLink")} />
          <CanvasRoot />
          <SoundController />
          <SiteHeader />
          {children}
          <SiteFooter />
          {contacts.whatsapp && (
            <WhatsAppButton href={whatsappHref(contacts.whatsapp)} label={whatsapp("label")} />
          )}
          <BriefModal {...getBriefProps(locale)} />
          <UiBootstrap />
          <MotionBootstrap />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
