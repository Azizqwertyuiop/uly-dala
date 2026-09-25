"use client";

import { palette } from "@/styles/tokens";
import { SceneGroup } from "./primitives";
import type { SceneProps } from "./registry";

/* Примитив-заглушка главы «return». Снова рассвет: круг примятой травы. TODO(assets): настоящая сцена. */
export default function ReturnScene({ anchor }: SceneProps) {
  return (
    <SceneGroup anchor={anchor}>
      <mesh position={[3, 0.02, -40]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[2, 2.4, 48]} />
        <meshStandardMaterial color={palette.felt} />
      </mesh>
    </SceneGroup>
  );
}
