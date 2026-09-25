"use client";

import { palette } from "@/styles/tokens";
import { SceneGroup } from "./primitives";
import type { SceneProps } from "./registry";

/* Примитив-заглушка главы «fire». Огонь: очаг и дастархан (вид сверху). TODO(assets): настоящая сцена. */
export default function FireScene({ anchor }: SceneProps) {
  return (
    <SceneGroup anchor={anchor}>
      <>
        <mesh position={[0, 0.4, 0]} rotation-x={-Math.PI / 2}>
          <torusGeometry args={[0.8, 0.12, 12, 48]} />
          <meshStandardMaterial
            color={palette.ember}
            emissive={palette.ember}
            emissiveIntensity={0.6}
          />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[4, 0.1, 1.2]} />
          <meshStandardMaterial color={palette.willow} />
        </mesh>
      </>
    </SceneGroup>
  );
}
