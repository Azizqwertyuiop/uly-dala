"use client";

import { useEffect, useRef, useState } from "react";
import type { Tone } from "@/components/sections/chapters";
import { progress } from "@/motion/progress";
import { ticker } from "@/motion/ticker";
import styles from "./SiteHeader.module.css";

/** Хедер прячется только после этой прокрутки, px. */
const HIDE_AFTER = 120;
/** Линия, по которой определяется секция под хедером: середина хедера, px от верха. */
const PROBE_Y = 36;

/*
 * Хедер (CLAUDE.md, раздел 8): скрывается при прокрутке вниз, возвращается при прокрутке вверх —
 * только через transform. Направление — из progress (ticker, фаза render), атрибут пишется
 * в DOM только при изменении, без ререндера React.
 * Тон (контраст) — по data-tone секции под хедером, через IntersectionObserver.
 * Фокус внутри хедера всегда возвращает его (CSS :focus-within).
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [tone, setTone] = useState<Tone>("dark");
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    let hidden = false;
    return ticker.add("render", () => {
      const next = progress.scrollY > HIDE_AFTER && progress.direction === 1;
      if (next === hidden || !ref.current) return;
      hidden = next;
      ref.current.dataset.hidden = String(hidden);
    });
  }, []);

  useEffect(() => {
    let observer: IntersectionObserver | undefined;
    const visible = new Set<Element>();

    const setup = () => {
      observer?.disconnect();
      visible.clear();
      const bottom = Math.max(0, window.innerHeight - PROBE_Y - 1);
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) visible.add(entry.target);
            else visible.delete(entry.target);
          }
          // Самый вложенный элемент под линией — последний в порядке документа.
          const targets = [...visible].sort((a, b) =>
            a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
          );
          const current = targets.at(-1)?.getAttribute("data-tone");
          if (current === "light" || current === "dark") setTone(current);
        },
        { rootMargin: `-${PROBE_Y}px 0px -${bottom}px 0px` },
      );
      document
        .querySelectorAll("main[data-tone], main [data-tone], footer[data-tone]")
        .forEach((el) => observer?.observe(el));
    };

    setup();
    window.addEventListener("resize", setup);
    return () => {
      window.removeEventListener("resize", setup);
      observer?.disconnect();
    };
  }, []);

  return (
    <header ref={ref} className={styles.header} data-tone={tone} data-hidden="false">
      {children}
    </header>
  );
}
