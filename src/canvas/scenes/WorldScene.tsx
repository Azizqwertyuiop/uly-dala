"use client";

import { palette } from "@/styles/tokens";
import { SceneGroup } from "./primitives";
import type { SceneProps } from "./registry";

/* Примитив-заглушка главы «world». Этот мир существует: огни фазенды в ночи. TODO(assets): настоящая сцена. */
export default function WorldScene({ anchor }: SceneProps) {
  return (
    <SceneGroup anchor={anchor}>
      <>
        {[-3, -1, 1, 3].map((x) => (
          <mesh key={x} position={[x, 1, -2]}>
            <sphereGeometry args={[0.35, 16, 16]} />
            <meshStandardMaterial
              color={palette.kumys}
              emissive={palette.kumys}
              emissiveIntensity={0.8}
            />
          </mesh>
        ))}
      </>
    </SceneGroup>
  );
}
