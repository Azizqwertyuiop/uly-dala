"use client";

import { useBriefStore, type Audience } from "@/store/brief";

/*
 * Формулировка по развилке главы 2 (CLAUDE.md, раздел 2): «Событие для компании» /
 * «Семейное торжество» / «Посмотреть всё». Без JS и до выбора — нейтральный вариант («all»).
 */
export function AudienceText({ labels }: { labels: Record<Audience, string> }) {
  const audience = useBriefStore((s) => s.audience);
  return <>{labels[audience]}</>;
}
