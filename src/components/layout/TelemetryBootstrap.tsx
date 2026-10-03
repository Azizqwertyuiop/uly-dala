"use client";

import { useEffect } from "react";
import { ctas, places, type EventMap } from "@/lib/analytics/events";
import { isOneOf, placeOf } from "@/lib/analytics/place";
import { flush, track } from "@/lib/analytics/track";
import { eventTypes } from "@/lib/brief/model";
import { whenIdle } from "@/lib/idle";
import { describe, reportError } from "@/lib/monitoring/report";
import { chapterBounds, onChapterChange } from "@/motion/progress";
import { useUiStore } from "@/store/ui";

/*
 * Аналитика и мониторинг на всей странице (CLAUDE.md, раздел 14). Ничего не рисует.
 * - Клики: один делегированный обработчик. CTA помечены data-cta (BriefLink, ButtonLink),
 *   WhatsApp, звонок и скачивание презентации узнаются по ссылке. Место — глава или data-place.
 * - Звук и «Коротко» — по изменению стора (выбор пользователя), глубина — максимальная глава.
 * - Core Web Vitals (web-vitals) — с уровнем качества в каждом событии.
 * - Ошибки JS, отказ промисов, нарушения CSP → мониторинг; ошибки WebGL — с тегом webgl.
 */

function onClick(event: MouseEvent) {
  const el = (event.target as Element | null)?.closest<HTMLElement>("a, button");
  if (!el) return;
  const place = placeOf(el);
  const href = el.getAttribute("href") ?? "";
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href)) return track("whatsapp", { place });
  if (href.startsWith("tel:")) return track("call", { place });
  if (el.hasAttribute("download")) return track("presentation_download", { place });
  const cta = el.dataset.cta;
  if (isOneOf(ctas, cta)) {
    const format = el.dataset.format;
    const props: EventMap["cta"] = { cta, place };
    if (isOneOf(eventTypes, format)) props.format = format;
    track("cta", props);
  }
}

const WEBGL_TEXT = /webgl|shader|context lost/i;

export function TelemetryBootstrap() {
  useEffect(() => {
    // ---------- Ошибки ----------
    const onError = (event: ErrorEvent) => {
      const { message, stack } = describe(event.error ?? event.message);
      reportError({
        tag: WEBGL_TEXT.test(message) ? "webgl" : "js",
        kind: "uncaught",
        message,
        stack,
        source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const { message, stack } = describe(event.reason);
      reportError({
        tag: WEBGL_TEXT.test(message) ? "webgl" : "js",
        kind: "unhandled_rejection",
        message,
        stack,
      });
    };
    const onCsp = (event: SecurityPolicyViolationEvent) => {
      let blocked = event.blockedURI;
      try {
        // Только схема и хост: путь и query могут нести лишнее.
        if (/^https?:/.test(blocked)) blocked = new URL(blocked).origin;
      } catch {
        // Не адрес: inline, eval, data, blob.
      }
      reportError({
        tag: "csp",
        kind: "violation",
        message: `${event.effectiveDirective} blocked ${blocked}`,
        detail: { directive: event.effectiveDirective, blocked, disposition: event.disposition },
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("securitypolicyviolation", onCsp);

    // ---------- Клики ----------
    document.addEventListener("click", onClick, { capture: true });

    // ---------- Звук и «Коротко» — только выбор пользователя ----------
    const offUi = useUiStore.subscribe((s, prev) => {
      if (s.soundEnabled !== prev.soundEnabled) track("sound", { on: s.soundEnabled });
      if (s.uiMode !== prev.uiMode && s.uiModeSource === "user")
        track("brief_mode", { on: s.uiMode === "brief" });
    });

    // ---------- Глубина: максимальная глава, отправляется при уходе со страницы ----------
    // Глава запоминается в момент достижения: при переходе на другую страницу границы уже другие.
    let deepest: EventMap["scroll_depth"] | null = null;
    let reported = -1;
    const offChapter = onChapterChange((index, id) => {
      if (!isOneOf(places, id)) return;
      if (deepest && index <= deepest.index) return;
      deepest = { chapter: id, index, of: chapterBounds().length };
    });
    const onHide = (event: Event) => {
      if (event.type === "visibilitychange" && document.visibilityState !== "hidden") return;
      if (!deepest || deepest.index <= reported) return;
      reported = deepest.index;
      track("scroll_depth", deepest);
      flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);

    // ---------- Core Web Vitals ----------
    let cancelled = false;
    const cancelIdle = whenIdle(() => {
      void import("web-vitals").then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
        if (cancelled) return;
        const send = (m: { name: string; value: number; rating: string }) => {
          const metric = m.name as EventMap["web_vital"]["metric"];
          const value = metric === "CLS" ? Math.round(m.value * 1000) / 1000 : Math.round(m.value);
          track("web_vital", {
            metric,
            value,
            rating: m.rating as EventMap["web_vital"]["rating"],
          });
        };
        onLCP(send);
        onINP(send);
        onCLS(send);
        onFCP(send);
        onTTFB(send);
      });
    }, 3000);

    return () => {
      cancelled = true;
      cancelIdle();
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("securitypolicyviolation", onCsp);
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      offUi();
      offChapter();
    };
  }, []);

  return null;
}
