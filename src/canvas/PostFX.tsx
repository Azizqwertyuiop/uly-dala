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
import { chapterBounds, chapterTrack, progress } from "@/motion/progress";
import { ticker } from "@/motion/ticker";
import { assets } from "./assets";
import { createPostMaterial, grainFrame } from "./materials/post";
import { stageStats } from "./stats";

/*
 * Пост-процесс сцены: рендер в линейный HDR-буфер (MSAA на high) → финальный проход (post.ts).
 * useFrame с приоритетом 1 забирает рендер у R3F — кадр по-прежнему запускает ticker через advance().
 *
 * Степь (небо, рельеф, трава, конь, юрта, площадки «Дня») — слой STEPPE_LAYER: рисуется только
 * в своих полосах (scissor): от верха «Рассвета» до конца дорожки «Сборки» (юрта встаёт в той же
 * степи) и на дорожке «Дня». Между ними и дальше страница — обычные блоки: фон и контраст не меняются.
 * Прямоугольник — из измеренных границ глав и дорожек, без чтения DOM в кадре.
 */

export const STEPPE_LAYER = 1;
const STEPPE_CHAPTER = 0;

/** Цветокоррекция кадра: экспозиция — через таймлайн глав (раздел 6). */
export const grade = { exposure: 1 };
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

  /** Слой степи в полосе документа [top, bottom] (px), обрезанной экраном. */
  const renderSteppe = (r: Resources, docTop: number, docBottom: number) => {
    const top = Math.max(docTop - progress.scrollY, 0);
    const bottom = Math.min(docBottom - progress.scrollY, size.height);
    if (bottom <= top) return;
    const ratio = r.target.height / size.height;
    gl.setScissorTest(true);
    r.target.scissorTest = true;
    r.target.scissor.set(0, (size.height - bottom) * ratio, r.target.width, (bottom - top) * ratio);
    gl.setRenderTarget(r.target);
    camera.layers.set(STEPPE_LAYER);
    gl.render(scene, camera);
    r.target.scissorTest = false;
    gl.setScissorTest(false);
    gl.setRenderTarget(r.target);
  };

  useFrame(() => {
    const r = res.current;
    if (!r) return;
    const u = r.material.uniforms;
    const frame = grainFrame(ticker.time);
    u.uGrainSeed!.value = frame % 1024;
    u.uNoiseOffset!.value = [(frame * 23) % 64, (frame * 41) % 64];
    u.uExposure!.value = grade.exposure;
    gl.setRenderTarget(r.target);
    gl.setClearColor(0x000000, 0);
    gl.clear();
    const autoClear = gl.autoClear;
    gl.autoClear = false;

    // 1) Степь — только в своих прямоугольниках: рассвет + дорожка «Сборки», дорожка «Дня».
    const b = chapterBounds()[STEPPE_CHAPTER];
    if (b && progress.chapterId !== null) {
      const assembly = chapterTrack("assembly");
      const day = chapterTrack("day");
      const firstEnd = assembly
        ? Math.max(b.top + b.height, assembly.top + assembly.height)
        : b.top + b.height;
      renderSteppe(r, b.top, firstEnd);
      if (day) renderSteppe(r, day.top, day.top + day.height);
    }
    // 2) Всё остальное — без ограничений.
    camera.layers.set(0);
    gl.render(scene, camera);
    gl.autoClear = autoClear;
    gl.setRenderTarget(null);
    u.tScene!.value = r.target.texture;
    gl.clear();
    gl.render(r.quad, r.quadCamera);
    stageStats.post = "agx+lut+grain+vignette+dither";
  }, 1);

  return null;
}
