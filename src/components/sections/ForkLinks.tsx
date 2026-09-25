"use client";

import { useBriefStore, type Audience } from "@/store/brief";
import type from "@/components/ui/type.module.css";
import styles from "./sections.module.css";

type Props = { labels: Record<Audience, string> };

/*
 * Развилка главы 2: «Событие для компании» / «Семейное торжество» / «Посмотреть всё».
 * Меняет порядок форматов в главе 3. Без JS — просто ссылки к форматам.
 */
export function ForkLinks({ labels }: Props) {
  const setAudience = useBriefStore((s) => s.setAudience);
  const audiences: Audience[] = ["corporate", "family", "all"];
  return (
    <ul className={styles.forkList}>
      {audiences.map((audience) => (
        <li key={audience}>
          <a href="#day" className={type.link} onClick={() => setAudience(audience)}>
            {labels[audience]}
          </a>
        </li>
      ))}
    </ul>
  );
}
