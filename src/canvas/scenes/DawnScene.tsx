"use client";

import { useEffect, useMemo } from "react";
import type { Mesh } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { assets } from "../assets";
import { currentTier } from "../loaders";
import { createAlphaVideoMaterial } from "../materials/alphaVideoMaterial";
import { createAlphaVideo } from "../video";
import { disposeObject } from "./Model";
import { SceneGroup } from "./primitives";
import type { SceneProps } from "./registry";

/*
 * Глава «Рассвет»: плоскость видеотекстуры коня (узел horse_plane) с тестовым видео и постером.
 * TODO(assets): офлайн-рендер коня (docs/assets.md) заменит тестовое видео с тем же именем узла.
 */
export default function DawnScene({ anchor, data }: SceneProps) {
  const gltf = data as GLTF;
  const material = useMemo(() => createAlphaVideoMaterial(), []);

  useEffect(() => {
    const plane = gltf.scene.getObjectByName("horse_plane") as Mesh | undefined;
    if (plane) plane.material = material;
    const video = createAlphaVideo(assets.horse, currentTier(), (texture) => {
      material.uniforms.map!.value = texture;
    });
    return () => {
      video.dispose();
      material.dispose();
      disposeObject(gltf.scene);
    };
  }, [gltf, material]);

  return (
    <SceneGroup anchor={anchor}>
      {/* Правая треть кадра, ~40 м — под 135 мм конь пересекает горизонт. */}
      <primitive object={gltf.scene} position={[3, 0, -40]} rotation={[0, -0.25, 0]} />
    </SceneGroup>
  );
}
