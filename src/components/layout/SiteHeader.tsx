import { getLocale, getTranslations } from "next-intl/server";
import { chapterIds } from "@/components/sections/chapters";
import { formats } from "@/content/formats";
import type { Locale } from "@/lib/i18n";
import { Link } from "@/lib/intl/navigation";
import layout from "@/components/ui/layout.module.css";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { HeaderShell } from "./HeaderShell";
import { SiteMenu } from "./SiteMenu";
import { Wordmark } from "./Wordmark";
import styles from "./SiteHeader.module.css";

/*
 * Хедер: постоянно только вордмарк, «Меню», «Обсудить событие» (CLAUDE.md, раздел 8).
 * Строки собираются на сервере и передаются клиентским компонентам готовыми.
 */
export async function SiteHeader() {
  const locale = (await getLocale()) as Locale;
  const [common, brand, menu, footer, chapters, formatsT, world, languages] = await Promise.all([
    getTranslations("common"),
    getTranslations("brand"),
    getTranslations("menu"),
    getTranslations("footer"),
    getTranslations("chapters"),
    getTranslations("formats"),
    getTranslations("world"),
    getTranslations("languages"),
  ]);

  return (
    <HeaderShell>
      <div className={`${layout.container} ${styles.bar}`}>
        <Link href="/" className={styles.home} aria-label={brand("home")}>
          <Wordmark className={styles.wordmark} />
        </Link>
        <div className={styles.actions}>
          <SiteMenu
            locale={locale}
            labels={{
              open: menu("open"),
              close: menu("close"),
              title: menu("title"),
              chapters: menu("chapters"),
              pages: menu("pages"),
              settings: menu("settings"),
              sound: menu("sound"),
              soundHint: menu("soundHint"),
              briefMode: menu("briefMode"),
              briefModeHint: menu("briefModeHint"),
              on: menu("on"),
              off: menu("off"),
              contacts: footer("contacts"),
              city: footer("city"),
              contactsPending: footer("contactsPending"),
              languages: languages("label"),
              home: brand("home"),
            }}
            chapters={chapterIds.map((id) => ({ id, name: chapters(id) }))}
            pages={[
              ...formats.map((f) => ({
                href: `/services/${f.slug}`,
                label: formatsT(`${f.key}.title`),
              })),
              { href: "/fazenda", label: world("fazendaLink") },
              { href: "/privacy", label: footer("privacy") },
            ]}
            languageNames={{ kk: languages("kk"), ru: languages("ru"), en: languages("en") }}
          />
          <ButtonLink href="/#brief">{common("discuss")}</ButtonLink>
        </div>
      </div>
    </HeaderShell>
  );
}
