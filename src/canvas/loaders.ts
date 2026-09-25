"use client";

import type { WebGLRenderer } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { BASIS_TRANSCODER_PATH, type Tier } from "./assets";

/*
 * Загрузчики моделей: glTF + KTX2 (Basis, транскодер локально) + meshopt (декодер в бандле).
 * Один KTX2Loader на страницу: ему нужен renderer для выбора целевого формата GPU.
 */

let renderer: WebGLRenderer | null = null;
let ktx2: KTX2Loader | null = null;
let gltf: GLTFLoader | null = null;
let tier: Tier = "high";

export function configureLoaders(gl: WebGLRenderer, quality: Tier) {
  renderer = gl;
  tier = quality;
  if (!ktx2) {
    ktx2 = new KTX2Loader().setTranscoderPath(BASIS_TRANSCODER_PATH).detectSupport(gl);
  }
}

export function currentTier(): Tier {
  return tier;
}

export function getGltfLoader(): GLTFLoader {
  if (!renderer || !ktx2) throw new Error("configureLoaders() не вызван");
  if (!gltf) {
    gltf = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  }
  return gltf;
}

const cache = new Map<string, ReturnType<GLTFLoader["loadAsync"]>>();

/** Загрузка с кэшем: предзагрузка сцены и её показ используют один и тот же промис. */
export function loadModel(url: string) {
  let promise = cache.get(url);
  if (!promise) {
    promise = getGltfLoader().loadAsync(url);
    cache.set(url, promise);
  }
  return promise;
}

export function forgetModel(url: string) {
  cache.delete(url);
}
