"use client";

import Link from "next/link";
import { BriefLink } from "@/components/brief/BriefLink";
import { isEventType } from "@/lib/brief/model";
import { setDayOrder } from "@/lib/dayControl";
import { chapterTrack, progress } from "@/motion/progress";
import { scrollToY } from "@/motion/scroll";
import { ticker } from "@/motion/ticker";
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
  /** «Скачать презентацию» (PDF). */
  presentation: { label: string; meta: string; href: string };
};

/** Кинорежим «Дня»: закреплённая дорожка со сценой (как в CSS: sections.module.css). */
function cinematicTrack(): boolean {
  const html = document.documentElement;
  return (
    html.dataset.cinematic !== undefined &&
    html.dataset.quality !== "fallback" &&
    html.dataset.mode !== "brief"
  );
}

/** Сколько ждать, пока прокрутка по клику доедет до состояния, прежде чем снова слушать скролл. */
const SCROLL_SETTLE_MS = 1800;

/*
 * Шесть форматов главы «День».
 * Без JS (и до гидрации) — список всех форматов с оглавлением-ссылками.
 * С JS — табы по паттерну WAI-ARIA: стрелки, Home/End, фокус на активном табе.
 * В кинорежиме (дорожка 300vh со сценой) табы синхронизированы со скроллом: состояние сцены
 * выбирает таб, а клик по табу (или стрелки) прокручивает к своему состоянию.
 * Порядок — по развилке главы 2; тот же порядок получает сцена (dayControl).
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
  const root = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const pending = useRef<{ index: number; until: number } | null>(null);
  const order = items.map((i) => i.slug).join(",");

  useEffect(() => {
    // Прогрессивное улучшение: после гидрации список превращается в табы.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- включаем табы только в браузере с JS
    setEnhanced(true);
  }, []);

  // Порядок — сцене и камере (площадки и путь по слотам).
  useEffect(() => {
    setDayOrder(order.split(",") as Parameters<typeof setDayOrder>[0]);
  }, [order]);

  // Кинорежим: состояние сцены (прогресс дорожки) выбирает таб. Пишем только при смене.
  useEffect(() => {
    let last = -1;
    return ticker.add("timeline", (_dt, time) => {
      if (progress.chapterId !== "day" || !cinematicTrack()) return;
      const index = Math.min(
        items.length - 1,
        Math.floor(Math.min(progress.track, 0.9999) * items.length),
      );
      // Фокус клавиатуры внутри табов — формат меняют стрелки, а не скролл. Иначе браузер,
      // подкручивая страницу к сфокусированной ссылке, переключал формат, панель со ссылкой
      // скрывалась и фокус терялся (WCAG 2.4.3).
      if (root.current?.contains(document.activeElement)) return;
      const p = pending.current;
      if (p) {
        // Прокрутка по клику ещё едет — не перебиваем выбранный таб промежуточными состояниями.
        if (index !== p.index && time * 1000 < p.until) return;
        pending.current = null;
      }
      if (index !== last) {
        last = index;
        setActive(index);
      }
    });
  }, [items.length]);

  // Полоса табов на телефоне прокручивается сама: активный таб — в видимой части полосы.
  // (Только горизонтально, страница не двигается; размеры читаются лишь при смене таба.)
  useEffect(() => {
    const tab = tabRefs.current[active];
    const strip = tab?.parentElement;
    if (!tab || !strip || strip.scrollWidth <= strip.clientWidth) return;
    const left = tab.offsetLeft - strip.offsetLeft - 16;
    strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  const scrollToState = (index: number) => {
    const track = chapterTrack("day");
    if (!track || !cinematicTrack()) return;
    const run = track.height - progress.viewportHeight;
    pending.current = { index, until: ticker.time * 1000 + SCROLL_SETTLE_MS };
    scrollToY(track.top + ((index + 0.5) / items.length) * run);
  };

  const select = (index: number, focus = true) => {
    const next = (index + items.length) % items.length;
    setActive(next);
    if (focus) tabRefs.current[next]?.focus();
    scrollToState(next);
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
      ref={root}
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
            <SceneImage
              sceneSlot
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
