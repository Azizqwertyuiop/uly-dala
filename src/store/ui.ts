import { create } from "zustand";

/*
 * Состояние интерфейса (CLAUDE.md, раздел 8).
 * uiMode: 'cinematic' — полная версия со сценами; 'brief' — режим «Коротко»
 * (те же тексты, статичные кадры). Выбор пользователя запоминается;
 * без явного выбора режим следует prefers-reduced-motion.
 * Звук по умолчанию выключен и не запоминается — файлы грузятся только после включения.
 */

export type UiMode = "cinematic" | "brief";

type UiState = {
  uiMode: UiMode;
  /** 'auto' — режим выбран по prefers-reduced-motion; 'user' — выбран вручную. */
  uiModeSource: "auto" | "user";
  soundEnabled: boolean;
  setUiMode: (mode: UiMode) => void;
  toggleUiMode: () => void;
  setSound: (enabled: boolean) => void;
  /** Однократная инициализация в браузере: localStorage + prefers-reduced-motion. */
  hydrate: () => () => void;
};

export const UI_MODE_KEY = "uly-dala:ui-mode";

function readStoredMode(): UiMode | null {
  try {
    const value = window.localStorage.getItem(UI_MODE_KEY);
    return value === "cinematic" || value === "brief" ? value : null;
  } catch {
    return null;
  }
}

function storeMode(mode: UiMode) {
  try {
    window.localStorage.setItem(UI_MODE_KEY, mode);
  } catch {
    // Приватный режим или запрет хранилища — выбор просто не запомнится.
  }
}

function applyToDocument(mode: UiMode) {
  document.documentElement.dataset.mode = mode;
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

export const useUiStore = create<UiState>()((set, get) => ({
  uiMode: "cinematic",
  uiModeSource: "auto",
  soundEnabled: false,

  setUiMode: (mode) => {
    storeMode(mode);
    applyToDocument(mode);
    set({ uiMode: mode, uiModeSource: "user" });
  },

  toggleUiMode: () => get().setUiMode(get().uiMode === "brief" ? "cinematic" : "brief"),

  setSound: (enabled) => set({ soundEnabled: enabled }),

  hydrate: () => {
    const media = window.matchMedia(reducedMotionQuery);
    const stored = readStoredMode();
    const initial: UiMode = stored ?? (media.matches ? "brief" : "cinematic");
    applyToDocument(initial);
    set({ uiMode: initial, uiModeSource: stored ? "user" : "auto" });

    const onChange = (event: MediaQueryListEvent) => {
      if (get().uiModeSource !== "auto") return;
      const mode: UiMode = event.matches ? "brief" : "cinematic";
      applyToDocument(mode);
      set({ uiMode: mode });
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  },
}));
