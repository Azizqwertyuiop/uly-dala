import type { Camera, OrthographicCamera, Scene } from "three";

/*
 * «Реальный» слой (глава 5): фазенда (сплаты / видео облёта) и кадры архива — то, что снято
 * камерой, а не нарисовано. Рисуется в отдельный буфер и сводится в финальном проходе после AgX,
 * но с той же LUT, зерном, виньеткой и дизерингом (materials/post.ts) — единый грейд, без шва.
 */

export type RealView = { scene: Scene; camera: Camera; active: boolean };

export const realLayer = {
  /**
   * Фазенда: своя сцена и своя камера (облёт по зонам), рисуется только в полосе дорожки главы
   * (lightTop…lightBottom) — выше и ниже неё страница.
   */
  world: null as RealView | null,
  /** Экранная сцена плоскостей DOM-кадров: ортокамера в пикселях окна. */
  overlay: null as { scene: Scene; camera: OrthographicCamera; active: boolean } | null,
  /** Переход «свет» в фазенду: прогресс 0…1 и полоса экрана (CSS px сверху), где он идёт. */
  light: 1,
  lightTop: 0,
  lightBottom: 0,
};
