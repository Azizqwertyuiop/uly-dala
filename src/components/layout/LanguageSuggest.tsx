"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { SUGGEST_DISMISS_KEY } from "./languageSuggestScript";
import styles from "./LanguageSuggest.module.css";

/*
 * Плашка с предложением языка (CLAUDE.md, раздел 11): страницы не перенаправляют по языку
 * браузера — предлагают версию на нём. Текст — на предлагаемом языке (lang).
 * Стоит в потоке над хедером — ничего не перекрывает (CTA, фокус). Показывать или нет, решает
 * скрипт в <head> до первой отрисовки (html[data-suggest]) — вёрстка не сдвигается (CLS).
 * Закрытие запоминается.
 */

export type SuggestCopy = { label: string; text: string; action: string; dismiss: string };

export function LanguageSuggest({
  offers,
}: {
  /** Языки, которые можно предлагать (с готовым текстом), и их фразы. */
  offers: Partial<Record<Locale, SuggestCopy>>;
}) {
  const [rest, setRest] = useState("");

  // Ссылка — на эту же страницу в другом языке (путь известен только в браузере).
  useEffect(() => {
    const path = window.location.pathname.replace(/^\/(kk|ru|en)(?=\/|$)/, "");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- путь страницы есть только здесь
    setRest(`${path === "/" ? "" : path}${window.location.hash}`);
  }, []);

  const close = () => {
    try {
      window.localStorage.setItem(SUGGEST_DISMISS_KEY, "1");
    } catch {
      // Не запомнится — не страшно.
    }
    delete document.documentElement.dataset.suggest;
  };

  return (
    <>
      {(Object.entries(offers) as [Locale, SuggestCopy][]).map(([locale, copy]) => (
        <aside
          key={locale}
          className={styles.suggest}
          data-for={locale}
          lang={locale}
          aria-label={copy.label}
        >
          <p className={styles.text}>{copy.text}</p>
          <a className={styles.action} href={`/${locale}${rest}`} hrefLang={locale} onClick={close}>
            {copy.action}
          </a>
          <button type="button" className={styles.dismiss} onClick={close}>
            {copy.dismiss}
          </button>
        </aside>
      ))}
    </>
  );
}
