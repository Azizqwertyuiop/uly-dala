/*
 * Сеты главы «Огонь» (CLAUDE.md, раздел 2): кофе-брейк, банкет, традиционный.
 * Здесь — структура: блюдо, его место на дастархане (вид сверху) и форма заглушки.
 * Тексты — в messages (fire.dishes.<set>.<dish>). TODO(client-data): меню подтверждает шеф.
 *
 * Дастархан 4,1 × 1,3 м, центр — (0, 0): x — вдоль стола, z — поперёк (−z — дальний край).
 */

export const menuSets = ["coffeeBreak", "banquet", "traditional"] as const;
export type MenuSet = (typeof menuSets)[number];

/** Форма заглушки блюда в 3D (модели — TODO(assets)). */
export type DishKind = "cup" | "bowl" | "plate" | "platter" | "board" | "pot" | "jug" | "fruit";

export type Dish = {
  id: string;
  /** Центр на столе, м. */
  x: number;
  z: number;
  /** Радиус (для формы и области наведения), м. */
  r: number;
  kind: DishKind;
  /** Цвет «еды» (линейный sRGB hex). */
  food: number;
};

export const menu: Record<MenuSet, Dish[]> = {
  coffeeBreak: [
    { id: "coffee", x: -1.35, z: -0.25, r: 0.16, kind: "pot", food: 0x3b2418 },
    { id: "pastry", x: -0.55, z: 0.2, r: 0.24, kind: "board", food: 0xc98a4a },
    { id: "fruit", x: 0.25, z: -0.2, r: 0.2, kind: "fruit", food: 0xd9a441 },
    { id: "sandwiches", x: 1.0, z: 0.22, r: 0.26, kind: "platter", food: 0xb9a37a },
    { id: "lemonade", x: 1.7, z: -0.25, r: 0.12, kind: "jug", food: 0xe0b35a },
    { id: "tea", x: -1.75, z: 0.3, r: 0.1, kind: "cup", food: 0x6b3a1e },
  ],
  banquet: [
    { id: "salads", x: -1.4, z: 0, r: 0.22, kind: "bowl", food: 0x6f8a45 },
    { id: "starters", x: -0.6, z: -0.25, r: 0.24, kind: "platter", food: 0xc8a068 },
    { id: "hot", x: 0.2, z: 0.05, r: 0.3, kind: "platter", food: 0x8a4a2a },
    { id: "bread", x: 0.95, z: -0.28, r: 0.18, kind: "board", food: 0xc9955a },
    { id: "dessert", x: 1.6, z: 0.1, r: 0.2, kind: "plate", food: 0xe7d2b0 },
    { id: "drinks", x: -1.85, z: -0.35, r: 0.1, kind: "jug", food: 0x9a3b2e },
  ],
  traditional: [
    { id: "beshbarmak", x: 0, z: 0, r: 0.34, kind: "platter", food: 0xd8c29a },
    { id: "kazy", x: -0.9, z: -0.25, r: 0.22, kind: "platter", food: 0x8a3a30 },
    { id: "baursak", x: 0.9, z: 0.22, r: 0.22, kind: "bowl", food: 0xc98a4a },
    { id: "kurt", x: -1.55, z: 0.25, r: 0.14, kind: "bowl", food: 0xefe9dc },
    { id: "fruit", x: 1.6, z: -0.22, r: 0.2, kind: "fruit", food: 0xd9a441 },
    { id: "tea", x: -0.6, z: 0.35, r: 0.1, kind: "cup", food: 0x7a4a2a },
  ],
};
