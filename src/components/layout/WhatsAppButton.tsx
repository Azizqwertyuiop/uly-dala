"use client";

import { useEffect, useState } from "react";
import layout from "@/components/ui/layout.module.css";
import styles from "./WhatsAppButton.module.css";

type Props = {
  href: string;
  label: string;
  /** id главы, после которой появляется кнопка. Без него — видна сразу. */
  showAfter?: string;
};

/*
 * Плавающая кнопка WhatsApp: только на мобильных, после главы 2 (CLAUDE.md, раздел 8).
 * Появление — через IntersectionObserver: кнопка видна, когда глава целиком ушла вверх.
 */
export function WhatsAppButton({ href, label, showAfter }: Props) {
  const [visible, setVisible] = useState(!showAfter);

  useEffect(() => {
    if (!showAfter) return;
    const target = document.getElementById(showAfter);
    if (!target) {
      // На страницах без этой главы кнопка видна сразу.
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [showAfter]);

  return (
    <a
      href={href}
      className={styles.button}
      data-visible={visible}
      target="_blank"
      rel="noopener noreferrer"
      aria-hidden={visible ? undefined : true}
      tabIndex={visible ? undefined : -1}
    >
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"
        />
      </svg>
      <span className={layout.visuallyHidden}>{label}</span>
    </a>
  );
}
