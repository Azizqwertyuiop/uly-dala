"use client";

import { palette } from "@/styles/tokens";
import { SceneGroup } from "./primitives";
import type { SceneProps } from "./registry";

/* Примитив-заглушка главы «dawn». Рассвет: «конь» на правой трети у горизонта. TODO(assets): настоящая сцена. */
export default function DawnScene({ anchor }: SceneProps) {
  return (
    <SceneGroup anchor={anchor}>
      <mesh position={[3, 1.1, -40]}>
        <boxGeometry args={[2.4, 1.4, 0.6]} />
        <meshStandardMaterial color={palette.willow} />
      </mesh>
    </SceneGroup>
  );
}
