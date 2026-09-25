"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Locale } from "@/lib/i18n";
import { Link } from "@/lib/intl/navigation";
import { useHydrated } from "@/lib/useHydrated";
import { useUiStore } from "@/store/ui";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Wordmark } from "./Wordmark";
import styles from "./SiteMenu.module.css";
import header from "./SiteHeader.module.css";

export type SiteMenuProps = {
  locale: Locale;
  labels: {
    open: string;
    close: string;
    title: string;
    chapters: string;
    pages: string;
    settings: string;
    sound: string;
    soundHint: string;
    briefMode: string;
    briefModeHint: string;
    on: string;
    off: string;
    contacts: string;
    city: string;
    contactsPending: string;
    languages: string;
    home: string;
  };
  chapters: { id: string; name: string }[];
  pages: { href: string; label: string }[];
  languageNames: Record<Locale, string>;
};

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/*
 * Полноэкранное меню (CLAUDE.md, раздел 8). Нативный <dialog> + showModal():
 * роль dialog, остальная страница inert, Esc закрывает. Поверх — явная ловушка Tab
 * и возврат фокуса на кнопку «Меню». Без JS «Меню» — ссылка на навигацию в футере.
 */
export function SiteMenu({ locale, labels, chapters, pages, languageNames }: SiteMenuProps) {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(true);

  const uiMode = useUiStore((s) => s.uiMode);
  const toggleUiMode = useUiStore((s) => s.toggleUiMode);
  const soundEnabled = useUiStore((s) => s.soundEnabled);
  const setSound = useUiStore((s) => s.setSound);

  const show = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    returnFocus.current = true;
    dialog.showModal();
    document.documentElement.dataset.menuOpen = "true";
    setOpen(true);
    closeRef.current?.focus();
  };

  const hide = useCallback((restoreFocus: boolean) => {
    returnFocus.current = restoreFocus;
    dialogRef.current?.close();
  }, []);

  // Событие close приходит и от Esc, и от dialog.close().
  const onClose = () => {
    delete document.documentElement.dataset.menuOpen;
    setOpen(false);
    if (returnFocus.current) triggerRef.current?.focus();
  };

  // Уход со страницы с открытым меню не должен оставить блокировку прокрутки.
  useEffect(() => () => void delete document.documentElement.dataset.menuOpen, []);

  const trapFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // Переход по ссылке закрывает меню; фокус уходит туда, куда ведёт ссылка.
  const onLinkClick = () => hide(false);

  if (!hydrated) {
    return (
      <a href="#site-nav" className={`${type.link} ${styles.trigger}`}>
        {labels.open}
      </a>
    );
  }

  const state = (value: boolean) => (
    <span className={styles.toggleState} aria-hidden="true">
      {value ? labels.on : labels.off}
    </span>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${type.link} ${styles.trigger}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={show}
      >
        {labels.open}
      </button>

      <dialog
        ref={dialogRef}
        id="site-menu"
        className={styles.dialog}
        aria-labelledby="site-menu-title"
        data-tone="dark"
        onKeyDown={trapFocus}
        onClose={onClose}
      >
        <div className={`${layout.container} ${styles.inner}`}>
          <div className={styles.top}>
            <Link href="/" aria-label={labels.home} onClick={onLinkClick} className={header.home}>
              <Wordmark className={header.wordmark} />
            </Link>
            <button
              ref={closeRef}
              type="button"
              className={`${type.link} ${styles.close}`}
              onClick={() => hide(true)}
            >
              {labels.close}
            </button>
          </div>

          <h2 id="site-menu-title" className={layout.visuallyHidden}>
            {labels.title}
          </h2>

          <div className={styles.columns}>
            <nav className={styles.group} aria-labelledby="menu-chapters">
              <h3 id="menu-chapters" className={type.eyebrow}>
                {labels.chapters}
              </h3>
              <ol className={styles.chapterLinks}>
                {chapters.map((chapter) => (
                  <li key={chapter.id}>
                    <Link href={`/#${chapter.id}`} className={type.link} onClick={onLinkClick}>
                      {chapter.name}
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>

            <nav className={styles.group} aria-labelledby="menu-pages">
              <h3 id="menu-pages" className={type.eyebrow}>
                {labels.pages}
              </h3>
              <ul className={styles.links}>
                {pages.map((page) => (
                  <li key={page.href}>
                    <Link href={page.href} className={type.link} onClick={onLinkClick}>
                      {page.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className={styles.group}>
              <h3 className={type.eyebrow}>{labels.languages}</h3>
              <LanguageSwitcher
                current={locale}
                label={labels.languages}
                names={languageNames}
                className={styles.languages}
              />

              <h3 className={type.eyebrow}>{labels.settings}</h3>
              <div>
                {/* TODO(sound): звуки фазенды — шаг 14; пока только состояние. */}
                <button
                  type="button"
                  className={styles.toggle}
                  aria-pressed={soundEnabled}
                  aria-describedby="menu-sound-hint"
                  onClick={() => setSound(!soundEnabled)}
                >
                  <span>{labels.sound}</span>
                  {state(soundEnabled)}
                  <span id="menu-sound-hint" className={`${type.caption} ${styles.toggleHint}`}>
                    {labels.soundHint}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.toggle}
                  aria-pressed={uiMode === "brief"}
                  aria-describedby="menu-brief-hint"
                  onClick={toggleUiMode}
                >
                  <span>{labels.briefMode}</span>
                  {state(uiMode === "brief")}
                  <span id="menu-brief-hint" className={`${type.caption} ${styles.toggleHint}`}>
                    {labels.briefModeHint}
                  </span>
                </button>
              </div>
            </div>

            <div className={styles.group}>
              <h3 className={type.eyebrow}>{labels.contacts}</h3>
              <p>{labels.city}</p>
              <p className={type.caption}>{labels.contactsPending}</p>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
