/*
 * Зоны фазенды-заглушки (x, z, м) — общие для сплатов (generate-splat.mjs) и сцены
 * (src/canvas/world/timeline.ts, тест сверяет). TODO(client-data): настоящие зоны по съёмке.
 */
export const ZONES = { field: [0, 0], tent: [-7, -9], yurt: [6, -12], kitchen: [0, -19] };
