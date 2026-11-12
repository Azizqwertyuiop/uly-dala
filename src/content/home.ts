/*
 * Данные главной-визитки (решение заказчика 12.11.2026).
 * TODO(client-data): цифры — только подтверждённые заказчиком (CLAUDE.md, разделы 3, 15).
 * Пока значение null — пункт не показывается; пока все null — блок «в цифрах» скрыт.
 */
export const stats: { years: number | null; events: number | null; guests: number | null } = {
  years: null,
  events: null,
  guests: null,
};

/**
 * Instagram: NEXT_PUBLIC_INSTAGRAM — имя аккаунта (uly.dala) или ссылка. Пусто — ссылки нет.
 * TODO(client-data): аккаунт заказчика.
 */
export function instagramHref(value = process.env.NEXT_PUBLIC_INSTAGRAM): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^https:\/\/(www\.)?instagram\.com\//.test(v)) return v;
  const handle = v.replace(/^@/, "");
  return /^[\w.]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}/` : null;
}
