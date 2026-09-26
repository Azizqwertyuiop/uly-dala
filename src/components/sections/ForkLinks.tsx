"use client";

import { useEffect } from "react";
import { useBriefStore, type Audience } from "@/store/brief";
import type from "@/components/ui/type.module.css";
import styles from "./sections.module.css";

type Props = { labels: Record<Audience, string> };

/*
 * Развилка главы 2: «Событие для компании» / «Семейное торжество» / «Посмотреть всё».
 * Меняет порядок форматов в главе 3, формулировки CTA и предзаполнение брифа (стор брифа).
 * Без JS — просто ссылки к форматам; якорь #day работает всегда.
 */
export function ForkLinks({ labels }: Props) {
  const setAudience = useBriefStore((s) => s.setAudience);
  const audience = useBriefStore((s) => s.audience);
  const audiences: Audience[] = ["corporate", "family", "all"];

  // Выбор, сделанный до перезагрузки, восстанавливается сразу (стор ленивый).
  useEffect(() => useBriefStore.getState().hydrate(), []);

  return (
    <ul className={styles.forkList}>
      {audiences.map((a) => (
        <li key={a}>
          <a
            href="#day"
            className={type.link}
            aria-current={a === audience && a !== "all" ? "true" : undefined}
            onClick={() => setAudience(a)}
          >
            {labels[a]}
          </a>
        </li>
      ))}
    </ul>
  );
}
