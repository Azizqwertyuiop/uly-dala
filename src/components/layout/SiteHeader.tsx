import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/intl/navigation";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Wordmark } from "./Wordmark";
import styles from "./SiteHeader.module.css";

/*
 * Хедер: вордмарк, «Меню», «Обсудить событие» (CLAUDE.md, раздел 8).
 * Без JS «Меню» ведёт к навигации в футере; полноэкранное меню — следующий шаг.
 */
export async function SiteHeader() {
  const t = await getTranslations("common");
  const brand = await getTranslations("brand");

  return (
    <header className={styles.header} data-tone="dark">
      <div className={`${layout.container} ${styles.bar}`}>
        <Link href="/" className={styles.home} aria-label={brand("home")}>
          <Wordmark className={styles.wordmark} />
        </Link>
        <div className={styles.actions}>
          <a href="#site-nav" className={`${type.link} ${styles.menu}`}>
            {t("menu")}
          </a>
          <ButtonLink href="/#brief">{t("discuss")}</ButtonLink>
        </div>
      </div>
    </header>
  );
}
