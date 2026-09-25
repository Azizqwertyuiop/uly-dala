"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./HorizonNav.module.css";

type Props = {
  label: string;
  chapters: { id: string; name: string }[];
};

/** Сколько меток прогресса внутри каждой главы. */
const STEPS = 10;

/*
 * Навигация-горизонт — единственный индикатор прогресса (CLAUDE.md, раздел 8).
 * Это <nav> со списком ссылок на главы: работает без JS и с клавиатуры;
 * клик по следующей отметке = «пропустить сцену».
 *
 * Прогресс без пересчёта layout в кадре: в каждую главу добавляются невидимые метки
 * (0%, 10%, … 90% высоты). IntersectionObserver с областью «всё выше середины экрана»
 * (верхнее поле огромное, нижнее −50%) сообщает, какие метки уже прошли середину —
 * даже при прыжке по якорю. Прогресс = последняя прошедшая метка.
 * Солнце двигается только transform; позиция пишется напрямую в style, без ререндера.
 */
export function HorizonNav({ label, chapters }: Props) {
  const [current, setCurrent] = useState(0);
  const sunRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const last = Math.max(1, chapters.length - 1);
    const sentinels: HTMLElement[] = [];
    const passed = new Array<boolean>(chapters.length * STEPS).fill(false);
    let atEnd = false;

    const update = () => {
      // Конец страницы: последняя глава может быть короче экрана и не дойти до середины.
      const order = atEnd ? (chapters.length - 1) * STEPS : passed.lastIndexOf(true);
      if (order < 0) return;
      const ratio = Math.min(1, order / STEPS / last);
      if (sunRef.current) sunRef.current.style.transform = `translateX(${ratio * 100}%)`;
      setCurrent(Math.floor(order / STEPS));
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          passed[Number((entry.target as HTMLElement).dataset.order)] = entry.isIntersecting;
        }
        update();
      },
      { rootMargin: "1000000px 0px -50% 0px" },
    );

    const end = document.createElement("span");
    end.className = styles.sentinel ?? "";
    end.setAttribute("aria-hidden", "true");
    end.style.position = "static";
    end.style.display = "block";
    document.body.appendChild(end);
    const endObserver = new IntersectionObserver(([entry]) => {
      atEnd = Boolean(entry?.isIntersecting);
      update();
    });
    endObserver.observe(end);

    chapters.forEach(({ id }, index) => {
      const section = document.getElementById(id);
      if (!section) return;
      for (let step = 0; step < STEPS; step++) {
        const sentinel = document.createElement("span");
        sentinel.className = styles.sentinel ?? "";
        sentinel.setAttribute("aria-hidden", "true");
        sentinel.dataset.order = String(index * STEPS + step);
        sentinel.style.top = `${(step / STEPS) * 100}%`;
        section.appendChild(sentinel);
        sentinels.push(sentinel);
        observer.observe(sentinel);
      }
    });

    return () => {
      observer.disconnect();
      endObserver.disconnect();
      end.remove();
      sentinels.forEach((s) => s.remove());
    };
  }, [chapters]);

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
