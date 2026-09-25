import type Lenis from "lenis";
import { ticker } from "./ticker";

/*
 * Плавная прокрутка и ScrollTrigger (CLAUDE.md, разделы 5 и 7).
 * - Lenis — только десктоп (мышь / тачпад, hover), lerp 0.09. На тач — нативный скролл.
 *   Выключен при prefers-reduced-motion и в режиме «Коротко».
 * - GSAP не крутит свой rAF: его ticker усыплён и тикает от нашего (фаза timeline).
 *   ScrollTrigger обновляется от Lenis. ScrollTrigger — только для расчёта прогресса секций.
 * - Всё грузится динамически после первой отрисовки: hero не ждёт этих библиотек.
 */

const LERP = 0.09;

export function wantsSmoothScroll(): boolean {
  return (
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    document.documentElement.dataset.mode !== "brief"
  );
}

type ScrollRuntime = { lenis: Lenis | null; destroy: () => void };

let runtime: ScrollRuntime | null = null;

export async function startScroll(): Promise<ScrollRuntime> {
  if (runtime) return runtime;

  const [{ gsap }, { ScrollTrigger }] = await Promise.all([
    import("gsap"),
    import("gsap/ScrollTrigger"),
  ]);
  gsap.registerPlugin(ScrollTrigger);
  // Адресная строка на телефоне не должна вызывать пересчёт.
  ScrollTrigger.config({ ignoreMobileResize: true });

  // GSAP — от нашего ticker: свой цикл усыплён и больше не просыпается.
  gsap.ticker.sleep();
  (gsap.ticker as { wake: () => void }).wake = () => {};
  const offTimeline = ticker.add("timeline", () => gsap.ticker.tick());

  let lenis: Lenis | null = null;
  let offLenis = () => {};
  let observer: MutationObserver | null = null;

  const enableLenis = async () => {
    if (lenis || !wantsSmoothScroll()) return;
    const { default: LenisClass } = await import("lenis");
    lenis = new LenisClass({
      lerp: LERP,
      autoRaf: false,
      anchors: false,
      // Внутри диалогов (меню, бриф) — нативная прокрутка.
      prevent: (node) => node.closest("dialog") !== null,
    });
    lenis.on("scroll", ScrollTrigger.update);
    offLenis = ticker.add("input", (_dt, time) => lenis?.raf(time * 1000));
  };

  const disableLenis = () => {
    offLenis();
    lenis?.destroy();
    lenis = null;
  };

  await enableLenis();

  // Открытое меню или бриф останавливает плавную прокрутку страницы;
  // режим «Коротко» выключает её совсем.
  observer = new MutationObserver(() => {
    const html = document.documentElement;
    if (html.dataset.mode === "brief") disableLenis();
    else if (!lenis) void enableLenis();
    if (html.dataset.menuOpen) lenis?.stop();
    else lenis?.start();
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-mode", "data-menu-open"],
  });

  runtime = {
    get lenis() {
      return lenis;
    },
    destroy() {
      observer?.disconnect();
      disableLenis();
      offTimeline();
      runtime = null;
    },
  };
  return runtime;
}
