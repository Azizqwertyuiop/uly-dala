"use client";

import type { MouseEvent, ReactNode } from "react";
import { Link, useRouter } from "@/lib/intl/navigation";
import { CASE_COVER } from "./caseTransition";

/*
 * Переход из ленты архива в страницу кейса общим элементом (CLAUDE.md, раздел 5):
 * кадр растягивается в обложку кейса — 1000 мс, кривая horizon (View Transitions, globals.css).
 * Без поддержки View Transitions, при reduced motion, с модификаторами (новая вкладка) —
 * обычная ссылка. «Назад» браузера — обычная история: позиция прокрутки восстанавливается.
 */

/** Сколько ждать обложку новой страницы, прежде чем отпустить переход, мс. */
const WAIT_MS = 3000;

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => { finished: Promise<void> };
};

export function CaseLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const doc = document as ViewTransitionDocument;
    if (!doc.startViewTransition) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const img = event.currentTarget.querySelector("img");
    if (!img) return;
    event.preventDefault();
    img.style.viewTransitionName = CASE_COVER;
    // WebGL-двойник в снимок перехода не попадает — на время снимка виден сам <img>.
    const gl = img.dataset.gl;
    if (gl === "ready") img.dataset.gl = "snapshot";
    const transition = doc.startViewTransition(
      () =>
        new Promise<void>((resolve) => {
          const done = () => {
            observer.disconnect();
            clearTimeout(timer);
            resolve();
          };
          // Во время перехода кадры не рисуются (rAF стоит) — ждём обложку по изменениям DOM.
          const observer = new MutationObserver(() => {
            if (document.querySelector("[data-case-cover]")) done();
          });
          observer.observe(document.body, { childList: true, subtree: true });
          const timer = setTimeout(done, WAIT_MS);
          router.push(href);
        }),
    );
    void transition.finished.finally(() => {
      img.style.viewTransitionName = "";
      if (img.dataset.gl === "snapshot") img.dataset.gl = gl;
    });
  };

  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}
