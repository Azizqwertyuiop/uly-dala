"use client";

import { useEffect, useRef, useState } from "react";
import type { Tone } from "@/components/sections/chapters";
import styles from "./SiteHeader.module.css";

/** Хедер прячется только после этой прокрутки, px. */
const HIDE_AFTER = 120;
/** Шум прокрутки (инерция тачпада), px. */
const JITTER = 6;
/** Линия, по которой определяется секция под хедером: середина хедера, px от верха. */
const PROBE_Y = 36;

/*
 * Хедер (CLAUDE.md, раздел 8): скрывается при прокрутке вниз, возвращается при прокрутке вверх —
 * только через transform. Тон (контраст) — по data-tone секции под хедером, через
 * IntersectionObserver. В кадре читается только scrollY — без пересчёта layout.
 * Фокус внутри хедера всегда возвращает его (CSS :focus-within).
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const [tone, setTone] = useState<Tone>("dark");
  const lastY = useRef(0);
  const frame = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        const y = window.scrollY;
        const delta = y - lastY.current;
        if (Math.abs(delta) < JITTER) return;
        setHidden(y > HIDE_AFTER && delta > 0);
        lastY.current = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame.current);
    };
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
    <header className={styles.header} data-tone={tone} data-hidden={hidden}>
      {children}
    </header>
  );
}
