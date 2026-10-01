"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ChapterId } from "./chapters";
import { clipTime, CLIP_FPS, fallbackClips } from "@/content/fallbackClips";
import { progress } from "@/motion/progress";
import { ticker } from "@/motion/ticker";
import styles from "./FallbackClip.module.css";

/*
 * Уровень fallback (CLAUDE.md, раздел 6): вместо 3D — видео-секвенция главы поверх статичного
 * кадра. Клип не играет, а перематывается: currentTime ← прогресс прохода кадра через экран
 * (у «Рассвета» — интро с серебряной волной по времени, затем скролл главы).
 * Только при html[data-quality="fallback"]; reduced motion и «Коротко» — статичный кадр.
 * Файл — за экран до показа; кадр показывается, когда видео готово (иначе виден статичный кадр).
 */

const SEEK_EPSILON = 0.5 / CLIP_FPS;

function enabled(): boolean {
  const html = document.documentElement;
  return (
    html.dataset.quality === "fallback" &&
    html.dataset.mode !== "brief" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function FallbackClip({
  chapter,
  className,
  children,
}: {
  chapter: ChapterId;
  className?: string;
  children: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const clip = fallbackClips[chapter]!;

  // Включение — когда уровень выбран (атрибут ставится после загрузки страницы).
  useEffect(() => {
    const html = document.documentElement;
    const check = () => setOn(enabled());
    check();
    const observer = new MutationObserver(check);
    observer.observe(html, { attributes: true, attributeFilter: ["data-quality", "data-mode"] });
    // Портрет телефона — свой клип (вертикальный кадр); поворот экрана меняет клип.
    const orientation = window.matchMedia("(orientation: portrait)");
    const turn = () => {
      setPortrait(orientation.matches);
      setReady(false);
    };
    turn();
    orientation.addEventListener("change", turn);
    return () => {
      observer.disconnect();
      orientation.removeEventListener("change", turn);
    };
  }, []);

  // Кадр: прогресс → время клипа. Размеры кадра — только при ресайзе.
  useEffect(() => {
    if (!on) return;
    const el = host.current!;
    const box = { top: 0, height: 1, dawnRun: 1 };
    const measure = () => {
      const r = el.getBoundingClientRect();
      box.top = r.top + window.scrollY;
      box.height = r.height;
      const dawn = document.getElementById("dawn");
      box.dawnRun = dawn ? Math.max(1, dawn.offsetHeight - window.innerHeight) : 1;
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(document.body);
    const start = ticker.time;
    let seen = false;
    const off = ticker.add("render", (_dt, time) => {
      const vh = progress.viewportHeight || window.innerHeight;
      const top = box.top - progress.scrollY;
      // Загрузка — за экран до показа.
      if (!seen && top < vh * 2 && top + box.height > -vh) {
        seen = true;
        setNear(true);
      }
      const v = video.current;
      if (!v || v.readyState < 1 || v.seeking) return;
      // «Рассвет» — прогресс главы (экран закреплён); остальные — проход кадра через экран.
      let scroll: number;
      if (chapter === "dawn") {
        scroll = progress.scrollY / box.dawnRun;
      } else {
        scroll = (vh - top) / (vh + box.height);
      }
      const intro = chapter === "dawn" && progress.scrollY < 4 ? time - start : null;
      const t = clipTime(clip, scroll, intro);
      if (Math.abs(v.currentTime - t) > SEEK_EPSILON) v.currentTime = t;
    });
    return () => {
      off();
      resize.disconnect();
    };
  }, [on, chapter, clip]);

  return (
    <div ref={host} className={[styles.host, className].filter(Boolean).join(" ")}>
      {children}
      {on && near && (
        <video
          key={portrait ? "portrait" : "landscape"}
          ref={video}
          className={styles.video}
          style={{ objectPosition: `${clip.focusX}% 50%` }}
          data-ready={ready ? "" : undefined}
          data-fallback-clip={chapter}
          muted
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
          onLoadedData={() => setReady(true)}
        >
          {(portrait ? clip.portrait : clip.sources).map((s) => (
            <source key={s.src} src={s.src} type={s.type} />
          ))}
        </video>
      )}
    </div>
  );
}
