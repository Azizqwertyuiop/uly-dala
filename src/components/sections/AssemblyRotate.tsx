"use client";

import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { assemblyControl, ROTATE_PER_PX, ROTATE_STEP } from "@/lib/assemblyControl";
import styles from "./sections.module.css";

type Props = { label: string; hint: string; hintTouch: string };

const LIMIT = Math.PI; // ±180°
const clamp = (v: number) => Math.min(LIMIT, Math.max(-LIMIT, v));
const toDeg = (rad: number) => Math.round((rad * 180) / Math.PI);

/*
 * Вращение юрты (глава 2): перетаскивание мышью/пальцем и стрелки на клавиатуре.
 * Только вокруг вертикали — крен камеры и сцены всегда 0. Поворот пишется в общий объект
 * assemblyControl, сцена читает его в своём кадре (без перерисовок React).
 * role="slider": стрелки ←/→ — шаг 15°, Home — исходное положение. Недоступно внутри юрты
 * (сцена ставит aria-disabled). Подпись действия — маленький текст у курсора, кастомного курсора нет;
 * на тач-устройствах подсказка видна сразу, без hover.
 */
export function AssemblyRotate({ label, hint, hintTouch }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const drag = useRef<{ x: number; yaw: number; id: number } | null>(null);

  const apply = (yaw: number) => {
    assemblyControl.yaw = clamp(yaw);
    const deg = toDeg(assemblyControl.yaw);
    const el = ref.current;
    if (el) {
      el.setAttribute("aria-valuenow", String(deg));
      el.setAttribute("aria-valuetext", `${deg}°`);
    }
  };

  const moveTip = (event: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    const t = tip.current;
    if (!el || !t || event.pointerType !== "mouse") return;
    const rect = el.getBoundingClientRect();
    t.style.transform = `translate(${event.clientX - rect.left + 16}px, ${event.clientY - rect.top + 18}px)`;
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!assemblyControl.enabled) return;
    drag.current = { x: event.clientX, yaw: assemblyControl.yaw, id: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = "";
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    moveTip(event);
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    apply(d.yaw + (event.clientX - d.x) * ROTATE_PER_PX);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    delete event.currentTarget.dataset.dragging;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!assemblyControl.enabled) return;
    const step: Record<string, number | "home"> = {
      ArrowRight: ROTATE_STEP,
      ArrowUp: ROTATE_STEP,
      ArrowLeft: -ROTATE_STEP,
      ArrowDown: -ROTATE_STEP,
      Home: "home",
    };
    const action = step[event.key];
    if (action === undefined) return;
    event.preventDefault();
    apply(action === "home" ? 0 : assemblyControl.yaw + action);
  };

  return (
    <div
      ref={ref}
      className={styles.rotate}
      data-assembly-rotate=""
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation="horizontal"
      aria-valuemin={-180}
      aria-valuemax={180}
      aria-valuenow={0}
      aria-valuetext="0°"
      aria-disabled="true"
      onPointerEnter={(e) => {
        assemblyControl.hover = true;
        moveTip(e);
      }}
      onPointerLeave={() => (assemblyControl.hover = false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onFocus={() => (assemblyControl.hover = true)}
      onBlur={() => (assemblyControl.hover = false)}
      onKeyDown={onKeyDown}
    >
      <span ref={tip} className={styles.rotateTip} aria-hidden="true">
        {hint}
      </span>
      <span className={styles.rotateHintTouch} aria-hidden="true">
        {hintTouch}
      </span>
    </div>
  );
}
