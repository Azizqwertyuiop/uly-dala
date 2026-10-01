"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MenuSet } from "@/content/menu";
import { setFireHover, setFireSet } from "@/lib/fireControl";
import { chapterTrack, progress } from "@/motion/progress";
import { scrollToY } from "@/motion/scroll";
import { useBriefStore } from "@/store/brief";
import type from "@/components/ui/type.module.css";
import styles from "./sections.module.css";

export type FireSetItem = {
  id: MenuSet;
  name: string;
  text: string;
  dishes: { id: string; name: string; note: string }[];
};

type Props = {
  sets: FireSetItem[];
  labels: { sets: string; plan: string; list: string };
  cta: ReactNode;
};

/** Доля дорожки «Огня», где стоит план (сцена: PHASE.plan) — туда ведёт фокус с клавиатуры. */
const PLAN_AT = 0.86;

/*
 * План дастархана (глава 4): переключатель сетов — радиокнопки (стрелки, Tab — без JS тоже:
 * нужный список показывает CSS по :checked), подписи блюд — кнопки над блюдами (позиция — от сцены),
 * на телефоне, в «Коротко» и без JS — вертикальный список блюд.
 * Фокус с клавиатуры на плане, пока камера ещё у очага, — прокрутка к плану (всё доступно с клавиатуры).
 */
export function FirePlan({ sets, labels, cta }: Props) {
  const audience = useBriefStore((s) => s.audience);
  const [set, setSet] = useState<MenuSet>("traditional");
  const [pinned, setPinned] = useState<string | null>(null);
  const picked = useRef(false);

  // Сет по развилке главы 2, пока человек не выбрал сам: компании — кофе-брейк, семьи — традиционный.
  useEffect(() => {
    if (picked.current) return;
    setSet(audience === "corporate" ? "coffeeBreak" : "traditional");
  }, [audience]);

  useEffect(() => setFireSet(set), [set]);
  useEffect(() => () => setFireHover(null), []);

  /** Фокус на плане, пока камера у очага: доехать до плана (сразу — фокус не ждёт анимации). */
  const ensurePlan = () => {
    const stage = document.querySelector<HTMLElement>("[data-fire-stage]");
    const track = chapterTrack("fire");
    if (!stage || !track || stage.dataset.phase === "plan") return;
    if (!document.documentElement.hasAttribute("data-cinematic")) return;
    scrollToY(track.top + PLAN_AT * (track.height - progress.viewportHeight), { immediate: true });
  };

  const hover = (id: string | null) => setFireHover(id ?? pinned);

  return (
    <div className={styles.firePlan} data-fire-plan="">
      <fieldset className={styles.fireSets} onFocus={ensurePlan}>
        <legend className={type.eyebrow}>{labels.sets}</legend>
        <div className={styles.fireSetOptions}>
          {sets.map((s) => (
            <label key={s.id} className={styles.fireSetOption}>
              <input
                type="radio"
                name="fire-set"
                value={s.id}
                checked={set === s.id}
                onChange={() => {
                  picked.current = true;
                  setPinned(null);
                  setFireHover(null);
                  setSet(s.id);
                }}
              />
              <span>{s.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {sets.map((s) => (
        <p key={s.id} className={`${type.body} ${styles.fireSetText}`} data-set={s.id}>
          {s.text}
        </p>
      ))}

      {/* Вид сверху: подписи блюд над своими блюдами (позиция — от сцены, --xy). */}
      <div className={styles.fireHotspots} role="group" aria-label={labels.plan}>
        {sets.map((s) =>
          s.dishes.map((d) => {
            const key = `${s.id}:${d.id}`;
            const noteId = `dish-note-${s.id}-${d.id}`;
            return (
              <button
                key={key}
                type="button"
                className={styles.fireHotspot}
                data-dish={key}
                data-set={s.id}
                aria-describedby={noteId}
                aria-pressed={pinned === d.id}
                onPointerEnter={() => hover(d.id)}
                onPointerLeave={() => hover(null)}
                onFocus={() => {
                  ensurePlan();
                  hover(d.id);
                }}
                onBlur={() => hover(null)}
                onClick={() => {
                  const next = pinned === d.id ? null : d.id;
                  setPinned(next);
                  setFireHover(next ?? d.id);
                }}
              >
                <span className={styles.fireHotspotName}>{d.name}</span>
                <span id={noteId} className={styles.fireHotspotNote}>
                  {d.note}
                </span>
              </button>
            );
          }),
        )}
      </div>

      {/* Телефон, «Коротко», без JS: вертикальный список блюд выбранного сета. */}
      <div className={styles.fireList}>
        {sets.map((s) => (
          <ul
            key={s.id}
            className={styles.fireDishes}
            data-set={s.id}
            aria-label={`${labels.list}: ${s.name}`}
          >
            {s.dishes.map((d) => (
              <li key={d.id} className={styles.fireDish}>
                <span className={type.subTitle}>{d.name}</span>
                <span className={type.body}>{d.note}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>

      <div className={styles.fireCta}>{cta}</div>
    </div>
  );
}
