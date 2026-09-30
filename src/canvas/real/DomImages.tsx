"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  type Texture,
} from "three";
import { progress } from "@/motion/progress";
import { stageStats } from "../stats";
import { TRANSITIONS_GLSL, transitionIndex, type Transition } from "../materials/transitions";
import { realLayer } from "./layer";

/*
 * Кадры архива и реальные фото (глава 5) — WebGL-плоскости поверх <img> (CLAUDE.md, раздел 6):
 * <img> остаётся в DOM (доступность, alt, SEO, фолбэк без WebGL) и прячется, когда двойник готов
 * (data-gl="ready"). Плоскости рисуются в реальный слой — с той же LUT и зерном, что и сцена.
 * Загрузка — за 2 экрана до показа, выгрузка из GPU — дальше 5 экранов.
 * Появление — шейдерным переходом («туман» / «дым» / «свет», data-gl-transition) при попадании
 * в кадр; наведение на ссылку-рамку — масштаб 1,03 внутри неподвижной рамки за 800 мс.
 */

export const LOAD_SCREENS = 2;
export const UNLOAD_SCREENS = 5;
/** Длительность перехода появления, с. */
const REVEAL_S = 1.4;
/** Наведение: 1,03 за 800 мс (раздел 5). */
const HOVER_S = 0.8;

type Item = {
  img: HTMLImageElement;
  top: number;
  left: number;
  width: number;
  height: number;
  kind: Transition;
  mesh: Mesh | null;
  texture: Texture | null;
  loading: boolean;
  start: number | null;
  hover: number;
  hoverTarget: number;
  off: () => void;
};

const SELECTOR = "img[data-gl-image]";

function createMaterial(texture: Texture, kind: Transition) {
  return new ShaderMaterial({
    uniforms: {
      tImage: { value: texture },
      uReveal: { value: 0 },
      uKind: { value: transitionIndex(kind) },
      uHover: { value: 0 },
      uCover: { value: [1, 1] },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tImage;
      uniform float uReveal;
      uniform int uKind;
      uniform float uHover;
      uniform vec2 uCover;
      varying vec2 vUv;
      ${TRANSITIONS_GLSL}
      void main() {
        // object-fit: cover и масштаб 1,03 при наведении — внутри неподвижной рамки.
        vec2 uv = (vUv - 0.5) * uCover / (1.0 + 0.03 * uHover) + 0.5;
        if (uKind == 1) uv = smokeShift(uv, uReveal);
        vec4 c = texture2D(tImage, clamp(uv, 0.0, 1.0));
        float luma = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
        float m = reveal(uKind, vUv, luma, uReveal) * c.a;
        gl_FragColor = vec4(c.rgb * m, m);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    premultipliedAlpha: true,
  });
}

export function DomImages() {
  const size = useThree((s) => s.size);
  const world = useMemo(() => {
    const scene = new Scene();
    const camera = new OrthographicCamera(0, 1, 0, -1, -10, 10);
    const geometry = new PlaneGeometry(1, 1);
    return {
      scene,
      camera,
      geometry,
      items: new Map<HTMLImageElement, Item>(),
      loader: new TextureLoader(),
      time: 0,
      overlay: { scene, camera, active: false },
    };
  }, []);

  // Камера — пиксели окна: x вправо, y вниз (−y в сцене).
  useEffect(() => {
    const c = world.camera;
    c.left = 0;
    c.right = size.width;
    c.top = 0;
    c.bottom = -size.height;
    c.updateProjectionMatrix();
  }, [world, size.width, size.height]);

  // Реестр кадров: при появлении/исчезновении <img> и при ресайзе (размеры DOM — только тут).
  useEffect(() => {
    realLayer.overlay = world.overlay;
    const measure = () => {
      const y = window.scrollY;
      const found = new Set(document.querySelectorAll<HTMLImageElement>(SELECTOR));
      for (const [img, item] of world.items) {
        if (!found.has(img) || !img.isConnected) release(item, true);
      }
      for (const img of found) {
        let item = world.items.get(img);
        if (!item) {
          const link = img.closest("a");
          const on = () => item && (item.hoverTarget = 1);
          const offHover = () => item && (item.hoverTarget = 0);
          link?.addEventListener("pointerenter", on);
          link?.addEventListener("pointerleave", offHover);
          link?.addEventListener("focus", on);
          link?.addEventListener("blur", offHover);
          item = {
            img,
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            kind: (img.dataset.glTransition as Transition) || "fog",
            mesh: null,
            texture: null,
            loading: false,
            start: null,
            hover: 0,
            hoverTarget: 0,
            off: () => {
              link?.removeEventListener("pointerenter", on);
              link?.removeEventListener("pointerleave", offHover);
              link?.removeEventListener("focus", on);
              link?.removeEventListener("blur", offHover);
            },
          };
          world.items.set(img, item);
        }
        const r = img.getBoundingClientRect();
        item.top = r.top + y;
        item.left = r.left;
        item.width = r.width;
        item.height = r.height;
      }
    };
    const release = (item: Item, forget: boolean) => {
      if (item.mesh) {
        world.scene.remove(item.mesh);
        (item.mesh.material as ShaderMaterial).dispose();
        item.mesh = null;
      }
      item.texture?.dispose();
      item.texture = null;
      item.start = null;
      delete item.img.dataset.gl;
      if (forget) {
        item.off();
        world.items.delete(item.img);
      }
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(document.body);
    const mutations = new MutationObserver(measure);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    const items = world.items;
    return () => {
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", measure);
      for (const item of [...items.values()]) release(item, true);
      world.geometry.dispose();
      realLayer.overlay = null;
    };
  }, [world]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    world.time += dt;
    const vh = progress.viewportHeight || size.height;
    const scrollY = progress.scrollY;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = 0;
    let loaded = 0;
    for (const item of world.items.values()) {
      const topOnScreen = item.top - scrollY;
      // Расстояние от экрана в экранах (0 — пересекает экран).
      const gap = Math.max(0, topOnScreen - vh, -(topOnScreen + item.height)) / vh;

      if (gap <= LOAD_SCREENS && !item.texture && !item.loading && item.width > 0) {
        item.loading = true;
        world.loader.load(
          item.img.currentSrc || item.img.src,
          (texture) => {
            item.loading = false;
            if (!item.img.isConnected) return texture.dispose();
            texture.colorSpace = SRGBColorSpace;
            item.texture = texture;
            const mesh = new Mesh(world.geometry, createMaterial(texture, item.kind));
            mesh.frustumCulled = false;
            item.mesh = mesh;
            world.scene.add(mesh);
            // Кадр уже был виден как <img> (быстрая прокрутка) — без повторного появления.
            const top = item.top - progress.scrollY;
            const vh = progress.viewportHeight || window.innerHeight;
            if (top < vh && top + item.height > 0) item.start = world.time - REVEAL_S;
            item.img.dataset.gl = "ready";
          },
          undefined,
          () => (item.loading = false),
        );
      } else if (gap > UNLOAD_SCREENS && item.texture) {
        // Далеко — освобождаем память GPU; <img> снова видна как обычная картинка.
        if (item.mesh) {
          world.scene.remove(item.mesh);
          (item.mesh.material as ShaderMaterial).dispose();
          item.mesh = null;
        }
        item.texture.dispose();
        item.texture = null;
        item.start = null;
        delete item.img.dataset.gl;
      }

      const mesh = item.mesh;
      if (!mesh) continue;
      loaded++;
      const onScreen = gap === 0;
      mesh.visible = onScreen;
      if (!onScreen) continue;
      visible++;
      if (item.start === null) item.start = world.time;
      const u = (mesh.material as ShaderMaterial).uniforms;
      u.uReveal!.value = reduced ? 1 : Math.min(1, (world.time - item.start) / REVEAL_S);
      item.hover +=
        (item.hoverTarget - item.hover) * (reduced ? 1 : Math.min(1, dt / (HOVER_S / 3)));
      u.uHover!.value = item.hover;
      // object-fit: cover — соотношение сторон рамки и файла.
      const tex = item.texture!.image as { width: number; height: number };
      const rect = item.width / Math.max(1, item.height);
      const file = tex.width / Math.max(1, tex.height);
      u.uCover!.value = rect > file ? [1, file / rect] : [rect / file, 1];
      mesh.scale.set(item.width, item.height, 1);
      mesh.position.set(item.left + item.width / 2, -(topOnScreen + item.height / 2), 0);
    }
    world.overlay.active = visible > 0;
    stageStats.realImages.loaded = loaded;
    stageStats.realImages.visible = visible;
    stageStats.realImages.tracked = world.items.size;
  }, 0);

  return null;
}
