/*
 * Контакты ULY DALA. TODO(client-data): подтверждённые телефон, WhatsApp, Telegram, email
 * (CLAUDE.md, раздел 17). Пока значения не заданы, соответствующие кнопки не показываются.
 *
 * WhatsApp и телефон можно задать при сборке через NEXT_PUBLIC_WHATSAPP_PHONE и NEXT_PUBLIC_PHONE
 * (цифры с кодом страны: 77010000000) — например, для проверки на стенде.
 *
 * Ссылки — обычные `https://wa.me/…` и `tel:+…`: их открывают и встроенные браузеры
 * (WhatsApp, Telegram, Instagram) — системным переходом в приложение / набор номера.
 */

function digits(value: string | undefined): string | null {
  const clean = value?.replace(/\D/g, "") ?? "";
  return clean.length >= 10 ? clean : null;
}

export const contacts = {
  whatsapp: digits(process.env.NEXT_PUBLIC_WHATSAPP_PHONE),
  phone: digits(process.env.NEXT_PUBLIC_PHONE),
} as const;

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
