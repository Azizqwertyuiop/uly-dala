"use client";

import { useEffect, useSyncExternalStore, type RefObject } from "react";

export type BriefLayout = "sentence" | "lines";

const WIDE = "(min-width: 600px)";
/** Шрифт браузера увеличен (по умолчанию 16px) — раскладка «строка + поле». */
const LARGE_FONT_PX = 20;

function snapshot(): BriefLayout {
  const wide = window.matchMedia(WIDE).matches;
  const rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return wide && rootFont <= LARGE_FONT_PX ? "sentence" : "lines";
}

function subscribe(callback: () => void) {
  const media = window.matchMedia(WIDE);
  media.addEventListener("change", callback);
  window.addEventListener("resize", callback);
  return () => {
    media.removeEventListener("change", callback);
    window.removeEventListener("resize", callback);
  };
}

/**
 * «Предложение» — на широких экранах с обычным шрифтом.
 * «Строка + поле» — меньше 600px, увеличенный шрифт, а также без JS (серверный снимок).
 */
export function useBriefLayout(): BriefLayout {
  return useSyncExternalStore(subscribe, snapshot, () => "lines");
}

/**
 * Поле в фокусе не прячется под экранной клавиатурой (CLAUDE.md, раздел 9):
 * при фокусе и при изменении visualViewport поле прокручивается в видимую часть.
 * Размеры читаются только в этих событиях, не в кадре.
 */
export function useKeepFocusedAboveKeyboard(
  formRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const form = formRef.current;
    if (!enabled || !viewport || !form) return;

    const MARGIN = 16;
    const ensureVisible = () => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || !form.contains(el)) return;
      if (!el.matches("input, textarea, select")) return;
      const rect = el.getBoundingClientRect();
      const visibleBottom = viewport.offsetTop + viewport.height - MARGIN;
      const visibleTop = viewport.offsetTop + MARGIN;
      if (rect.bottom > visibleBottom) window.scrollBy({ top: rect.bottom - visibleBottom });
      else if (rect.top < visibleTop) window.scrollBy({ top: rect.top - visibleTop });
    };
    // Клавиатура появляется с задержкой — проверяем и после её анимации.
    const onFocus = () => {
      ensureVisible();
      window.setTimeout(ensureVisible, 300);
    };

    form.addEventListener("focusin", onFocus);
    viewport.addEventListener("resize", ensureVisible);
    return () => {
      form.removeEventListener("focusin", onFocus);
      viewport.removeEventListener("resize", ensureVisible);
    };
  }, [formRef, enabled]);
}
