/*
 * TS-копия дизайн-токенов из tokens.css (для 3D, canvas и расчётов).
 * Меняете здесь — меняйте и в tokens.css; расхождение ловит tokens.test.ts.
 */

export const palette = {
  felt: "#EDE6DA",
  wormwood: "#8A9283",
  indigo: "#1C2230",
  willow: "#6B4A33",
  kumys: "#F7F4EE",
  /** Единственный акцент, ≤ 2% площади экрана. */
  ember: "#E0602A",
} as const;

export type PaletteToken = keyof typeof palette;

export const breakpoints = { sm: 360, md: 768, lg: 1280, xl: 1920 } as const;

export const grid = { columns: 12, gutter: 24 } as const;

/** Шаг вертикального ритма, px. */
export const baseline = 8;

export const zIndex = { canvas: 0, content: 10, ui: 100, modal: 1000 } as const;
