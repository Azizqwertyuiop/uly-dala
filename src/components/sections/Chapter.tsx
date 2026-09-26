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
  /** Дополнительные классы секции и её содержимого (раскладка конкретной главы). */
  className?: string;
  innerClassName?: string;
  /** Метку времени глава ставит сама (внутри закреплённого экрана) — через ChapterTime. */
  hideTime?: boolean;
};

/** Метка «07:00 · Сборка» над заголовком главы. */
export function ChapterTime({ time, name }: { time: string; name: string }) {
  return (
    <p className={`${type.eyebrow} ${styles.time}`}>
      <time>{time}</time> · {name}
    </p>
  );
}

/**
 * Секция-глава: <section aria-labelledby>, data-chapter, data-tone, стабильный id.
 * Заголовок главы — элемент с id `${id}-title` внутри children.
 */
export function Chapter({ id, time, name, children, className, innerClassName, hideTime }: Props) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-chapter={id}
      data-tone={chapterTone[id]}
      className={[styles.chapter, className].filter(Boolean).join(" ")}
    >
      <div className={[layout.container, styles.inner, innerClassName].filter(Boolean).join(" ")}>
        {!hideTime && <ChapterTime time={time} name={name} />}
        {children}
      </div>
    </section>
  );
}

export { styles as chapterStyles };
