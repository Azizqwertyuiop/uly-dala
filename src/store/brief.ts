import { create } from "zustand";
import type { BriefValues, EventType, Source } from "@/lib/brief/model";

/*
 * Черновик брифа и модальное окно (CLAUDE.md, раздел 9).
 * Черновик — в sessionStorage (живёт до закрытия вкладки), с try/catch. Согласие не хранится:
 * оно всегда ставится явно. Стор создаётся только в браузере — на сервере его не трогаем,
 * чтобы данные разных посетителей не смешались.
 */

export const DRAFT_KEY = "uly-dala:brief-draft";
/** Выбор развилки главы 2 — до закрытия вкладки, как и черновик. */
export const AUDIENCE_KEY = "uly-dala:audience";

export type Audience = "corporate" | "family" | "all";

/**
 * Предзаполнение брифа развилкой: первый формат выбранной аудитории в главе «День»
 * (content/formats.ts; соответствие проверяет тест). «Посмотреть всё» — без предзаполнения.
 */
export const AUDIENCE_PREFILL: Record<Audience, EventType | null> = {
  corporate: "conference",
  family: "kudalyk",
  all: null,
};

const isAudience = (value: unknown): value is Audience =>
  value === "corporate" || value === "family" || value === "all";

type BriefState = {
  draft: BriefValues;
  hydrated: boolean;
  audience: Audience;
  /** Тип события, который подставила развилка (а не человек) — его можно заменить новым выбором. */
  audiencePrefill: EventType | null;
  modal: { open: boolean; source: Source; key: number };
  setField: <K extends keyof BriefValues>(field: K, value: BriefValues[K]) => void;
  merge: (values: BriefValues) => void;
  prefill: (values: BriefValues) => void;
  clear: () => void;
  setAudience: (audience: Audience) => void;
  openModal: (source: Source, prefill?: { eventType?: EventType }) => void;
  closeModal: () => void;
  hydrate: () => void;
};

function save(draft: BriefValues) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Хранилище недоступно — черновик просто не переживёт перезагрузку.
  }
}

function load(): BriefValues {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as BriefValues) : {};
  } catch {
    return {};
  }
}

export const useBriefStore = create<BriefState>()((set, get) => ({
  draft: {},
  hydrated: false,
  audience: "all",
  audiencePrefill: null,
  modal: { open: false, source: "brief", key: 0 },

  setField: (field, value) => {
    const draft = { ...get().draft, [field]: value };
    save(draft);
    set({ draft });
  },

  merge: (values) => {
    const draft = { ...get().draft, ...values };
    save(draft);
    set({ draft });
  },

  // Предзаполнение из CTA: не перетирает то, что человек уже выбрал сам.
  prefill: (values) => {
    const current = get().draft;
    const draft = { ...current };
    for (const [key, value] of Object.entries(values) as [keyof BriefValues, string][]) {
      if (value && !current[key]) (draft as Record<string, string>)[key] = value;
    }
    save(draft);
    set({ draft });
  },

  clear: () => {
    try {
      window.sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    set({ draft: {} });
  },

  // Развилка: порядок форматов (FormatTabs), формулировки CTA (AudienceText) и предзаполнение брифа.
  // Тип события, выбранный человеком, развилка не трогает.
  setAudience: (audience) => {
    try {
      window.sessionStorage.setItem(AUDIENCE_KEY, audience);
    } catch {
      // Хранилище недоступно — выбор просто не переживёт перезагрузку.
    }
    const { draft, audiencePrefill } = get();
    const next = AUDIENCE_PREFILL[audience];
    if (!draft.eventType || draft.eventType === audiencePrefill) {
      const updated = { ...draft };
      if (next) updated.eventType = next;
      else delete updated.eventType;
      save(updated);
      set({ draft: updated });
    }
    set({ audience, audiencePrefill: next });
  },

  openModal: (source, prefill) => {
    if (prefill?.eventType) get().prefill({ eventType: prefill.eventType });
    set({ modal: { open: true, source, key: get().modal.key + 1 } });
  },

  closeModal: () => set({ modal: { ...get().modal, open: false } }),

  hydrate: () => {
    if (get().hydrated) return;
    let audience = get().audience;
    try {
      const stored = window.sessionStorage.getItem(AUDIENCE_KEY);
      if (audience === "all" && isAudience(stored)) audience = stored;
    } catch {
      // ignore
    }
    set({ draft: { ...load(), ...get().draft }, audience, hydrated: true });
  },
}));
