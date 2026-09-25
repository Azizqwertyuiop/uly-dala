import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import {
  kazakhLetters,
  kazakhWords,
  latinAlphabet,
  punctuation,
  russianAlphabet,
} from "@/content/type-specimen";
import { resolveLocale } from "@/lib/intl/locale";
import { typograph } from "@/lib/typography";
import { fontSpecimens } from "@/styles/fonts";
import styles from "./type-test.module.css";

/*
 * Служебная страница проверки шрифтов (CLAUDE.md, раздел 4): все казахские глифы
 * во всех начертаниях в крупном кегле. Не индексируется. Автопроверка — e2e/fonts.spec.ts.
 */

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/type-test">): Promise<Metadata> {
  const locale = resolveLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "typeTest" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const letters = `${kazakhLetters.upper.join("")} ${kazakhLetters.lower.join("")}`;
const styleKinds = ["normal", "italic"] as const;

export default function TypeTestPage({ params }: PageProps<"/[locale]/type-test">) {
  const locale = resolveLocale(use(params).locale);
  setRequestLocale(locale);
  const t = useTranslations("typeTest");
  const hero = useTranslations("hero");

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.intro}>{typograph(t("intro"), locale)}</p>
      </header>

      <section aria-labelledby="heading-font" className={styles.section}>
        <h2 id="heading-font" className={styles.sectionTitle}>
          {t("headingFont")}: {fontSpecimens.heading.name}
        </h2>
        {styleKinds.map((style) =>
          fontSpecimens.heading.weights.map((weight) => (
            <figure key={`${style}-${weight}`} className={styles.specimen}>
              <figcaption className={styles.caption}>
                {fontSpecimens.heading.name} · {t("weight")} {weight} · {t(style)}
              </figcaption>
              <p
                className={styles.hero}
                data-font="heading"
                data-style={style}
                style={{ fontWeight: weight }}
              >
                {letters}
              </p>
              <p
                className={styles.chapter}
                data-font="heading"
                data-style={style}
                style={{ fontWeight: weight }}
              >
                {kazakhWords}
              </p>
            </figure>
          )),
        )}
        <p className={styles.hero} data-font="heading" data-style="normal">
          {typograph(hero("title"), locale)}
        </p>
      </section>

      <section aria-labelledby="body-font" className={styles.section}>
        <h2 id="body-font" className={styles.sectionTitle}>
          {t("bodyFont")}: {fontSpecimens.body.name}
        </h2>
        {styleKinds.map((style) =>
          fontSpecimens.body.weights.map((weight) => (
            <figure key={`${style}-${weight}`} className={styles.specimen}>
              <figcaption className={styles.caption}>
                {fontSpecimens.body.name} · {t("weight")} {weight} · {t(style)}
              </figcaption>
              <p
                className={styles.bodyLarge}
                data-font="body"
                data-style={style}
                style={{ fontWeight: weight }}
              >
                {letters}
              </p>
              <p
                className={styles.body}
                data-font="body"
                data-style={style}
                style={{ fontWeight: weight }}
              >
                {kazakhWords} · {russianAlphabet} · {latinAlphabet} · {punctuation}
              </p>
            </figure>
          )),
        )}
        <p className={styles.lead} data-font="body" data-style="normal">
          {typograph(hero("subtitle"), locale)}
        </p>
      </section>
    </main>
  );
}
