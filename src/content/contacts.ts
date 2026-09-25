/*
 * Контакты ULY DALA. TODO(client-data): подтверждённые телефон, WhatsApp, Telegram, email
 * (CLAUDE.md, раздел 17). Пока значения не заданы, соответствующие кнопки не показываются.
 *
 * WhatsApp можно задать при сборке через NEXT_PUBLIC_WHATSAPP_PHONE (только цифры, с кодом
 * страны: 77010000000) — например, для проверки на стенде.
 */

function digits(value: string | undefined): string | null {
  const clean = value?.replace(/\D/g, "") ?? "";
  return clean.length >= 10 ? clean : null;
}

export const contacts = {
  whatsapp: digits(process.env.NEXT_PUBLIC_WHATSAPP_PHONE),
} as const;

export function whatsappHref(phone: string): string {
  return `https://wa.me/${phone}`;
}
