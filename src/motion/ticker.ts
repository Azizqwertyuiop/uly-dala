import { MAX_DELTA } from "./tokens";

/*
 * Единственный requestAnimationFrame сайта (CLAUDE.md, разделы 5 и 7).
 * Конвейер кадра: input → progress → timeline → damping → render.
 *
 * - delta — в секундах и не больше MAX_DELTA (0,1 с): анимации одинаковы на 60 и 120 Гц
 *   и не «прыгают» после паузы.
 * - При document.hidden цикл останавливается; после возврата первый кадр идёт с delta = 0.
 * - Цикл крутится, только пока есть подписчики.
 * - Мост rAF: сторонние библиотеки (ScrollTrigger и др.) вызывают window.requestAnimationFrame,
 *   но их колбэки выполняются в начале нашего кадра — нативный rAF остаётся один.
 */

export const PHASES = ["input", "progress", "timeline", "damping", "render"] as const;
export type Phase = (typeof PHASES)[number];

/** dt — секунды с прошлого кадра (≤ MAX_DELTA), time — суммарное время ticker, с. */
export type FrameCallback = (dt: number, time: number) => void;

type Env = {
  raf: (cb: (now: number) => void) => number;
  caf: (id: number) => void;
  isHidden: () => boolean;
  onVisibilityChange: (listener: () => void) => void;
};

export type Ticker = ReturnType<typeof createTicker>;

export function createTicker(env: Env) {
  const phases: Record<Phase, FrameCallback[]> = {
    input: [],
    progress: [],
    timeline: [],
    damping: [],
    render: [],
  };
  let bridged = new Map<number, (now: number) => void>();
  let nextBridgeId = 1;
  let rafId = 0;
  let running = false;
  let last: number | null = null;
  let time = 0;
  let frames = 0;

  const hasWork = () => bridged.size > 0 || PHASES.some((p) => phases[p].length > 0);

  function frame(now: number) {
    rafId = 0;
    running = false;
    const dt = last === null ? 0 : Math.min(Math.max((now - last) / 1000, 0), MAX_DELTA);
    last = now;
    time += dt;
    frames++;

    // Колбэки сторонних rAF — один раз, в начале кадра (новые попадут в следующий).
    if (bridged.size > 0) {
      const queue = bridged;
      bridged = new Map();
      queue.forEach((cb) => cb(now));
    }

    for (const phase of PHASES) {
      const list = phases[phase];
      for (let i = 0; i < list.length; i++) list[i]!(dt, time);
    }
    schedule();
  }

  function schedule() {
    if (running || env.isHidden() || !hasWork()) return;
    running = true;
    rafId = env.raf(frame);
  }

  env.onVisibilityChange(() => {
    if (env.isHidden()) {
      if (rafId) env.caf(rafId);
      rafId = 0;
      running = false;
    } else {
      last = null;
      schedule();
    }
  });

  return {
    /** Подписка на фазу кадра. Возвращает отписку. */
    add(phase: Phase, cb: FrameCallback): () => void {
      phases[phase].push(cb);
      schedule();
      return () => {
        const list = phases[phase];
        const i = list.indexOf(cb);
        if (i >= 0) list.splice(i, 1);
      };
    },
    /** Разовый колбэк в начале следующего кадра (так работает мост rAF). */
    requestFrame(cb: (now: number) => void): number {
      const id = nextBridgeId++;
      bridged.set(id, cb);
      schedule();
      return id;
    },
    cancelFrame(id: number) {
      bridged.delete(id);
    },
    get time() {
      return time;
    },
    /** Число отрисованных кадров — для тестов и отладки. */
    get frames() {
      return frames;
    },
  };
}

function browserTicker(): Ticker {
  const nativeRaf = window.requestAnimationFrame.bind(window);
  const nativeCaf = window.cancelAnimationFrame.bind(window);
  const t = createTicker({
    raf: nativeRaf,
    caf: nativeCaf,
    isHidden: () => document.hidden,
    onVisibilityChange: (listener) => document.addEventListener("visibilitychange", listener),
  });
  // Мост: все остальные вызовы rAF на странице идут через ticker.
  window.requestAnimationFrame = (cb) => t.requestFrame(cb);
  window.cancelAnimationFrame = (id) => t.cancelFrame(id);
  (window as unknown as { __ticker?: Ticker }).__ticker = t;
  return t;
}

const serverTicker: Ticker = createTicker({
  raf: () => 0,
  caf: () => {},
  isHidden: () => true,
  onVisibilityChange: () => {},
});

/** Общий ticker страницы. На сервере — заглушка, которая никогда не тикает. */
export const ticker: Ticker = typeof window === "undefined" ? serverTicker : browserTicker();
