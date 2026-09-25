import { contacts, whatsappHref } from "@/content/contacts";
import { getMessages } from "@/content/messages";
import type { Locale } from "@/lib/i18n";

/** Общие props формы брифа — собираются на сервере. */
export function getBriefProps(locale: Locale) {
  return {
    copy: getMessages(locale).brief,
    locale,
    privacyHref: `/${locale}/privacy`,
    whatsappHref: contacts.whatsapp ? whatsappHref(contacts.whatsapp) : null,
  };
}

/** Адрес формы без JS: бриф — в главе 6 главной, мини-формы — на своих страницах. */
export function briefFallbackHref(locale: Locale, source: "brief" | "menu" | "visit") {
  return source === "brief" ? `/${locale}#brief` : `/${locale}/request/${source}`;
}
