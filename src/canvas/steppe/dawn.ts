import { MathUtils } from "three";

/*
 * Глава 1 «Рассвет» (CLAUDE.md, раздел 2) — вся логика без WebGL: чистые функции.
 *
 * Интро (раздел 2, таймлайн от загрузки) отсчитывается от готовности 3D-сцены: к этому моменту
 * прелоадер-горизонт уже прочерчен, а статичный кадр показан, поэтому время сдвинуто на −1,5 с:
 *   0,0–1,0  небо, туман, силуэт гор          (в разделе 2: 1,5–2,5 с)
 *   1,0–2,0  силуэт коня с контровой линией    (2,5–3,5 с)
 *   2,0–3,5  серебряная волна — только первый визит (3,5–5,0 с)
 *   2,7      текст проявляется светом          (4,2 с)
 *   4,5      подсказка скролла                 (6,0 с)
 * CTA и хедер видны и кликабельны сразу — анимация их не ждёт.
 *
 * Скролл главы (150vh, local 0…1): восход, туман рассеивается, текст уходит, 135 → 50 мм
 * (кривая камеры), конь смотрит в камеру и уходит шагом.
 */

export const INTRO = {
  sky: [0, 1] as const,
  horse: [1, 2] as const,
  wave: [2, 3.5] as const,
  text: 2.7,
  hint: 4.5,
  /** После этого интро закончено. */
  end: 4.5,
};

/** Серебряная волна: откуда (м от камеры) и докуда катится фронт. */
export const WAVE_FROM = 2400;
export const WAVE_TO = -20;

export type HorseClip = "idle" | "look" | "walk";

export type DawnInputs = {
  /** Прогресс главы 0…1 (progress.local, пока текущая глава — «Рассвет»). */
  local: number;
  /** Секунды с готовности сцены; null — интро нет (восстановление, reduced motion). */
  introTime: number | null;
  /** Первый визит: волна показывается один раз. */
  waveEnabled: boolean;
};

export type DawnState = {
  /** 0…1 — проявление неба, тумана и гор. */
  skyReveal: number;
  horseAlpha: number;
  /** Расстояние фронта волны от камеры, м; < WAVE_TO — волны нет. */
  waveFront: number;
  /** 0…1 — сила волны (серебро ости). */
  waveStrength: number;
  /** Высота солнца над горизонтом, градусы (−1° — за конём, ниже горизонта). */
  sunElevation: number;
  exposure: number;
  /** Плотность приземного тумана (1 — густой). */
  groundFog: number;
  /** Текст первого экрана уходит (вверх с затуханием). */
  textOut: boolean;
  /** Проявить текст светом (интро дошло до 4,2 с). */
  textReveal: boolean;
  horseClip: HorseClip;
  /** 0…1 — насколько конь ушёл. */
  horseWalk: number;
  hintVisible: boolean;
  introDone: boolean;
};

const smooth = (edge0: number, edge1: number, x: number) => MathUtils.smoothstep(x, edge0, edge1);

export function computeDawnState({ local, introTime, waveEnabled }: DawnInputs): DawnState {
  const t = introTime ?? Infinity;
  const done = t >= INTRO.end;

  let waveFront = WAVE_TO - 1;
  let waveStrength = 0;
  if (waveEnabled && t >= INTRO.wave[0] && t <= INTRO.wave[1]) {
    const w = (t - INTRO.wave[0]) / (INTRO.wave[1] - INTRO.wave[0]);
    // Кривая steppe (появление): фронт быстро выходит из-за горизонта и мягко доходит до камеры.
    const eased = 1 - (1 - w) ** 3;
    waveFront = WAVE_FROM + (WAVE_TO - WAVE_FROM) * eased;
    waveStrength = Math.sin(w * Math.PI);
  }

  return {
    skyReveal: smooth(INTRO.sky[0], INTRO.sky[1], t),
    horseAlpha: smooth(INTRO.horse[0], INTRO.horse[1], t) * (1 - smooth(0.85, 1, local)),
    waveFront,
    waveStrength,
    sunElevation: MathUtils.lerp(-1, 3, smooth(0, 1, local)),
    exposure: MathUtils.lerp(0.9, 1.35, smooth(0, 1, local)),
    groundFog: MathUtils.lerp(1, 0.25, smooth(0.1, 0.8, local)),
    textOut: local > 0.3,
    textReveal: t >= INTRO.text,
    horseClip: local < 0.35 ? "idle" : local < 0.55 ? "look" : "walk",
    horseWalk: smooth(0.55, 1, local),
    hintVisible: introTime !== null && t >= INTRO.hint && local < 0.02,
    introDone: done,
  };
}

// ---------------------------------------------------------------------------
// Композиция первого экрана (раздел 2)
// ---------------------------------------------------------------------------

/** Горизонт — на 72% высоты экрана сверху, на мобильных (портрет) — на 68%. */
export function horizonFraction(aspect: number): number {
  return aspect < 1 ? 0.68 : 0.72;
}

/**
 * Тангаж камеры (рад), при котором линия горизонта встаёт на нужную долю высоты.
 * Горизонт — направление с тангажом 0: его экранная координата y_ndc = −tan(pitch)/tan(fov/2).
 */
export function horizonPitch(fovDeg: number, aspect: number): number {
  const ndc = 1 - 2 * horizonFraction(aspect);
  return Math.atan(-ndc * Math.tan(MathUtils.degToRad(fovDeg) / 2));
}

/** Дистанция до коня, м (раздел 2: ~250–300 м). */
export const HORSE_DISTANCE = 275;

/** Смещение коня вправо (м) на правую треть кадра при данной оптике и пропорциях экрана. */
export function horseOffsetX(fovDeg: number, aspect: number, distance = HORSE_DISTANCE): number {
  const halfWidth = Math.tan(MathUtils.degToRad(fovDeg) / 2) * aspect * distance;
  return halfWidth / 3; // x_ndc = +1/3 — правая треть
}

// ---------------------------------------------------------------------------
// Переход Рассвет → Сборка: шаг коня (раздел 6: ритм 0,6 с, только на переходе, 40vh)
// ---------------------------------------------------------------------------

export const STEP_PERIOD = 0.6;
export const STEP_AMPLITUDE = 0.012; // м

// ---------------------------------------------------------------------------
// Утро «Сборки» (07:00): степь та же, солнце выше, туман уходит
// ---------------------------------------------------------------------------

/** Свет прибывает на переходе Рассвет → Сборка — по положению на горизонте. */
export const MORNING_FROM = 0.12;
export const MORNING_TO = 0.24;

export type MorningState = {
  daylight: number;
  sunElevation: number;
  groundFog: number;
  exposure: number;
};

/**
 * dawn — состояние рассвета (его конец), horizon — прогресс сайта, track — дорожка «Сборки» 0…1.
 * Всё непрерывно: при daylight = 0 утро совпадает с концом рассвета (без склейки).
 */
export function computeMorning(
  dawn: Pick<DawnState, "sunElevation" | "groundFog" | "exposure">,
  horizon: number,
  track: number,
  out: MorningState = { daylight: 0, sunElevation: 0, groundFog: 0, exposure: 1 },
): MorningState {
  const daylight = smooth(MORNING_FROM, MORNING_TO, horizon);
  out.daylight = daylight;
  out.sunElevation = dawn.sunElevation + daylight * (4 + 3 * MathUtils.clamp(track, 0, 1));
  out.groundFog = dawn.groundFog * (1 - 0.8 * daylight);
  // Поверхности степи светлеют сами (dayGain в шейдерах); экспозиция возвращается к 1 —
  // юрта и остальная сцена под тем же динамическим светом, что и в других главах.
  out.exposure = MathUtils.lerp(dawn.exposure, 1, daylight);
  return out;
}

/** Вертикальное покачивание камеры «шагом»; transition — 0…1 внутри 40vh перехода. */
export function stepBob(time: number, transition: number): number {
  if (transition <= 0 || transition >= 1) return 0;
  const envelope = Math.sin(transition * Math.PI);
  // Шаг — «удар» и отскок: |sin| даёт два касания за период, как у идущего коня.
  return -Math.abs(Math.sin((time / STEP_PERIOD) * Math.PI)) * STEP_AMPLITUDE * envelope;
}

// ---------------------------------------------------------------------------
// Серебряная волна — один раз (флаг в localStorage с try/catch)
// ---------------------------------------------------------------------------

export const WAVE_SEEN_KEY = "uly-dala:wave-seen";

export function waveAlreadySeen(): boolean {
  try {
    return window.localStorage.getItem(WAVE_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWaveSeen(): void {
  try {
    window.localStorage.setItem(WAVE_SEEN_KEY, "1");
  } catch {
    // Хранилище недоступно — волна может показаться снова, это не ошибка.
  }
}
