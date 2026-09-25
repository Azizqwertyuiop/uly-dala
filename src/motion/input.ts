import { ticker } from "./ticker";

/*
 * Ввод (CLAUDE.md, раздел 2: «курсор = ветер»): позиция и скорость курсора или пальца
 * в нормализованных координатах. x, y ∈ [−1, 1], центр экрана — 0, y вверх положителен
 * (как в 3D). Скорость — в тех же единицах в секунду.
 *
 * Обработчики событий только запоминают сырые координаты; скорость считается в фазе input
 * от delta кадра — одинаково на 60 и 120 Гц.
 */

export type InputState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Модуль скорости. */
  speed: number;
  /** Указатель над страницей / палец на экране. */
  active: boolean;
  pointerType: "mouse" | "touch" | "pen" | null;
};

export function createInputState(): InputState {
  return { x: 0, y: 0, vx: 0, vy: 0, speed: 0, active: false, pointerType: null };
}

/** Сырые данные от событий между кадрами. */
export type RawPointer = { x: number; y: number; moved: boolean };

/** Сглаживание скорости, с: скорость затухает, когда курсор остановился. */
export const INPUT_VELOCITY_SMOOTHING = 0.08;

/** Шаг кадра: пишет в state, память не выделяет. */
export function updateInput(state: InputState, raw: RawPointer, dt: number): void {
  if (dt <= 0) return;
  const rawVx = raw.moved ? (raw.x - state.x) / dt : 0;
  const rawVy = raw.moved ? (raw.y - state.y) / dt : 0;
  const k = 1 - Math.exp(-dt / INPUT_VELOCITY_SMOOTHING);
  state.vx += (rawVx - state.vx) * k;
  state.vy += (rawVy - state.vy) * k;
  state.speed = Math.hypot(state.vx, state.vy);
  state.x = raw.x;
  state.y = raw.y;
  raw.moved = false;
}

/** Пиксели экрана → нормализованные координаты. */
export function normalize(px: number, py: number, width: number, height: number) {
  return {
    x: width > 0 ? (px / width) * 2 - 1 : 0,
    y: height > 0 ? 1 - (py / height) * 2 : 0,
  };
}

export const input: InputState = createInputState();

let started = false;

export function startInput(): () => void {
  if (started) return () => {};
  started = true;
  const raw: RawPointer = { x: 0, y: 0, moved: false };
  let width = window.innerWidth;
  let height = window.innerHeight;

  const onMove = (event: PointerEvent) => {
    const n = normalize(event.clientX, event.clientY, width, height);
    raw.x = n.x;
    raw.y = n.y;
    raw.moved = true;
    input.active = true;
    input.pointerType = event.pointerType as InputState["pointerType"];
  };
  const onLeave = () => {
    input.active = false;
  };
  const onResize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onMove, { passive: true });
  window.addEventListener("pointerup", (e) => e.pointerType === "touch" && onLeave(), {
    passive: true,
  });
  document.documentElement.addEventListener("pointerleave", onLeave, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });

  const off = ticker.add("input", (dt) => updateInput(input, raw, dt));
  return () => {
    off();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onMove);
    document.documentElement.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("resize", onResize);
    started = false;
  };
}
