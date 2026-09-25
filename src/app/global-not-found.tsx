import type { Metadata } from "next";
import { getMessages } from "@/content/messages";
import { defaultLocale, locales } from "@/lib/i18n";
import { fontVariables } from "@/styles/fonts";
import "@/styles/tokens.css";
import "./globals.css";
import styles from "./global-not-found.module.css";

/*
 * 404 для адресов вне языков (/de, /что-угодно): здесь нет layout и неизвестен язык,
 * поэтому текст — на языке по умолчанию и ссылки на все три версии.
 */
const t = getMessages(defaultLocale);

export const metadata: Metadata = { title: `${t.notFound.title} — ULY DALA` };

export default function GlobalNotFound() {
  return (
    <html lang={defaultLocale} className={fontVariables}>
      <body>
        <main id="main" data-tone="dark" className={styles.page}>
          <h1 className={styles.title}>{t.notFound.title}</h1>
          <ul className={styles.links}>
            {locales.map((locale) => (
              <li key={locale}>
                <a href={`/${locale}`} hrefLang={locale} lang={locale}>
                  {getMessages(locale).languages[locale]}
                </a>
              </li>
            ))}
          </ul>
        </main>
      </body>
    </html>
  );
}
