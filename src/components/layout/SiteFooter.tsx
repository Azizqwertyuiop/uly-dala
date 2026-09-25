import { getLocale, getTranslations } from "next-intl/server";
import { chapterIds } from "@/components/sections/chapters";
import { formats } from "@/content/formats";
import type { Locale } from "@/lib/i18n";
import { Link } from "@/lib/intl/navigation";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { LanguageSwitcher } from "./LanguageSwitcher";
import styles from "./SiteFooter.module.css";

/*
 * Футер: навигация (цель ссылки «Меню» без JS), языки, контакты.
 * TODO(client-data): телефон, WhatsApp, Telegram, email — CLAUDE.md, раздел 17.
 */
export async function SiteFooter() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("footer");
  const chapters = await getTranslations("chapters");
  const formatsT = await getTranslations("formats");
  const world = await getTranslations("world");
  const languages = await getTranslations("languages");

  return (
    <footer className={styles.footer} data-tone="dark" id="contacts">
      <div className={layout.container}>
        <div id="site-nav" className={styles.columns}>
          <nav className={styles.column} aria-labelledby="footer-chapters">
            <h2 id="footer-chapters" className={type.eyebrow}>
              {t("chapters")}
            </h2>
            <ul className={styles.links}>
              {chapterIds.map((id) => (
                <li key={id}>
                  <Link href={`/#${id}`} className={type.link}>
                    {chapters(id)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav className={styles.column} aria-labelledby="footer-pages">
            <h2 id="footer-pages" className={type.eyebrow}>
              {t("pages")}
            </h2>
            <ul className={styles.links}>
              {formats.map((format) => (
                <li key={format.slug}>
                  <Link href={`/services/${format.slug}`} className={type.link}>
                    {formatsT(`${format.key}.title`)}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/fazenda" className={type.link}>
                  {world("fazendaLink")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={type.link}>
                  {t("privacy")}
                </Link>
              </li>
            </ul>
          </nav>
          <div className={styles.column}>
            <h2 className={type.eyebrow}>{languages("label")}</h2>
            <LanguageSwitcher
              current={locale}
              label={languages("label")}
              names={{ kk: languages("kk"), ru: languages("ru"), en: languages("en") }}
              className={styles.languages}
            />
          </div>
          <div className={styles.column}>
            <h2 className={type.eyebrow}>{t("contacts")}</h2>
            <p>{t("city")}</p>
            <p className={type.caption}>{t("contactsPending")}</p>
          </div>
        </div>
        <p className={`${type.caption} ${styles.bottom}`}>© {t("rights")}</p>
      </div>
    </footer>
  );
}
