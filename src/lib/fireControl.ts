import type { MenuSet } from "@/content/menu";

/*
 * Связь DOM ↔ сцена «Огня» без перерисовок React в кадре: выбранный сет и блюдо под курсором
 * или в фокусе. DOM пишет, сцена читает в своём кадре (подъём блюда на 1%, контровой +30%).
 */
export const fireControl = {
  set: "traditional" as MenuSet,
  hover: null as string | null,
};

/** Блюдо под курсором / в фокусе (null — никакое). */
export function setFireHover(id: string | null): void {
  fireControl.hover = id;
}

/** Выбранный сет. */
export function setFireSet(set: MenuSet): void {
  fireControl.set = set;
}
