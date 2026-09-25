"use client";

import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Model } from "./Model";
import { SceneGroup } from "./primitives";
import type { SceneProps } from "./registry";

/* Глава «День»: LED-стена в шатре (led_frame, led_screen) — не монолит в поле. */
export default function DayScene({ anchor, data }: SceneProps) {
  return (
    <SceneGroup anchor={anchor}>
      <Model gltf={data as GLTF} position={[2, 0, -1]} rotation={[0, -0.35, 0]} />
    </SceneGroup>
  );
}
