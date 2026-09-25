"use client";

import { palette } from "@/styles/tokens";
import { SceneGroup } from "./primitives";
import type { SceneProps } from "./registry";

/* Примитив-заглушка главы «assembly». Сборка: каркас юрты — цилиндр и купол. TODO(assets): настоящая сцена. */
export default function AssemblyScene({ anchor }: SceneProps) {
  return (
    <SceneGroup anchor={anchor}>
      <>
        <mesh position={[0, 1, 0]}>
          <cylinderGeometry args={[3, 3, 2, 24, 1, true]} />
          <meshStandardMaterial color={palette.willow} wireframe />
        </mesh>
        <mesh position={[0, 2.4, 0]}>
          <coneGeometry args={[3.1, 1.6, 24, 1, true]} />
          <meshStandardMaterial color={palette.willow} wireframe />
        </mesh>
      </>
    </SceneGroup>
  );
}
