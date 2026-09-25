import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * false на сервере и при гидрации, true — после неё. Для прогрессивного улучшения:
 * без JS остаётся рабочая HTML-версия (ссылка, список), с JS — интерактивная.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
