"use client";

import { palette } from "@/styles/tokens";
import { SceneGroup } from "./primitives";
import type { SceneProps } from "./registry";

/* Примитив-заглушка главы «day». День: шатёр события. TODO(assets): настоящая сцена. */
export default function DayScene({ anchor }: SceneProps) {
  return (
    <SceneGroup anchor={anchor}>
      <mesh position={[2, 1.5, 0]}>
        <boxGeometry args={[6, 3, 4]} />
        <meshStandardMaterial color={palette.felt} />
      </mesh>
    </SceneGroup>
  );
}
