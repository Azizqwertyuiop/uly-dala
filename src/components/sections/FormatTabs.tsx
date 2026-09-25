"use client";

import Link from "next/link";
import { BriefLink } from "@/components/brief/BriefLink";
import { isEventType } from "@/lib/brief/model";
import { useBriefStore } from "@/store/brief";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { SceneImage } from "@/components/ui/SceneImage";
import layout from "@/components/ui/layout.module.css";
import type from "@/components/ui/type.module.css";
import styles from "./FormatTabs.module.css";

export type FormatTabItem = {
  slug: string;
  audience: "corporate" | "family";
  title: string;
  phrase: string;
  facts: string[];
  cta: string;
  ctaHref: string;
  pageHref: string;
  image: string;
  alt: string;
};

type Props = {
  label: string;
  formatPageLabel: string;
  items: FormatTabItem[];
};

/*
 * Шесть форматов главы «День».
 * Без JS (и до гидрации) — список всех форматов с оглавлением-ссылками.
 * С JS — табы по паттерну WAI-ARIA: стрелки, Home/End, фокус на активном табе.
 */
export function FormatTabs({ label, formatPageLabel, items: allItems }: Props) {
  // Порядок форматов — по развилке главы 2: выбранная аудитория первой (порядок DOM = порядок Tab).
  const audience = useBriefStore((s) => s.audience);
  const items =
    audience === "all"
      ? allItems
      : [...allItems].sort(
          (a, b) => Number(b.audience === audience) - Number(a.audience === audience),
        );
  const [enhanced, setEnhanced] = useState(false);
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  useEffect(() => {
    // Прогрессивное улучшение: после гидрации список превращается в табы.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- включаем табы только в браузере с JS
    setEnhanced(true);
  }, []);

  const select = (index: number) => {
    const next = (index + items.length) % items.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => select(active + 1),
      ArrowLeft: () => select(active - 1),
      Home: () => select(0),
      End: () => select(items.length - 1),
    };
    const action = keys[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  // role="tabpanel" недопустим на <article>: с табами панель — <div>, без JS — <article>.
  const Panel = enhanced ? "div" : "article";
  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = (slug: string) => `format-${slug}`;

  return (
    <div className={styles.tabs}>
      {enhanced ? (
        <div role="tablist" aria-label={label} className={styles.tablist}>
          {items.map((item, i) => (
            <button
              key={item.slug}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              id={tabId(i)}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-controls={panelId(item.slug)}
              tabIndex={i === active ? 0 : -1}
              className={styles.tab}
              onClick={() => setActive(i)}
              onKeyDown={onKeyDown}
            >
              {item.title}
            </button>
          ))}
        </div>
      ) : (
        <nav aria-label={label}>
          <ul className={styles.toc}>
            {items.map((item) => (
              <li key={item.slug}>
                <a href={`#${panelId(item.slug)}`} className={type.link}>
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className={styles.panels}>
        {items.map((item, i) => (
          <Panel
            key={item.slug}
            id={panelId(item.slug)}
            className={styles.panel}
            data-format={item.slug}
            {...(enhanced
              ? {
                  role: "tabpanel",
                  "aria-labelledby": tabId(i),
                  hidden: i !== active,
                  tabIndex: 0,
                }
              : { "aria-labelledby": `${panelId(item.slug)}-title` })}
          >
            <div className={styles.panelText}>
              <h3 id={`${panelId(item.slug)}-title`} className={type.subTitle}>
                {item.title}
              </h3>
              <p className={type.lead}>{item.phrase}</p>
              <ul className={type.list}>
                {item.facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
              <div className={layout.actions}>
                <BriefLink
                  href={item.ctaHref}
                  source="brief"
                  eventType={isEventType(item.slug) ? item.slug : undefined}
                  variant="link"
                  className={type.link}
                >
                  <strong>{item.cta}</strong>
                </BriefLink>
                <Link href={item.pageHref} className={type.link}>
                  {formatPageLabel}
                  <span className={layout.visuallyHidden}>: {item.title}</span>
                </Link>
              </div>
            </div>
            <SceneImage
              className={styles.panelImage}
              src={item.image}
              alt={item.alt}
              width={1600}
              height={900}
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          </Panel>
        ))}
      </div>
    </div>
  );
}
