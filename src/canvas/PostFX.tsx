"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import {
  HalfFloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  TextureLoader,
  WebGLRenderTarget,
} from "three";
import { ticker } from "@/motion/ticker";
import { assets } from "./assets";
import { createPostMaterial, grainFrame } from "./materials/post";
import { stageStats } from "./stats";

/*
 * Пост-процесс сцены: рендер в линейный HDR-буфер (MSAA на high) → финальный проход (post.ts).
 * useFrame с приоритетом 1 забирает рендер у R3F — кадр по-прежнему запускает ticker через advance().
 */
type Resources = {
  target: WebGLRenderTarget;
  quad: Scene;
  quadCamera: OrthographicCamera;
  material: ReturnType<typeof createPostMaterial>;
};

function createResources(msaa: boolean): Resources {
  const material = createPostMaterial(new TextureLoader().load(assets.blueNoise.url));
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: msaa ? 4 : 0 });
  const quad = new Scene();
  quad.add(new Mesh(new PlaneGeometry(2, 2), material));
  return { target, quad, quadCamera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), material };
}

export function PostFX({ msaa }: { msaa: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const res = useRef<Resources | null>(null);

  // Ресурсы GPU — вне рендера React: создаются и освобождаются в эффекте.
  useEffect(() => {
    const r = createResources(msaa);
    res.current = r;
    return () => {
      res.current = null;
      r.target.dispose();
      r.material.dispose();
      (r.material.uniforms.tBlueNoise!.value as { dispose: () => void }).dispose();
    };
  }, [msaa]);

  useEffect(() => {
    const r = res.current;
    if (!r) return;
    const w = Math.max(1, Math.floor(size.width * dpr));
    const h = Math.max(1, Math.floor(size.height * dpr));
    r.target.setSize(w, h);
    r.material.uniforms.uResolution!.value = [w, h];
  }, [size.width, size.height, dpr, msaa]);

  useFrame(() => {
    const r = res.current;
    if (!r) return;
    const u = r.material.uniforms;
    const frame = grainFrame(ticker.time);
    u.uGrainSeed!.value = frame % 1024;
    u.uNoiseOffset!.value = [(frame * 23) % 64, (frame * 41) % 64];
    gl.setRenderTarget(r.target);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    u.tScene!.value = r.target.texture;
    gl.clear();
    gl.render(r.quad, r.quadCamera);
    stageStats.post = "agx+lut+grain+vignette+dither";
  }, 1);

  return null;
}
