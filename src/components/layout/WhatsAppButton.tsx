"use client";

import { useEffect, useState } from "react";
import { hasChapters, onChapterChange } from "@/motion/progress";
import layout from "@/components/ui/layout.module.css";
import styles from "./WhatsAppButton.module.css";

type Props = {
  href: string;
  label: string;
  /** Номер главы (с 0), начиная с которой кнопка видна. По умолчанию — после главы 2. */
  fromChapter?: number;
};

/*
 * Плавающая кнопка WhatsApp: только на мобильных, после главы 2 (CLAUDE.md, раздел 8).
 * Видимость — от текущей главы из progress. На страницах без глав — видна сразу.
 */
export function WhatsAppButton({ href, label, fromChapter = 2 }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(
    () =>
      onChapterChange((index) => {
        setVisible(!hasChapters() || index >= fromChapter);
      }),
    [fromChapter],
  );

  return (
    <a
      href={href}
      className={styles.button}
      data-visible={visible}
      // Без target: во встроенных браузерах (Instagram, Telegram) переход wa.me открывает
      // приложение WhatsApp, а не новое окно внутри встроенного браузера.
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
