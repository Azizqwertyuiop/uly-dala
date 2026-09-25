"use client";

import { useEffect } from "react";
import type { Mesh, Object3D, Texture } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

/** Освобождает память GPU модели при выгрузке сцены (менеджер: dispose дальше двух глав). */
export function disposeObject(root: Object3D) {
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && typeof value === "object" && (value as Texture).isTexture)
          (value as Texture).dispose();
      }
      material.dispose();
    }
  });
}

/** Модель из glTF с освобождением памяти при размонтировании. */
export function Model({
  gltf,
  ...props
}: {
  gltf: GLTF;
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  useEffect(() => () => disposeObject(gltf.scene), [gltf]);
  return <primitive object={gltf.scene} {...props} />;
}
