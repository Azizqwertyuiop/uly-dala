/**
 * Выполнить в простое браузера (requestIdleCallback), а где его нет (Safari) — после короткой паузы.
 * Возвращает отмену.
 */
export function whenIdle(callback: () => void, timeout = 2000): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof w.requestIdleCallback === "function") {
    const id = w.requestIdleCallback(callback, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(callback, 200);
  return () => window.clearTimeout(id);
}
