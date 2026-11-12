"use client";

import { useEffect, useState } from "react";
import { hasChapters } from "@/motion/progress";
import layout from "@/components/ui/layout.module.css";
import styles from "./WhatsAppButton.module.css";

type Props = {
  href: string;
  label: string;
};

/*
 * Плавающая кнопка WhatsApp: только на мобильных (CLAUDE.md, раздел 8); на главной —
 * после первого экрана, на остальных страницах — сразу.
 */
export function WhatsAppButton({ href, label }: Props) {
  const [visible, setVisible] = useState(false);

  // На главной — после первого экрана (там свои кнопки); на остальных страницах — сразу.
  useEffect(() => {
    const update = () => setVisible(!hasChapters() || window.scrollY > window.innerHeight * 0.8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <a
      href={href}
      className={styles.button}
      data-visible={visible}
      data-place="float"
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
