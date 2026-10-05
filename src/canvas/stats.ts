/*
 * Сводка состояния сцены: для отладочной панели (?debug) и e2e-тестов (window.__stage).
 * Персональных данных здесь нет.
 */
export const stageStats = {
  quality: "off" as string,
  context: "ok" as "ok" | "lost" | "fallback",
  current: null as string | null,
  loaded: [] as string[],
  compiled: [] as string[],
  memoryMb: 0,
  introSkipped: false,
  frames: 0,
  /** Рендер стоит: сцены на экране нет (раздел 12). */
  idle: false,
  renderMs: 0,
  gpuMs: null as number | null,
  drawCalls: 0,
  geometries: 0,
  textures: 0,
  pixelRatio: 1,
  resolutionScale: 1,
  post: "",
  /** Средняя энергия поля ветра (чтение с GPU по запросу — для тестов). */
  windProbe: null as null | (() => number),
  dawn: {
    introTime: null as number | null,
    wave: false,
    clip: "",
    textOut: false,
    fps: 0,
    video: false,
    /** Видео коня сейчас играет (декодируется). */
    decoding: false,
  },
  camera: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 0, pose: 0 },
  /** Кадры реального слоя (архив): отслеживаются, загружены в GPU, видны. */
  realImages: { tracked: 0, loaded: 0, visible: 0 },
  /** Фазенда: способ показа (splats / video / photo), прогресс дорожки, зона, «свет». */
  world: { mode: "", p: 0, zone: 0, light: 0, roll: 0 },
  return: { p: 0, stars: 0, predawn: 0, pressed: 0, handoff: 0, active: false },
  /** Огонь: прогресс, фаза, насколько вид «орто», фокусное, сет, блюдо под курсором. */
  fire: { p: 0, phase: "", ortho: 0, focal: 50, set: "", hover: "", night: 0 },
  /** Сборка: прогресс сцены (после притяжения), этап и сводка деталей 0…1. */
  assembly: {
    p: 0,
    phase: "",
    snapping: false,
    yaw: 0,
    kerege: 0,
    uyki: 0,
    shanyrak: 0,
    kiiz: 0,
    pillar: 0,
  },
};

if (typeof window !== "undefined") {
  (window as unknown as { __stage: typeof stageStats }).__stage = stageStats;
}
