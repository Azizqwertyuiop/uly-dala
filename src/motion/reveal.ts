import { duration } from "./tokens";

/*
 * «Проявление светом» (CLAUDE.md, раздел 5) — фирменный приём вместо выезда строк из маски.
 * Текст уже отрисован (приглушён, не opacity: 0), по нему слева направо за 900 мс
 * проходит градиент света (background-clip: text, анимируется позиция градиента).
 *
 * - Запуск — по попаданию в зону видимости, не по позиции скролла.
 * - Страховка: через 1,5 с после запуска текст принудительно полностью виден.
 * - Если скрипт приложения не загрузился за 1,5 с — CSS показывает всё сам.
 * - prefers-reduced-motion и режим «Коротко»: ничего не приглушается, текст сразу виден.
 *
 * Состояния элемента [data-reveal]: без атрибута — приглушён (только при html[data-reveal="on"]),
 * data-reveal-state="run" — идёт свет, "done" — обычный текст.
 * Вариант data-reveal="glow" (первый экран): текст не приглушается — свет проходит поверх,
 * чтобы не задерживать LCP.
 */

export const REVEAL_MS = 900;
export const REVEAL_SAFETY_S = 1.5;

export function startReveal(): () => void {
  const html = document.documentElement;
  const elements = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
  const finish = (el: HTMLElement) => {
    el.dataset.revealState = "done";
  };

  // Анимация выключена или скрипт опоздал дольше страховки — показываем всё.
  const late = performance.now() > REVEAL_SAFETY_S * 1000 + duration.scene;
  if (html.dataset.reveal !== "on" || late) {
    elements.forEach(finish);
    delete html.dataset.reveal;
    return () => {};
  }
  html.dataset.revealJs = "";

  // Страховка — по настоящим часам (раздел 5: «через 1,5 с текст принудительно полностью виден»).
  // Не по времени ticker: его шаг ограничен 0,1 с, и на медленном устройстве (кадр — секунда)
  // 1,5 с ticker растягивались бы на 15 с — всё это время текст оставался бы приглушённым.
  const timers = new Set<number>();
  const run = (el: HTMLElement) => {
    el.dataset.revealState = "run";
    el.addEventListener("animationend", () => finish(el), { once: true });
    const id = window.setTimeout(() => {
      timers.delete(id);
      finish(el);
    }, REVEAL_SAFETY_S * 1000);
    timers.add(id);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        observer.unobserve(el);
        run(el);
      }
    },
    { threshold: 0.15 },
  );

  // Первый экран (data-reveal-wait="intro") ждёт таймлайна интро 3D-сцены (4,2 с, раздел 2).
  // Если сцены не будет (fallback, «Коротко», выключен холст) — проявляется сразу по видимости.
  // Текст этих элементов виден всё время: свет у варианта glow проходит поверх.
  const waiting = elements.filter((el) => el.dataset.revealWait === "intro");
  let released = waiting.length === 0;
  const release = () => {
    if (released) return;
    released = true;
    waiting.forEach((el) => observer.observe(el));
  };
  const noStage = () =>
    html.dataset.quality === "fallback" || (html.dataset.quality && html.dataset.canvas === "off");
  const stageObserver = new MutationObserver(() => {
    if (noStage()) release();
  });
  stageObserver.observe(html, {
    attributes: true,
    attributeFilter: ["data-quality", "data-canvas"],
  });
  window.addEventListener("uly:intro-text", release, { once: true });
  const safety = window.setTimeout(release, 8000);
  if (noStage()) release();

  elements.filter((el) => !waiting.includes(el)).forEach((el) => observer.observe(el));

  // Элементы, появившиеся позже (гидрация заменила узел: панели табов «Дня» — article → div,
  // смена языка без перезагрузки), тоже проявляются по видимости.
  const domObserver = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const found = node.matches("[data-reveal]") ? [node] : [];
        found.push(...node.querySelectorAll<HTMLElement>("[data-reveal]"));
        for (const el of found) {
          if (el.dataset.revealState || elements.includes(el)) continue;
          elements.push(el);
          if (html.dataset.mode === "brief") finish(el);
          else observer.observe(el);
        }
      });
    }
  });
  domObserver.observe(document.body, { childList: true, subtree: true });

  // Смена режима на «Коротко» — сразу показать всё.
  const modeObserver = new MutationObserver(() => {
    if (html.dataset.mode === "brief") {
      elements.forEach(finish);
      observer.disconnect();
    }
  });
  modeObserver.observe(html, { attributes: true, attributeFilter: ["data-mode"] });

  return () => {
    observer.disconnect();
    domObserver.disconnect();
    modeObserver.disconnect();
    stageObserver.disconnect();
    window.removeEventListener("uly:intro-text", release);
    window.clearTimeout(safety);
    timers.forEach((id) => window.clearTimeout(id));
  };
}
