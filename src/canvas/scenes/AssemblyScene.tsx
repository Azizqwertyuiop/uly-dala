"use client";

import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Model } from "./Model";
import { SceneGroup } from "./primitives";
import type { SceneProps } from "./registry";

/*
 * Глава «Сборка»: юрта с узлами kerege, uyki, shanyrak, kiiz, esik (финальные имена).
 * Сборка по скроллу — глава 2 (шаг 10). TODO(assets): модель художника.
 */
export default function AssemblyScene({ anchor, data }: SceneProps) {
  return (
    <SceneGroup anchor={anchor}>
      <Model gltf={data as GLTF} />
    </SceneGroup>
  );
}
