"use client";

import Link from "next/link";
import { BriefLink } from "@/components/brief/BriefLink";
import { isEventType } from "@/lib/brief/model";
import { useBriefStore } from "@/store/brief";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  srcSet?: string;
  alt: string;
  /** Подпись «Фото события — скоро», пока снимка нет. */
  pending?: string;
};

type Props = {
  label: string;
  formatPageLabel: string;
  items: FormatTabItem[];
  /** «Скачать презентацию» (PDF). */
  presentation: { label: string; meta: string; href: string };
};

/** Свайп по фото: сдвиг пальца по горизонтали, px (и больше, чем по вертикали). */
const SWIPE_PX = 48;

/*
 * Шесть форматов главы «День» — фото настоящих событий (CLAUDE.md, раздел 2).
 * Без JS (и до гидрации) — список всех форматов с оглавлением-ссылками.
 * С JS — табы по паттерну WAI-ARIA: клик, стрелки, Home/End, фокус на активном табе;
 * на фото — свайп. Скролл формат не меняет: глава обычная, не закреплённая.
 * Порядок — по развилке главы 2 (выбранная аудитория первой).
 */
export function FormatTabs({ label, formatPageLabel, items: allItems, presentation }: Props) {
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
  // Сменился порядок (выбор в развилке) — показываем первый формат выбранной аудитории.
  const orderKey = items.map((i) => i.slug).join(",");
  const [shownOrder, setShownOrder] = useState(orderKey);
  if (shownOrder !== orderKey) {
    setShownOrder(orderKey);
    setActive(0);
  }
  // Панель анимируется только после первой смены формата (не при загрузке страницы).
  const [switched, setSwitched] = useState(false);
  const firstActive = useRef(true);
  useEffect(() => {
    if (firstActive.current) {
      firstActive.current = false;
      return;
    }
    setSwitched(true);
  }, [active]);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const swipe = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Прогрессивное улучшение: после гидрации список превращается в табы.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- включаем табы только в браузере с JS
    setEnhanced(true);
  }, []);

  // Полоса табов на телефоне прокручивается сама: активный таб — в видимой части полосы.
  // (Только горизонтально, страница не двигается; размеры читаются лишь при смене таба.)
  useEffect(() => {
    const tab = tabRefs.current[active];
    const strip = tab?.parentElement;
    if (!tab || !strip || strip.scrollWidth <= strip.clientWidth) return;
    const left = tab.offsetLeft - strip.offsetLeft - 16;
    strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active, enhanced]);

  const select = (index: number, focus = true) => {
    const next = (index + items.length) % items.length;
    setActive(next);
    if (focus) tabRefs.current[next]?.focus();
  };

  // Свайп по фото — соседний формат (на тач; мышью тоже работает, перетаскиванием).
  const onPointerDown = (event: ReactPointerEvent) => {
    swipe.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
    select(active + (dx < 0 ? 1 : -1), false);
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
    <div
      className={styles.tabs}
      data-day-state={enhanced ? active : undefined}
      data-switched={switched ? "" : undefined}
    >
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
              onClick={() => select(i, false)}
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
              <p className={`${type.lead} ${styles.phrase}`} data-reveal="">
                {item.phrase}
              </p>
              <ul className={`${type.list} ${styles.facts}`}>
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
                <Link
                  href={item.pageHref}
                  className={type.link}
                  data-cta="format"
                  data-format={isEventType(item.slug) ? item.slug : undefined}
                >
                  {formatPageLabel}
                  <span className={layout.visuallyHidden}>: {item.title}</span>
                </Link>
                <a href={presentation.href} className={type.link} download>
                  {presentation.label}
                  <span className={styles.meta}> ({presentation.meta})</span>
                </a>
              </div>
            </div>
            {/* Фото формата: свайп — соседний формат; при смене — проявление светом (CSS). */}
            <div
              className={styles.photo}
              onPointerDown={enhanced ? onPointerDown : undefined}
              onPointerUp={enhanced ? onPointerUp : undefined}
              onPointerCancel={() => (swipe.current = null)}
            >
              <SceneImage
                className={styles.panelImage}
                src={item.image}
                srcSet={item.srcSet}
                alt={item.alt}
                width={1500}
                height={1000}
                sizes="(min-width: 768px) 58vw, 100vw"
              />
              {item.pending && (
                <p className={styles.pending} aria-hidden="true">
                  {item.pending}
                </p>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
