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
  renderMs: 0,
  gpuMs: null as number | null,
  drawCalls: 0,
  geometries: 0,
  textures: 0,
  pixelRatio: 1,
  resolutionScale: 1,
  camera: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, fov: 0 },
};

if (typeof window !== "undefined") {
  (window as unknown as { __stage: typeof stageStats }).__stage = stageStats;
}
