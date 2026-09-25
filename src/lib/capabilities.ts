/*
 * Уровни качества (CLAUDE.md, раздел 6): high / medium / fallback.
 * fallback — Canvas не монтируется, остаются статичные кадры (режим без WebGL).
 *
 * Логика — чистые функции (тестируются без браузера); readDeviceProfile() собирает данные в браузере.
 */

export type Quality = "high" | "medium" | "fallback";

export type DeviceProfile = {
  webgl2: boolean;
  /** Строка GPU из WEBGL_debug_renderer_info (может быть пустой). */
  gpu: string;
  /** navigator.deviceMemory, ГБ (нет в Safari/Firefox). */
  memoryGb: number | null;
  coarsePointer: boolean;
  saveData: boolean;
  /** navigator.connection.effectiveType. */
  network: string | null;
  userAgent: string;
  /** Для iPadOS, который притворяется Mac. */
  maxTouchPoints: number;
  devicePixelRatio: number;
  /** ?quality=high|medium|fallback — ручное переопределение (тесты, отладка). */
  override: Quality | null;
};

export type InAppBrowser = "whatsapp" | "telegram" | "instagram" | "facebook" | null;

export function detectInAppBrowser(ua: string): InAppBrowser {
  if (/WhatsApp/i.test(ua)) return "whatsapp";
  if (/Telegram/i.test(ua)) return "telegram";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";
  return null;
}

export function isIOS(ua: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1);
}

export function isFirefox(ua: string): boolean {
  return /Firefox\//i.test(ua) && !/Seamonkey/i.test(ua);
}

/** Программный рендер: WebGL есть, но считает процессор — для 3D этого мало. */
export function isSoftwareRenderer(gpu: string): boolean {
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render Driver|Microsoft Basic/i.test(gpu);
}

/** Встроенная графика ноутбуков/ПК — medium; мобильные GPU определяются по указателю. */
export function isIntegratedGpu(gpu: string): boolean {
  return /Intel|UHD|Iris|HD Graphics|Radeon\(TM\) Graphics|Vega \d+ Graphics|Mali|Adreno|PowerVR/i.test(
    gpu,
  );
}

export type QualityDecision = { quality: Quality; reasons: string[] };

export function decideQuality(p: DeviceProfile): QualityDecision {
  if (p.override) return { quality: p.override, reasons: ["override"] };

  const reasons: string[] = [];
  const fallback = (reason: string): QualityDecision => ({
    quality: "fallback",
    reasons: [reason],
  });

  if (!p.webgl2) return fallback("no-webgl2");
  if (isSoftwareRenderer(p.gpu)) return fallback("software-renderer");
  if (p.saveData) return fallback("save-data");
  if (p.network === "slow-2g" || p.network === "2g") return fallback("slow-network");
  if (p.memoryGb !== null && p.memoryGb <= 2) return fallback("low-memory");

  let quality: Quality = "high";
  const inApp = detectInAppBrowser(p.userAgent);
  if (inApp) {
    reasons.push(`in-app:${inApp}`);
    // Встроенный браузер на слабом устройстве — сразу статика.
    if (p.memoryGb !== null && p.memoryGb <= 4) return fallback(`in-app:${inApp}+low-memory`);
    quality = "medium";
  }
  if (isIOS(p.userAgent, p.maxTouchPoints)) {
    reasons.push("ios");
    quality = "medium";
  }
  if (p.coarsePointer) {
    reasons.push("touch");
    quality = "medium";
  }
  if (p.memoryGb !== null && p.memoryGb <= 4) {
    reasons.push("memory<=4");
    quality = "medium";
  }
  if (p.network === "3g") {
    reasons.push("3g");
    quality = "medium";
  }
  if (isIntegratedGpu(p.gpu)) {
    reasons.push("integrated-gpu");
    quality = "medium";
  }
  return { quality, reasons };
}

// ---------------------------------------------------------------------------
// Бюджет пикселей и DPR
// ---------------------------------------------------------------------------

/** Бюджет пикселей рендера, мегапиксели (раздел 6: не только DPR). */
export const PIXEL_BUDGET: Record<Exclude<Quality, "fallback">, number> = {
  high: 3.5e6,
  medium: 2e6,
};

/** Предел DPR: десктоп ≤ 2, мобильные ≤ 1.5. */
export function dprCap(coarsePointer: boolean): number {
  return coarsePointer ? 1.5 : 2;
}

/**
 * Pixel ratio рендера: меньше из DPR устройства, предела DPR и бюджета пикселей,
 * умноженный на масштаб динамического разрешения.
 */
export function renderPixelRatio(opts: {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  coarsePointer: boolean;
  quality: Exclude<Quality, "fallback">;
  scale: number;
}): number {
  const area = Math.max(1, opts.cssWidth * opts.cssHeight);
  const byBudget = Math.sqrt(PIXEL_BUDGET[opts.quality] / area);
  const ratio = Math.min(opts.devicePixelRatio, dprCap(opts.coarsePointer), byBudget);
  return Math.max(0.25, ratio * opts.scale);
}

// ---------------------------------------------------------------------------
// Динамическое разрешение
// ---------------------------------------------------------------------------

/** Целевой fps: high ≥ 58, medium ≥ 45 (раздел 12). */
export const TARGET_FPS: Record<Exclude<Quality, "fallback">, number> = { high: 58, medium: 45 };

export const RESOLUTION_MIN = 0.7;
export const RESOLUTION_STEP = 0.1;
export const RESOLUTION_WINDOW = 60;

/** Прогрев после старта сцены (компиляция шейдеров, загрузка) — не судим по нему о GPU, с. */
export const RESOLUTION_WARMUP = 2;
/** Сколько окон подряд на уровне цели нужно, чтобы вернуть разрешение вверх. */
export const RESOLUTION_RECOVER_WINDOWS = 3;

/**
 * Среднее fps за 60 кадров ниже цели → масштаб рендера вниз шагами до 0.7.
 * Три окна подряд на уровне цели — на шаг обратно вверх (на экране 60 Гц fps не бывает выше 60,
 * поэтому «с запасом» не требуем). Первые 2 с после старта не учитываются.
 */
export class DynamicResolution {
  scale = 1;
  private frames = 0;
  private elapsed = 0;
  private good = 0;

  constructor(
    public targetFps: number,
    private warmup = RESOLUTION_WARMUP,
  ) {}

  /** dt — секунды кадра. Возвращает true, если масштаб изменился. */
  sample(dt: number): boolean {
    if (dt <= 0) return false;
    if (this.warmup > 0) {
      this.warmup -= dt;
      return false;
    }
    this.frames++;
    this.elapsed += dt;
    if (this.frames < RESOLUTION_WINDOW) return false;
    const fps = this.frames / this.elapsed;
    this.frames = 0;
    this.elapsed = 0;
    const before = this.scale;
    if (fps < this.targetFps) {
      this.good = 0;
      this.scale = Math.max(RESOLUTION_MIN, round1(this.scale - RESOLUTION_STEP));
    } else if (this.scale < 1 && ++this.good >= RESOLUTION_RECOVER_WINDOWS) {
      this.good = 0;
      this.scale = Math.min(1, round1(this.scale + RESOLUTION_STEP));
    }
    return this.scale !== before;
  }
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Firefox в первые 3 с держит меньше 50 fps → medium (раздел 6).
 * Возвращает true, когда решение принято (дальше не проверяем).
 */
export class FirefoxProbe {
  private elapsed = 0;
  private frames = 0;
  downgrade = false;
  done = false;

  sample(dt: number): boolean {
    if (this.done) return false;
    this.elapsed += dt;
    this.frames++;
    if (this.elapsed >= 3) {
      this.done = true;
      this.downgrade = this.frames / this.elapsed < 50;
    }
    return this.done;
  }
}

/** Лимит памяти GPU под сцены, МБ. iOS — не больше 300 МБ одновременно (раздел 6). */
export function gpuMemoryLimitMb(quality: Exclude<Quality, "fallback">, ios: boolean): number {
  if (ios) return 300;
  return quality === "high" ? 1024 : 512;
}

// ---------------------------------------------------------------------------
// Браузер
// ---------------------------------------------------------------------------

function readOverride(): Quality | null {
  try {
    const value = new URLSearchParams(window.location.search).get("quality");
    return value === "high" || value === "medium" || value === "fallback" ? value : null;
  } catch {
    return null;
  }
}

export function readDeviceProfile(): DeviceProfile {
  let webgl2 = false;
  let gpu = "";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    webgl2 = Boolean(gl);
    if (gl) {
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      gpu = String(
        info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      );
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    webgl2 = false;
  }
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  return {
    webgl2,
    gpu,
    memoryGb: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    coarsePointer: window.matchMedia("(pointer: coarse)").matches,
    saveData: Boolean(nav.connection?.saveData),
    network: nav.connection?.effectiveType ?? null,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    devicePixelRatio: window.devicePixelRatio || 1,
    override: readOverride(),
  };
}
