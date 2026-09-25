import type { StoredLead } from "./types";

/** Текст заявки для менеджеров (Telegram, email). Коды значений — без перевода: это служебный текст. */
export function formatLeadForManagers(lead: StoredLead): string {
  const when =
    lead.dateMode === "date"
      ? lead.date
      : lead.dateMode === "month"
        ? `месяц ${lead.month}`
        : lead.dateMode === "unknown"
          ? "пока не знают"
          : "—";
  const lines = [
    `Новая заявка (${lead.source}) · ${lead.locale}`,
    `Имя: ${lead.name}`,
    `Телефон: ${lead.phone}`,
    `Связь: ${lead.channel ?? "—"}${lead.email ? ` · ${lead.email}` : ""}`,
    `Событие: ${lead.eventType ?? "—"}`,
    `Когда: ${when}`,
    `Гости: ${lead.guests ?? "—"}`,
    `Площадка: ${lead.venue ?? "—"}`,
  ];
  if (lead.comment) lines.push(`Комментарий: ${lead.comment}`);
  lines.push(`ID: ${lead.id}`);
  return lines.join("\n");
}
