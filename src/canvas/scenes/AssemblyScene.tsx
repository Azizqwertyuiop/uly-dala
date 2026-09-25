"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { progress } from "@/motion/progress";
import { Model } from "./Model";
import { SceneGroup } from "./primitives";
import type { SceneProps } from "./registry";

/*
 * Глава «Сборка»: юрта с узлами kerege, uyki, shanyrak, kiiz, esik (финальные имена).
 * Сборка по скроллу — глава 2 (шаг 10). TODO(assets): модель художника.
 * Пока идёт «Рассвет», юрты нет: степь пуста, камера только подходит к кругу примятой травы.
 */
export default function AssemblyScene({ anchor, data }: SceneProps) {
  const root = useRef<Group>(null);
  useFrame(() => {
    if (root.current) root.current.visible = progress.chapterIndex >= 1;
  });
  return (
    <SceneGroup anchor={anchor}>
      <group ref={root}>
        <Model gltf={data as GLTF} />
      </group>
    </SceneGroup>
  );
}
