"use client";

import { useEffect, useRef, useState } from "react";
import { onChapterChange, progress } from "@/motion/progress";
import { Spring } from "@/motion/spring";
import { chapterTempo } from "@/motion/tokens";
import { ticker } from "@/motion/ticker";
import styles from "./HorizonNav.module.css";

type Props = {
  label: string;
  chapters: { id: string; name: string }[];
};

/*
 * Навигация-горизонт — единственный индикатор прогресса (CLAUDE.md, раздел 8).
 * Это <nav> со списком ссылок на главы: работает без JS и с клавиатуры;
 * клик по следующей отметке = «пропустить сцену».
 *
 * Солнце — от progress.horizon через критически демпфированную пружину (фаза damping),
 * позиция пишется в style.transform в фазе render, только если изменилась. Без ререндера React.
 * В reduced motion пружины нет — солнце сразу на месте.
 */
export function HorizonNav({ label, chapters }: Props) {
  const [current, setCurrent] = useState(0);
  const sunRef = useRef<HTMLSpanElement>(null);

  useEffect(() => onChapterChange((index) => setCurrent(index)), []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const spring = new Spring(progress.horizon, chapterTempo.assembly.cameraSmoothing);
    let written = -1;

    const offDamping = ticker.add("damping", (dt) => {
      spring.target = progress.horizon;
      if (reduced.matches) spring.snap();
      else spring.update(dt);
    });
    const offRender = ticker.add("render", () => {
      const percent = Math.round(spring.value * 10000) / 100;
      if (percent === written || !sunRef.current) return;
      written = percent;
      sunRef.current.style.transform = `translateX(${percent}%)`;
    });
    return () => {
      offDamping();
      offRender();
    };
  }, []);

  return (
    <nav aria-label={label} className={styles.nav} data-horizon="">
      <div className={styles.track}>
        <span className={styles.line} aria-hidden="true" />
        <span ref={sunRef} className={styles.sunPath} aria-hidden="true">
          <span className={styles.sun} />
        </span>
        <ol className={styles.marks}>
          {chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <a
                href={`#${chapter.id}`}
                className={styles.mark}
                aria-current={index === current ? "step" : undefined}
              >
                <span className={styles.label}>{chapter.name}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
