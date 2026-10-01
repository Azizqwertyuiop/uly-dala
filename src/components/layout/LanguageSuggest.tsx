"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import styles from "./LanguageSuggest.module.css";

/*
 * Плашка с предложением языка (CLAUDE.md, раздел 11): корень и страницы не перенаправляют по языку
 * браузера — вместо этого предлагают версию на нём. Текст — на предлагаемом языке (lang).
 * Закрытие запоминается. Фиксирована у края экрана — вёрстку не сдвигает (CLS).
 */

const DISMISS_KEY = "uly-dala:language-suggest";

export type SuggestCopy = { label: string; text: string; action: string; dismiss: string };

export function LanguageSuggest({
  current,
  offers,
}: {
  current: Locale;
  /** Языки, которые можно предлагать (с готовым текстом), и их фразы. */
  offers: Partial<Record<Locale, SuggestCopy>>;
}) {
  const [target, setTarget] = useState<{ locale: Locale; href: string } | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // Хранилище недоступно — плашка просто покажется снова.
    }
    if (dismissed) return;
    const preferred = navigator.languages
      .map((l) => l.slice(0, 2).toLowerCase())
      .find((l) => l in offers || l === current);
    if (!preferred || preferred === current || !(preferred in offers)) return;
    const locale = preferred as Locale;
    const rest = window.location.pathname.replace(/^\/(kk|ru|en)(?=\/|$)/, "") || "";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- язык браузера известен только здесь
    setTarget({ locale, href: `/${locale}${rest === "/" ? "" : rest}${window.location.hash}` });
  }, [current, offers]);

  if (!target) return null;
  const copy = offers[target.locale]!;
  const close = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Не запомнится — не страшно.
    }
    setTarget(null);
  };

  return (
    <aside className={styles.suggest} lang={target.locale} aria-label={copy.label}>
      <p className={styles.text}>{copy.text}</p>
      <a className={styles.action} href={target.href} hrefLang={target.locale} onClick={close}>
        {copy.action}
      </a>
      <button type="button" className={styles.dismiss} onClick={close}>
        {copy.dismiss}
      </button>
    </aside>
  );
}
