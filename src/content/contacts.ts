/*
 * Контакты ULY DALA — подтверждены заказчиком 12.11.2026: два телефона (WhatsApp — первый),
 * почта, два Instagram (агентство и фазенда). Это публичные контакты, не секреты.
 *
 * Основной WhatsApp и телефон можно переопределить при сборке через NEXT_PUBLIC_WHATSAPP_PHONE
 * и NEXT_PUBLIC_PHONE (цифры с кодом страны: 77010000000) — например, для проверки на стенде.
 *
 * Ссылки — обычные `https://wa.me/…` и `tel:+…`: их открывают и встроенные браузеры
 * (WhatsApp, Telegram, Instagram) — системным переходом в приложение / набор номера.
 */

function digits(value: string | undefined): string | null {
  const clean = value?.replace(/\D/g, "") ?? "";
  return clean.length >= 10 ? clean : null;
}

const PHONES = ["77006434084", "77771882255"] as const;

export const contacts = {
  whatsapp: digits(process.env.NEXT_PUBLIC_WHATSAPP_PHONE) ?? PHONES[0],
  phone: digits(process.env.NEXT_PUBLIC_PHONE) ?? PHONES[0],
  /** Все номера для показа: основной первым, без повторов. */
  phones: [
    ...new Set([digits(process.env.NEXT_PUBLIC_PHONE) ?? PHONES[0], ...PHONES]),
  ] as readonly string[],
  email: "info@ulydala.events",
  instagram: [
    { key: "agency", handle: "uly_dala_event" },
    { key: "fazenda", handle: "ulydala_kz" },
  ],
} as const;

export function instagramHref(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}

export function mailtoHref(email: string): string {
  return `mailto:${email}`;
}

export function whatsappHref(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

/** Ссылка «позвонить»: международный формат, без пробелов и скобок. */
export function telHref(phone: string): string {
  return `tel:+${phone.replace(/\D/g, "")}`;
}

/** Номер для показа: +7 701 000 00 00 (неразрывные пробелы — раздел 4). */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  const m = /^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(d);
  return m ? `+${m[1]}\u00a0${m[2]}\u00a0${m[3]}\u00a0${m[4]}\u00a0${m[5]}` : `+${d}`;
}
