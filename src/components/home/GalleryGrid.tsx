"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useHydrated } from "@/lib/useHydrated";
import styles from "./home.module.css";

type Photo = {
  thumb: string;
  full: string;
  width: number;
  height: number;
  alt: string;
  open: string;
  counter: string;
};

type Props = {
  photos: Photo[];
  labels: {
    dialog: string;
    close: string;
    prev: string;
    next: string;
    carousel: string;
    scrollPrev: string;
    scrollNext: string;
  };
};

/*
 * Галерея — карусель (решение заказчика 13.11.2026): лента превью листается свайпом, колесом
 * или кнопками ← →; кадры встают по сетке (scroll-snap). Без JS — та же лента с полосой прокрутки,
 * превью — ссылки на крупные файлы. С JS — просмотр в нативном <dialog>:
 * стрелки ← →, Esc закрывает, фокус возвращается на превью (WCAG 2.4.3).
 */
export function GalleryGrid({ photos, labels }: Props) {
  const hydrated = useHydrated();
  const dialog = useRef<HTMLDialogElement>(null);
  const triggers = useRef<(HTMLAnchorElement | null)[]>([]);
  const [index, setIndex] = useState<number | null>(null);
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  // Кнопки ленты гаснут у краёв. Читаем размеры только на прокрутке и ресайзе.
  useEffect(() => {
    const t = track.current;
    if (!t) return;
    const update = () =>
      setEdges({
        start: t.scrollLeft <= 2,
        end: t.scrollLeft + t.clientWidth >= t.scrollWidth - 2,
      });
    update();
    t.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      t.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  /** Листаем на ширину видимой части ленты; плавно, если пользователь не против движения. */
  const scrollTrack = (dir: 1 | -1) => {
    const t = track.current;
    if (!t) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    t.scrollBy({ left: dir * t.clientWidth * 0.9, behavior: reduce ? "auto" : "smooth" });
  };

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (index !== null && !d.open) d.showModal();
  }, [index]);

  const close = () => {
    const last = index;
    dialog.current?.close();
    setIndex(null);
    if (last !== null) triggers.current[last]?.focus();
  };
  const step = (delta: number) =>
    setIndex((i) => (i === null ? i : (i + delta + photos.length) % photos.length));

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "ArrowRight") step(1);
    else if (event.key === "ArrowLeft") step(-1);
  };

  const current = index === null ? null : photos[index];

  return (
    <>
      {hydrated && photos.length > 1 && (
        <div className={styles.carouselNav}>
          <button
            type="button"
            onClick={() => scrollTrack(-1)}
            disabled={edges.start}
            aria-label={labels.scrollPrev}
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => scrollTrack(1)}
            disabled={edges.end}
            aria-label={labels.scrollNext}
          >
            →
          </button>
        </div>
      )}
      <ul
        ref={track}
        className={styles.gallery}
        aria-label={labels.carousel}
        data-js={hydrated ? "" : undefined}
      >
        {photos.map((p, i) => (
          <li key={p.full}>
            <a
              ref={(el) => {
                triggers.current[i] = el;
              }}
              href={p.full}
              className={styles.galleryItem}
              aria-label={p.open}
              onClick={(event) => {
                if (!hydrated || event.metaKey || event.ctrlKey) return;
                event.preventDefault();
                setIndex(i);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- превью из конвейера */}
              <img
                src={p.thumb}
                alt={p.alt}
                width={900}
                height={1125}
                loading="lazy"
                decoding="async"
              />
            </a>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        className={styles.lightbox}
        aria-label={labels.dialog}
        onKeyDown={onKeyDown}
        onClose={() => setIndex(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        {current && (
          <figure className={styles.lightboxFigure}>
            {/* eslint-disable-next-line @next/next/no-img-element -- крупное фото */}
            <img
              src={current.full}
              alt={current.alt}
              width={current.width}
              height={current.height}
            />
            <figcaption className={styles.lightboxBar}>
              <span>{current.counter}</span>
              <span className={styles.lightboxButtons}>
                {photos.length > 1 && (
                  <>
                    <button type="button" onClick={() => step(-1)} aria-label={labels.prev}>
                      ←
                    </button>
                    <button type="button" onClick={() => step(1)} aria-label={labels.next}>
                      →
                    </button>
                  </>
                )}
                <button type="button" onClick={close}>
                  {labels.close}
                </button>
              </span>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}
