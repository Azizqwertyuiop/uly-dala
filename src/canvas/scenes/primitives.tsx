"use client";

import type { SceneProps } from "./registry";

/*
 * Общие детали примитивов-заглушек. Настоящие сцены (раздел 6) заменят их целиком.
 * Все объекты — справа от центра кадра, чтобы не спорить с текстом слева. Земли и фона нет:
 * текст главы лежит на фоне секции, контраст не меняется (раздел 10).
 */
export function SceneGroup({ anchor, children }: SceneProps & { children: React.ReactNode }) {
  return <group position={anchor}>{children}</group>;
}
