"use client";

import { useEffect } from "react";
import { whenIdle } from "@/lib/idle";
import { startInput } from "@/motion/input";
import { startProgress } from "@/motion/progress";
import { startReveal } from "@/motion/reveal";
import { startScroll } from "@/motion/scroll";
import "@/motion/ticker";

/*
 * Запуск ядра движения на странице. Ticker — единственный rAF — создаётся при импорте.
 * Lenis и GSAP грузятся после загрузки страницы, в простое: hero-DOM их не ждёт (раздел 7).
 */
export function MotionBootstrap() {
  useEffect(() => {
    const stops = [startInput(), startProgress(), startReveal()];

    let cancelled = false;
    let destroyScroll: (() => void) | undefined;
    let cancelIdle = () => {};
    const loadScroll = () => {
      cancelIdle = whenIdle(
        () =>
          void startScroll().then((runtime) => {
            if (cancelled) runtime.destroy();
            else destroyScroll = runtime.destroy;
          }),
      );
    };
    if (document.readyState === "complete") loadScroll();
    else window.addEventListener("load", loadScroll, { once: true });

    return () => {
      cancelled = true;
      cancelIdle();
      stops.forEach((stop) => stop());
      destroyScroll?.();
      window.removeEventListener("load", loadScroll);
    };
  }, []);
  return null;
}
