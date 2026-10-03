"use client";

import type { WebGLRenderer } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { DeviceProfile } from "@/lib/capabilities";
import { BASIS_TRANSCODER_PATH, KTX2_WORKER_URL, type Tier } from "./assets";

/*
 * Загрузчики моделей: glTF + KTX2 (Basis, транскодер локально) + meshopt (декодер в бандле).
 * Один KTX2Loader на страницу: ему нужен renderer для выбора целевого формата GPU.
 */

let renderer: WebGLRenderer | null = null;
let ktx2: KTX2Loader | null = null;
let gltf: GLTFLoader | null = null;
let tier: Tier = "high";
let profile: DeviceProfile | null = null;

export function configureLoaders(gl: WebGLRenderer, quality: Tier, device?: DeviceProfile) {
  renderer = gl;
  tier = quality;
  if (device) profile = device;
  if (!ktx2) {
    ktx2 = withFileWorker(
      new KTX2Loader().setTranscoderPath(BASIS_TRANSCODER_PATH).detectSupport(gl),
    );
  }
}

/** Внутренности KTX2Loader, которые подменяются (three 0.186). */
type KTX2Internals = {
  init: () => Promise<void>;
  workerPool: { setWorkerCreator: (create: () => Worker) => void };
  workerConfig: unknown;
  transcoderBinary: ArrayBuffer;
};

/*
 * Воркер транскодера — из файла, а не из blob: (CSP, раздел 14). Транскодер Basis использует
 * new Function, а blob-воркер наследует CSP страницы без 'unsafe-eval'. Файл ktx2-worker.js —
 * тот же код, что собирает KTX2Loader, и отдаётся со своей узкой CSP (next.config.ts).
 * init() по-прежнему грузит wasm и передаёт его воркеру тем же сообщением.
 */
function withFileWorker(loader: KTX2Loader): KTX2Loader {
  const l = loader as unknown as KTX2Internals;
  const init = l.init.bind(loader);
  l.init = () =>
    init().then(() => {
      l.workerPool.setWorkerCreator(() => {
        const worker = new Worker(KTX2_WORKER_URL);
        const transcoderBinary = l.transcoderBinary.slice(0);
        worker.postMessage({ type: "init", config: l.workerConfig, transcoderBinary }, [
          transcoderBinary,
        ]);
        return worker;
      });
    });
  return loader;
}

export function currentTier(): Tier {
  return tier;
}

/** Профиль устройства (для решений загрузчиков: сплаты — только где можно). */
export function currentProfile(): DeviceProfile | null {
  return profile;
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
