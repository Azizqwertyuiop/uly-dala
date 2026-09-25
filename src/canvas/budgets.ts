/*
 * Бюджеты размера (CLAUDE.md, раздел 12). Байты — как по сети (со сжатием).
 * Проверяются: статически — src/canvas/assets.test.ts, по реальному трафику — e2e/budgets.spec.ts.
 */
export const MB = 1024 * 1024;

export const BUDGETS = {
  /** Первая загрузка: HTML, CSS, JS, шрифты, кадры, three.js и сцена первой главы. */
  firstLoad: 3 * MB,
  /** Первая сцена: всё 3D, догружаемое после load (код + ассеты главы «Рассвет»). */
  firstScene: 2.5 * MB,
  /** Любая другая глава: её код и ассеты. */
  chapter: 4 * MB,
} as const;
