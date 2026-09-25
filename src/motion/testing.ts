import { createTicker } from "./ticker";

/**
 * Ticker с поддельным rAF для тестов: кадры идут строго с заданной частотой.
 * nativeCalls — сколько раз ticker вызвал «нативный» rAF (должно быть ровно по одному на кадр).
 */
export function fakeTicker() {
  let queued: ((now: number) => void) | null = null;
  let now = 0;
  let hidden = false;
  let visibilityListener = () => {};
  const stats = { nativeCalls: 0 };
  const t = createTicker({
    raf: (cb) => {
      stats.nativeCalls++;
      queued = cb;
      return stats.nativeCalls;
    },
    caf: () => {
      queued = null;
    },
    isHidden: () => hidden,
    onVisibilityChange: (listener) => {
      visibilityListener = listener;
    },
  });
  return {
    ticker: t,
    stats,
    /** Прогнать seconds секунд кадрами частотой hz. */
    run(seconds: number, hz: number) {
      const frames = Math.round(seconds * hz);
      for (let i = 0; i < frames; i++) {
        now += 1000 / hz;
        const cb = queued;
        queued = null;
        cb?.(now);
      }
    },
    /** Одиночный кадр через ms миллисекунд после предыдущего. */
    frameAfter(ms: number) {
      now += ms;
      const cb = queued;
      queued = null;
      cb?.(now);
    },
    setHidden(value: boolean) {
      hidden = value;
      visibilityListener();
    },
    get queued() {
      return queued !== null;
    },
  };
}
