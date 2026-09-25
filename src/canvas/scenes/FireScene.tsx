"use client";

import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { palette } from "@/styles/tokens";
import { Model } from "./Model";
import { SceneGroup } from "./primitives";
import type { SceneProps } from "./registry";

/* Глава «Огонь»: дастархан (dastarkhan_left/right/table) и очаг-заглушка. */
export default function FireScene({ anchor, data }: SceneProps) {
  return (
    <SceneGroup anchor={anchor}>
      <Model gltf={data as GLTF} />
      <mesh position={[2.8, 0.2, 0]} rotation-x={-Math.PI / 2}>
        <torusGeometry args={[0.5, 0.1, 12, 48]} />
        <meshStandardMaterial
          color={palette.ember}
          emissive={palette.ember}
          emissiveIntensity={2}
        />
      </mesh>
    </SceneGroup>
  );
}
