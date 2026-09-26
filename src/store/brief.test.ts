import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formats } from "@/content/formats";

function setupBrowser(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
  });
  return data;
}

async function freshStore() {
  vi.resetModules();
  return import("./brief");
}

describe("развилка главы 2 в сторе брифа", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("предзаполнение — первый формат аудитории в главе «День»", async () => {
    setupBrowser();
    const { AUDIENCE_PREFILL } = await freshStore();
    expect(AUDIENCE_PREFILL.corporate).toBe(formats.find((f) => f.audience === "corporate")!.slug);
    expect(AUDIENCE_PREFILL.family).toBe(formats.find((f) => f.audience === "family")!.slug);
    expect(AUDIENCE_PREFILL.all).toBeNull();
  });

  it("выбор аудитории предзаполняет тип события и запоминается до закрытия вкладки", async () => {
    const data = setupBrowser();
    const { useBriefStore, AUDIENCE_KEY } = await freshStore();
    useBriefStore.getState().setAudience("family");
    expect(useBriefStore.getState().audience).toBe("family");
    expect(useBriefStore.getState().draft.eventType).toBe("kudalyk");
    expect(data.get(AUDIENCE_KEY)).toBe("family");
  });

  it("новый выбор заменяет предзаполнение развилки; «Посмотреть всё» его убирает", async () => {
    setupBrowser();
    const { useBriefStore } = await freshStore();
    const s = useBriefStore.getState();
    s.setAudience("corporate");
    expect(useBriefStore.getState().draft.eventType).toBe("conference");
    s.setAudience("family");
    expect(useBriefStore.getState().draft.eventType).toBe("kudalyk");
    s.setAudience("all");
    expect(useBriefStore.getState().draft.eventType).toBeUndefined();
  });

  it("тип события, выбранный человеком, развилка не трогает", async () => {
    setupBrowser();
    const { useBriefStore } = await freshStore();
    useBriefStore.getState().setField("eventType", "wedding");
    useBriefStore.getState().setAudience("corporate");
    expect(useBriefStore.getState().draft.eventType).toBe("wedding");
  });

  it("после перезагрузки выбор восстанавливается", async () => {
    setupBrowser({ "uly-dala:audience": "corporate" });
    const { useBriefStore } = await freshStore();
    useBriefStore.getState().hydrate();
    expect(useBriefStore.getState().audience).toBe("corporate");
  });

  it("мусор в хранилище игнорируется", async () => {
    setupBrowser({ "uly-dala:audience": "<script>" });
    const { useBriefStore } = await freshStore();
    useBriefStore.getState().hydrate();
    expect(useBriefStore.getState().audience).toBe("all");
  });
});
