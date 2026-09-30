"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  CatmullRomCurve3,
  LinearFilter,
  Mesh,
  NoColorSpace,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Texture,
  TextureLoader,
  Vector3,
} from "three";
import type * as SparkModule from "@sparkjsdev/spark";
import { chapterTrack, progress } from "@/motion/progress";
import { Spring } from "@/motion/spring";
import { chapterTempo } from "@/motion/tokens";
import { assets } from "../assets";
import { focalToFov, lookAngles } from "../camera/path";
import { realLayer, type RealView } from "../real/layer";
import { stageStats } from "../stats";
import {
  flyoverPosition,
  flyoverTime,
  WORLD_ZONES,
  worldLight,
  zoneAt,
  zoneView,
} from "../world/timeline";
import type { SceneProps } from "./registry";

/*
 * Глава 5 «Этот мир существует» (CLAUDE.md, разделы 2, 6): реальная фазенда.
 * - high (десктоп, не iOS): Gaussian Splatting (Spark) — облёт по четырём зонам;
 * - medium: видео облёта, кадр ведёт скролл (перемотка), остановки — те же;
 * - fallback: фото в DOM (холста нет).
 * Фазенда — в «реальном» слое: своя сцена и камера, рисуется только в полосе дорожки главы,
 * проявляется переходом «свет» (по яркости) и получает ту же LUT и зерно, что и степь.
 */

const INDEX = 4;
const STAGE_SELECTOR = "[data-world-stage]";
/** Минимальная высота экрана дорожки (как в CSS .worldStage). */
const STAGE_MIN_HEIGHT = 560;
/** Перемотка видео — только если кадр ушёл дальше, с. */
const SEEK_EPSILON = 0.05;

type WorldData =
  { mode: "splats"; spark: typeof SparkModule; bytes: ArrayBuffer } | { mode: "video" };

type Content = {
  mode: "splats" | "video";
  cover: (aspect: number) => void;
  seek: (s: number) => void;
  dispose: () => void;
  state: () => string;
};

const FRAME_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const FRAME_FRAGMENT = /* glsl */ `
  uniform sampler2D tFrame;
  uniform vec2 uCover;
  varying vec2 vUv;
  vec3 srgbToLinear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  }
  void main() {
    vec2 uv = (vUv - 0.5) * uCover + 0.5;
    // Кадр — sRGB; в буфер реального слоя — линейный (как у сплатов и фото).
    gl_FragColor = vec4(srgbToLinear(texture2D(tFrame, uv).rgb), 1.0);
  }
`;

/*
 * Ночное небо за сплатами (как в облёте): съёмка его не содержит, а без него небо было бы
 * «дырой» в кадре — без зерна и виньетки, со швом по линии горизонта.
 */
const SKY_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  vec3 srgbToLinear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  }
  void main() {
    float k = smoothstep(0.35, 1.0, vUv.y);
    vec3 horizon = vec3(24.0, 22.0, 38.0) / 255.0;
    vec3 zenith = vec3(6.0, 8.0, 18.0) / 255.0;
    gl_FragColor = vec4(srgbToLinear(mix(horizon, zenith, k)), 1.0);
  }
`;

function createSplats(scene: Scene, data: Extract<WorldData, { mode: "splats" }>, gl: unknown) {
  const { SparkRenderer, SplatMesh, SplatFileType } = data.spark;
  const skyGeometry = new PlaneGeometry(2, 2);
  const skyMaterial = new ShaderMaterial({
    vertexShader: FRAME_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const sky = new Mesh(skyGeometry, skyMaterial);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  const spark = new SparkRenderer({ renderer: gl as SparkModule.SparkRendererOptions["renderer"] });
  const mesh = new SplatMesh({ fileBytes: data.bytes, fileType: SplatFileType.SPLAT });
  scene.add(sky, spark, mesh);
  let ready = false;
  void mesh.initialized.then(() => (ready = true));
  return {
    mode: "splats",
    cover: () => {},
    seek: () => {},
    dispose: () => {
      scene.remove(sky, spark, mesh);
      mesh.dispose();
      spark.dispose?.();
      skyGeometry.dispose();
      skyMaterial.dispose();
    },
    state: () => (ready ? "splats" : "splats-loading"),
  } satisfies Content;
}

/*
 * Видео облёта: не играет, а перематывается скроллом (currentTime ← позиция облёта).
 * Кадр загружается в GPU только после перемотки (seeked) — без загрузки каждый кадр.
 * Отказ видео (энергосбережение, кодек) → постер: кадр первой зоны.
 */
function createVideo(scene: Scene) {
  const asset = assets.fazendaFlyover;
  const video = document.createElement("video");
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.src = asset.url;

  const uniforms = { tFrame: { value: null as Texture | null }, uCover: { value: [1, 1] } };
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: FRAME_VERTEX,
    fragmentShader: FRAME_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const geometry = new PlaneGeometry(2, 2);
  const quad = new Mesh(geometry, material);
  quad.frustumCulled = false;
  scene.add(quad);

  // Цвет декодирует шейдер (srgbToLinear) — у текстур пространство «как есть».
  const poster = new TextureLoader().load(asset.poster, (t) => {
    if (!uniforms.tFrame.value) uniforms.tFrame.value = t;
  });
  poster.colorSpace = NoColorSpace;
  const frame = new Texture(video);
  frame.colorSpace = NoColorSpace;
  // Без мип-уровней и без мип-фильтра: иначе текстура «неполная» и читается чёрной.
  frame.generateMipmaps = false;
  frame.minFilter = LinearFilter;

  let state: "loading" | "video" | "poster" = "loading";
  let wanted = 0;
  const upload = () => {
    if (state === "poster" || video.readyState < 2) return;
    // three берёт размер кадра из width/height элемента (у <video> это атрибуты, а не кадр).
    video.width = video.videoWidth;
    video.height = video.videoHeight;
    state = "video";
    frame.needsUpdate = true;
    uniforms.tFrame.value = frame;
  };
  const fail = () => {
    state = "poster";
    uniforms.tFrame.value = poster;
  };
  video.addEventListener("loadeddata", upload);
  video.addEventListener("seeked", upload);
  video.addEventListener("error", fail);
  // iOS отдаёт кадры приглушённого видео только после play(): запуск и сразу пауза.
  void video.play().then(
    () => {
      video.pause();
      video.currentTime = wanted;
    },
    () => (video.readyState >= 2 ? undefined : fail()),
  );

  return {
    mode: "video",
    cover: (aspect: number) => {
      const file = asset.aspect;
      uniforms.uCover.value = aspect > file ? [1, file / aspect] : [aspect / file, 1];
    },
    seek: (s: number) => {
      wanted = flyoverTime(s);
      if (state === "poster" || video.seeking || video.readyState < 1) return;
      if (Math.abs(video.currentTime - wanted) > SEEK_EPSILON) video.currentTime = wanted;
    },
    dispose: () => {
      video.removeEventListener("loadeddata", upload);
      video.removeEventListener("seeked", upload);
      video.removeEventListener("error", fail);
      video.pause();
      video.removeAttribute("src");
      video.load();
      scene.remove(quad);
      geometry.dispose();
      material.dispose();
      frame.dispose();
      poster.dispose();
    },
    state: () => state,
  } satisfies Content;
}

export default function WorldScene({ data }: SceneProps) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const world = data as WorldData;

  const view = useMemo(() => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(focalToFov(50), 16 / 9, 0.1, 400);
    const views = WORLD_ZONES.map(zoneView);
    const v3 = (p: readonly number[]) => new Vector3(p[0], p[1], p[2]);
    return {
      scene,
      camera,
      real: { scene, camera, active: false } as RealView,
      position: new CatmullRomCurve3(
        views.map((v) => v3(v.position)),
        false,
        "centripetal",
      ),
      target: new CatmullRomCurve3(
        views.map((v) => v3(v.target)),
        false,
        "centripetal",
      ),
      p: new Spring(0, chapterTempo.world.cameraSmoothing),
      started: false,
      pos: new Vector3(),
      look: new Vector3(),
      forward: new Vector3(),
      angles: { yaw: 0, pitch: 0 },
      reduced:
        typeof window === "undefined"
          ? null
          : window.matchMedia("(prefers-reduced-motion: reduce)"),
      dom: { stage: null as HTMLElement | null, zone: "" },
    };
  }, []);

  const content = useMemo<Content>(
    () => (world.mode === "splats" ? createSplats(view.scene, world, gl) : createVideo(view.scene)),
    [world, view, gl],
  );

  useEffect(() => {
    realLayer.world = view.real;
    return () => {
      content.dispose();
      if (realLayer.world === view.real) realLayer.world = null;
      realLayer.light = 1;
    };
  }, [view, content]);

  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    view.camera.aspect = aspect;
    view.camera.updateProjectionMatrix();
    content.cover(aspect);
  }, [view, content, size.width, size.height]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const v = view;
    const reduced = v.reduced?.matches ?? false;
    const index = progress.chapterIndex;
    const target = index === INDEX ? progress.track : index > INDEX ? 1 : 0;
    if (!v.started || reduced) {
      v.p.snap(target);
      v.started = true;
    } else {
      v.p.target = target;
      v.p.update(dt);
    }
    const p = v.p.value;

    // Полоса экрана дорожки: закреплённый экран (sticky) — без чтения DOM в кадре.
    const track = chapterTrack("world");
    const cinematic = document.documentElement.hasAttribute("data-cinematic");
    const vh = progress.viewportHeight || size.height;
    const stageH = Math.max(vh, STAGE_MIN_HEIGHT);
    let top = 0;
    let bottom = 0;
    if (track && cinematic) {
      const stuck = Math.min(
        Math.max(progress.scrollY, track.top),
        track.top + track.height - stageH,
      );
      top = stuck - progress.scrollY;
      bottom = top + stageH;
    }
    const onScreen = bottom > 0 && top < size.height;
    const light = reduced ? (p > 0 ? 1 : 0) : worldLight(p);
    realLayer.lightTop = top;
    realLayer.lightBottom = bottom;
    realLayer.light = light;
    v.real.active = onScreen && light > 0 && index >= INDEX - 1;

    // Облёт: позиция s → камера на сплайне зон; reduced motion — сразу остановка зоны.
    const flown = flyoverPosition(p);
    const s = reduced ? zoneAt(flown) : flown;
    const last = WORLD_ZONES.length - 1;
    const clamped = Math.min(last, Math.max(0, s));
    v.position.getPoint(clamped / last, v.pos);
    v.target.getPoint(clamped / last, v.look);
    // До первой и после последней зоны — медленный наезд по линии взгляда.
    v.forward.subVectors(v.look, v.pos).normalize();
    v.pos.addScaledVector(v.forward, (s - clamped) * 8);
    const cam = v.camera;
    cam.position.copy(v.pos);
    lookAngles(v.pos, v.look, v.angles);
    // Порядок YXZ и z = 0: крен ровно ноль (раздел 5).
    cam.rotation.set(v.angles.pitch, v.angles.yaw, 0, "YXZ");
    if (v.real.active) content.seek(s);

    // DOM: текущая зона — у экрана дорожки (плашки зон).
    const zone = WORLD_ZONES[zoneAt(s)]!;
    const d = v.dom;
    if (d.stage && !d.stage.isConnected) {
      d.stage = null;
      d.zone = "";
    }
    d.stage ??= document.querySelector<HTMLElement>(STAGE_SELECTOR);
    if (d.stage && d.zone !== zone) {
      d.zone = zone;
      d.stage.dataset.zone = zone;
    }

    const w = stageStats.world;
    w.mode = content.state();
    w.p = p;
    w.zone = zoneAt(s);
    w.light = light;
    w.roll = cam.rotation.z;
  }, 0);

  return null;
}
