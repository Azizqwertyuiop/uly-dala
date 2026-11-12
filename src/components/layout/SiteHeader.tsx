import { getLocale, getTranslations } from "next-intl/server";
import { formats } from "@/content/formats";
import { services } from "@/content/services";
import type { Locale } from "@/lib/i18n";
import { Link } from "@/lib/intl/navigation";
import layout from "@/components/ui/layout.module.css";
import { BriefLink } from "@/components/brief/BriefLink";
import { briefFallbackHref } from "@/components/brief/briefProps";
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
  const [common, brand, menu, footer, nav, formatsT, world, languages, servicesT] =
    await Promise.all([
      getTranslations("common"),
      getTranslations("brand"),
      getTranslations("menu"),
      getTranslations("footer"),
      getTranslations("home.nav"),
      getTranslations("formats"),
      getTranslations("world"),
      getTranslations("languages"),
      getTranslations("services"),
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
              chapters: nav("label"),
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
            chapters={[
              { id: "services", name: nav("services") },
              { id: "gallery", name: nav("gallery") },
              { id: "reviews", name: nav("reviews") },
              { id: "why", name: nav("why") },
              { id: "steps", name: nav("steps") },
              { id: "fazenda", name: nav("fazenda") },
              { id: "team", name: nav("team") },
              { id: "brief", name: nav("contact") },
            ]}
            pages={[
              ...formats.map((f) => ({
                href: `/services/${f.slug}`,
                label: formatsT(`${f.key}.title`),
              })),
              ...services.map((s) => ({
                href: `/services/${s.slug}`,
                label: servicesT(`${s.key}.title`),
              })),
              { href: "/fazenda", label: world("fazendaLink") },
              { href: "/privacy", label: footer("privacy") },
            ]}
            languageNames={{ kk: languages("kk"), ru: languages("ru"), en: languages("en") }}
          />
          {/* Как кнопка первого экрана: бриф в окне; без JS — форма внизу главной. */}
          <BriefLink href={briefFallbackHref(locale, "brief")} source="brief">
            {common("discuss")}
          </BriefLink>
        </div>
      </div>
    </HeaderShell>
  );
}
