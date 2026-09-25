import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { chapterTone, type ChapterId } from "./chapters";
import styles from "./Chapter.module.css";

type Props = {
  id: ChapterId;
  /** «05:30 · Рассвет» над заголовком. */
  time: string;
  name: string;
  children: React.ReactNode;
};

/**
 * Секция-глава: <section aria-labelledby>, data-chapter, data-tone, стабильный id.
 * Заголовок главы — элемент с id `${id}-title` внутри children.
 */
export function Chapter({ id, time, name, children }: Props) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-chapter={id}
      data-tone={chapterTone[id]}
      className={styles.chapter}
    >
      <div className={`${layout.container} ${styles.inner}`}>
        <p className={`${type.eyebrow} ${styles.time}`}>
          <time>{time}</time> · {name}
        </p>
        {children}
      </div>
    </section>
  );
}

export { styles as chapterStyles };
