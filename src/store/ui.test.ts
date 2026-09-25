import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: { matches: boolean }) => void;

function setupBrowser({
  reduced,
  stored,
  storageThrows = false,
}: {
  reduced: boolean;
  stored?: string;
  storageThrows?: boolean;
}) {
  const listeners: Listener[] = [];
  const data = new Map<string, string>(stored ? [["uly-dala:ui-mode", stored]] : []);
  const storage = {
    getItem: (key: string) => {
      if (storageThrows) throw new Error("SecurityError");
      return data.get(key) ?? null;
    },
    setItem: (key: string, value: string) => {
      if (storageThrows) throw new Error("QuotaExceededError");
      data.set(key, value);
    },
  };
  const documentElement = { dataset: {} as Record<string, string> };
  vi.stubGlobal("document", { documentElement });
  vi.stubGlobal("window", {
    localStorage: storage,
    matchMedia: () => ({
      matches: reduced,
      addEventListener: (_: string, fn: Listener) => listeners.push(fn),
      removeEventListener: () => {},
    }),
  });
  return {
    data,
    documentElement,
    fireMotionChange: (matches: boolean) => listeners.forEach((fn) => fn({ matches })),
  };
}

async function freshStore() {
  vi.resetModules();
  return (await import("./ui")).useUiStore;
}

describe("uiMode", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("по умолчанию — cinematic, звук выключен", async () => {
    setupBrowser({ reduced: false });
    const store = await freshStore();
    store.getState().hydrate();
    expect(store.getState().uiMode).toBe("cinematic");
    expect(store.getState().soundEnabled).toBe(false);
  });

  it("prefers-reduced-motion → brief автоматически и следит за изменениями", async () => {
    const env = setupBrowser({ reduced: true });
    const store = await freshStore();
    store.getState().hydrate();
    expect(store.getState().uiMode).toBe("brief");
    expect(env.documentElement.dataset.mode).toBe("brief");
    env.fireMotionChange(false);
    expect(store.getState().uiMode).toBe("cinematic");
  });

  it("выбор пользователя запоминается и важнее системной настройки", async () => {
    const env = setupBrowser({ reduced: true, stored: "cinematic" });
    const store = await freshStore();
    store.getState().hydrate();
    expect(store.getState().uiMode).toBe("cinematic");

    store.getState().setUiMode("brief");
    expect(env.data.get("uly-dala:ui-mode")).toBe("brief");
    env.fireMotionChange(false);
    expect(store.getState().uiMode).toBe("brief");
  });

  it("работает, если localStorage недоступен", async () => {
    setupBrowser({ reduced: false, storageThrows: true });
    const store = await freshStore();
    expect(() => store.getState().hydrate()).not.toThrow();
    expect(() => store.getState().toggleUiMode()).not.toThrow();
    expect(store.getState().uiMode).toBe("brief");
  });
});
