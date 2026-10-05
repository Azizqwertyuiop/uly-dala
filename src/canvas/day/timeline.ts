import { formats, type FormatSlug } from "@/content/formats";

/*
 * TODO(cleanup): сцены «Дня» больше нет — глава стала фото событий (шаг 20, CLAUDE.md, раздел 2).
 * Файл пока нужен только пути камеры (camera/path.ts, framing.ts, rig.ts): во время «Дня» холст
 * не рисует, ключи камеры там невидимы. Убрать вместе с ключами «Дня» при чистке пути камеры.
 *
 * Было: глава 3 «День» — одна сцена, шесть состояний (форматы).
 * Дорожка 300vh делится на шесть равных частей в порядке развилки (стор брифа).
 * Площадки стоят вдоль пути сбоку; камера проезжает мимо них, как одна длинная панорама.
 * Переходы — через свет и туман (завеса на границе состояний), без склеек: свет и время суток
 * меняются, пока кадр скрыт завесой. Всё — чистые функции прогресса дорожки p.
 */

export const DAY_STATES = formats.length;
export const STATE_SPAN = 1 / DAY_STATES;
/** Внутри состояния камера «стоит» на площадке в этой части; остальное — переезд. */
export const HOLD_FROM = 0.2;
export const HOLD_TO = 0.8;
/** Полуширина завесы на границе состояний, доли состояния. */
export const VEIL_HALF = 0.34;

export const DEFAULT_ORDER: readonly FormatSlug[] = formats.map((f) => f.slug);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const bump = (x: number) => (Math.abs(x) >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * x));

/** Текущее состояние (слот в порядке развилки) и прогресс внутри него. */
export function stateAt(p: number): { index: number; local: number } {
  const x = clamp01(p);
  const index = Math.min(DAY_STATES - 1, Math.floor(x / STATE_SPAN));
  return { index, local: clamp01((x - index * STATE_SPAN) / STATE_SPAN) };
}

/**
 * Завеса света и тумана 0…1: пик на каждой границе состояний и на входе в главу
 * («столп света из шаңырақа раскрывает пространство события», раздел 5).
 */
export function veil(p: number): number {
  const w = VEIL_HALF * STATE_SPAN;
  let v = p <= 0 ? 1 : bump(p / (HOLD_FROM * STATE_SPAN));
  for (let k = 1; k < DAY_STATES; k++) v = Math.max(v, bump((p - k * STATE_SPAN) / w));
  return v;
}

// ---------------------------------------------------------------------------
// Свет состояний: полдень, вечер свадьбы, тёплый интимный свет праздника
// ---------------------------------------------------------------------------

export type DayLight = {
  /** Высота солнца, градусы. */
  sun: number;
  /** 0 — полдень, 1 — тёплые сумерки (небо, трава, туман теплеют). */
  dusk: number;
  /** Приземный туман в покое. */
  fog: number;
  /** Экспозиция в покое. */
  exposure: number;
};

export const DAY_LIGHT: Record<FormatSlug, DayLight> = {
  conference: { sun: 48, dusk: 0, fog: 0.05, exposure: 1 },
  "coffee-break": { sun: 42, dusk: 0, fog: 0.05, exposure: 1 },
  "team-building": { sun: 55, dusk: 0, fog: 0.02, exposure: 1 },
  // Кудалык: мягкий рассеянный свет, белая ткань не пересвечена.
  kudalyk: { sun: 30, dusk: 0.08, fog: 0.1, exposure: 0.96 },
  // Свадьба — вечерний свет: солнце низко, тёплое.
  wedding: { sun: 5, dusk: 0.7, fog: 0.12, exposure: 1 },
  // Частный праздник — тёплые сумерки, свет гирлянд.
  "private-party": { sun: -2, dusk: 1, fog: 0.1, exposure: 1.08 },
};

export type DayLightState = DayLight & { veil: number; index: number; local: number };

export function createDayLight(): DayLightState {
  return { sun: 48, dusk: 0, fog: 0, exposure: 1, veil: 1, index: 0, local: 0 };
}

/**
 * Свет по прогрессу дорожки: свет соседних состояний смешивается внутри завесы
 * (кадр в этот момент в тумане), в покое — свет своего состояния. Память не выделяет.
 */
export function computeDayLight(
  p: number,
  order: readonly FormatSlug[],
  out: DayLightState,
): DayLightState {
  const { index, local } = stateAt(p);
  out.index = index;
  out.local = local;
  out.veil = veil(p);
  // Смешиваем с соседом, к которому ближе граница.
  const toNext = local >= 0.5 && index < DAY_STATES - 1;
  const other = toNext ? index + 1 : Math.max(0, index - 1);
  const border = toNext ? (index + 1) * STATE_SPAN : index * STATE_SPAN;
  const w = VEIL_HALF * STATE_SPAN * 0.5;
  const k =
    other === index
      ? 0
      : toNext
        ? smooth(border - w, border + w, p)
        : 1 - smooth(border - w, border + w, p);
  const a = DAY_LIGHT[order[index] ?? DEFAULT_ORDER[index]!];
  const b = DAY_LIGHT[order[other] ?? DEFAULT_ORDER[other]!];
  out.sun = a.sun + (b.sun - a.sun) * k;
  out.dusk = a.dusk + (b.dusk - a.dusk) * k;
  // Завеса: туман густеет, свет «вспыхивает» — переход через свет и туман.
  out.fog = a.fog + (b.fog - a.fog) * k + 0.85 * out.veil;
  out.exposure = (a.exposure + (b.exposure - a.exposure) * k) * (1 + 0.32 * out.veil);
  return out;
}

// ---------------------------------------------------------------------------
// Площадки и камера
// ---------------------------------------------------------------------------

/** Шаг площадок вдоль пути, м; площадки стоят справа от пути (+X), камера смотрит на них. */
export const SLOT_SPACING = 10;
export const SLOT_SIDE = 6;

/** Z центра площадки слота k относительно якоря главы «День». */
export const slotZ = (k: number) => 10 - k * SLOT_SPACING;

/** Центр площадки слота k относительно якоря главы «День» (x, y, z). */
export function slotCenter(k: number): [number, number, number] {
  return [SLOT_SIDE, 0, slotZ(k)];
}

export type Framing = {
  /** Камера относительно центра площадки, м. */
  position: [number, number, number];
  /** Цель взгляда относительно центра площадки, м (−Z — площадка правее в кадре, место тексту). */
  target: [number, number, number];
  focal: number;
  focus: number;
  /** Медленный наезд за время «стояния» на площадке, м. */
  dolly: [number, number, number];
};

/** Темп кудалыка — ×1.6 (раздел 5): наезд в 1,6 раза короче при том же скролле. */
export const KUDALYK_TEMPO = 1.6;

/**
 * Ракурс от центра содержимого площадки: камера на расстоянии distance со стороны −X (и чуть
 * по +Z), цель взгляда — центр со сдвигом −Z ~7% расстояния: площадка правее центра кадра,
 * слева — место тексту главы. Наезд — к площадке.
 */
function frame(
  center: [number, number, number],
  distance: number,
  height: number,
  over: Partial<Framing> = {},
): Framing {
  const [x, y, z] = center;
  return {
    position: [x - distance, height, z + distance * 0.09],
    target: [x, y, z - distance * 0.07],
    focal: 50,
    focus: distance,
    dolly: [0.9, 0, 0],
    ...over,
  };
}

export const DAY_FRAMING: Record<FormatSlug, Framing> = {
  // Шатёр 5,4 × 6 м открыт к камере: видны LED-стена и ряды стульев.
  conference: frame([1.5, 1.5, 0.6], 12.5, 1.65),
  "coffee-break": frame([0.6, 1.0, 0.8], 5.5, 1.5),
  // Открытая степь — шире, 35 мм.
  "team-building": frame([2.4, 0.5, 1.1], 6.6, 1.7, { focal: 35 }),
  // Кудалык: ближе и сверху — в кадре только руки и предметы; наезд короче (темп ×1.6).
  kudalyk: frame([0.3, 0.42, 0.9], 3.1, 1.5, { dolly: [0.9 / KUDALYK_TEMPO, 0, 0] }),
  wedding: frame([0.9, 1.15, 0.8], 6.7, 1.6),
  "private-party": frame([1.8, 0.9, 0.9], 7, 1.5),
};

/** Скошенная поляна под площадкой (локально: x, z, радиус): низкая мебель не тонет в ковыле. */
export const DAY_CLEARING: Record<FormatSlug, [number, number, number]> = {
  conference: [1.5, 0.6, 4.4],
  "coffee-break": [0.6, 0.8, 2.4],
  // Тимбилдинг — открытая степь: скошено только игровое поле.
  "team-building": [2.4, 1.1, 3.4],
  kudalyk: [0.3, 0.9, 2.9],
  wedding: [0.9, 0.8, 2.8],
  "private-party": [1.8, 0.9, 3.4],
};
