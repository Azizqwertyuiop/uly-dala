"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { MathUtils, type Group, type Mesh, type Object3D } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { input } from "@/motion/input";
import { progress } from "@/motion/progress";
import { Spring } from "@/motion/spring";
import { ticker } from "@/motion/ticker";
import { isSoftwareRenderer } from "@/lib/capabilities";
import { currentTier } from "../loaders";
import { createAlphaVideoMaterial } from "../materials/alphaVideoMaterial";
import { grade, STEPPE_LAYER } from "../PostFX";
import { stageStats } from "../stats";
import { createAtmosphere, sunDirection } from "../steppe/atmosphere";
import { steppeOverride } from "../steppe/control";
import {
  computeDawnState,
  computeMorning,
  HORSE_DISTANCE,
  horseOffsetX,
  markWaveSeen,
  waveAlreadySeen,
} from "../steppe/dawn";
import { createBlades, createCards, createGrassShared } from "../steppe/grass";
import { HorseClips } from "../steppe/horse";
import { createMountains, createSky } from "../steppe/sky";
import { createTerrain, terrainHeight } from "../steppe/terrain";
import { WindField } from "../steppe/wind";
import { disposeObject } from "./Model";
import type { SceneProps } from "./registry";

/*
 * Глава 1 «Рассвет» (CLAUDE.md, раздел 2): степь, ковыль, ветер, небо с горами и туманом, конь.
 * Весь мир рассвета — на слое STEPPE_LAYER (рисуется только внутри секции «Рассвет»).
 */

const DAWN_FOV = 2 * Math.atan(24 / (2 * 135)) * (180 / Math.PI);
const CAMERA_Z = 12; // камера первого кадра (path.ts, dawnFrame)
const HERO_SELECTOR = "[data-hero-text]";
const HOVER_SELECTOR = "[data-dawn-hover]";

function setLayer(root: Object3D) {
  root.traverse((node) => node.layers.set(STEPPE_LAYER));
}

export default function DawnScene({ data }: SceneProps) {
  const gltf = data as GLTF;
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const tier = currentTier();

  const world = useMemo(() => {
    const atmosphere = createAtmosphere();
    const shared = createGrassShared();
    const sky = createSky(atmosphere);
    const mountains = createMountains(atmosphere);
    const terrain = createTerrain(atmosphere);
    const blades = createBlades(atmosphere, tier, shared);
    const cards = createCards(atmosphere, tier, shared);
    const wind = new WindField();
    atmosphere.tWind.value = wind.texture;
    const horseMaterial = createAlphaVideoMaterial();
    // Программный рендер (SwiftShader в CI, принудительный ?quality=) — травы в 25 раз меньше,
    // иначе кадр рисуется секундами. Реальные посетители с таким рендером получают fallback.
    const ctx = gl.getContext();
    const info = ctx.getExtension("WEBGL_debug_renderer_info");
    const gpu = String(ctx.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : ctx.RENDERER));
    if (isSoftwareRenderer(gpu)) {
      blades.mesh.geometry.instanceCount = Math.round(blades.mesh.geometry.instanceCount / 25);
      cards.mesh.geometry.instanceCount = Math.round(cards.mesh.geometry.instanceCount / 25);
    }
    return { atmosphere, shared, sky, mountains, terrain, blades, cards, wind, horseMaterial };
  }, [gl, tier]);

  const root = useRef<Group>(null);
  const horseRoot = useRef<Group>(null);

  // Слой степи и материал коня.
  useEffect(() => {
    if (root.current) setLayer(root.current);
    const plane = gltf.scene.getObjectByName("horse_plane") as Mesh | undefined;
    if (plane) plane.material = world.horseMaterial;
    setLayer(gltf.scene);
  }, [gltf, world]);

  // Клипы коня, hover на CTA, поле ветра для тестов; уборка при выгрузке главы.
  useEffect(() => {
    const clips = new HorseClips(tier, (texture) => {
      world.horseMaterial.uniforms.map!.value = texture;
    });
    clips.show("idle");

    const boost = new Spring(1, 0.12); // 240 мс, steppe
    const targets = [...document.querySelectorAll<HTMLElement>(HOVER_SELECTOR)];
    const on = () => (boost.target = 1.08);
    const off = () => (boost.target = 1);
    const canHover = window.matchMedia("(hover: hover)").matches;
    for (const el of targets) {
      if (canHover) {
        el.addEventListener("pointerenter", on);
        el.addEventListener("pointerleave", off);
      }
      el.addEventListener("focus", on);
      el.addEventListener("blur", off);
    }

    stageStats.windProbe = () => world.wind.probe(gl);
    state.current = { clips, boost };
    return () => {
      clips.dispose();
      for (const el of targets) {
        el.removeEventListener("pointerenter", on);
        el.removeEventListener("pointerleave", off);
        el.removeEventListener("focus", on);
        el.removeEventListener("blur", off);
      }
      stageStats.windProbe = null;
      grade.exposure = 1;
      delete document.documentElement.dataset.introHint;
      world.wind.dispose();
      [world.sky, world.terrain, world.blades, world.cards, ...world.mountains].forEach(
        ({ mesh, material }) => {
          mesh.geometry.dispose();
          material.dispose();
        },
      );
      world.horseMaterial.dispose();
      disposeObject(gltf.scene);
    };
  }, [gl, gltf, tier, world]);

  const state = useRef<{ clips: HorseClips; boost: Spring } | null>(null);
  const intro = useRef<{
    start: number | null;
    decided: boolean;
    wave: boolean;
    textSent: boolean;
  }>({
    start: null,
    decided: false,
    wave: false,
    textSent: false,
  });
  const morning = useRef({ daylight: 0, sunElevation: 0, groundFog: 0, exposure: 1 });
  const dom = useRef<{ hero: HTMLElement | null; textOut: boolean | null; hint: boolean }>({
    hero: null,
    textOut: null,
    hint: false,
  });

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const html = document.documentElement;
    const inDawn = progress.chapterId === "dawn";
    const local = inDawn ? progress.local : progress.chapterIndex > 0 ? 1 : 0;

    // Интро — от готовности сцены, один раз; пропускается при восстановлении и reduced motion.
    const i = intro.current;
    if (!i.decided && html.dataset.canvas === "ready") {
      i.decided = true;
      const skip = stageStats.introSkipped || reduced || !inDawn || progress.scrollY > 4;
      i.start = skip ? null : ticker.time;
      i.wave = !skip && !waveAlreadySeen();
      if (i.wave) markWaveSeen();
    }
    const introTime = i.start === null ? null : ticker.time - i.start;
    const s = computeDawnState({
      local,
      introTime: i.decided ? introTime : 0,
      waveEnabled: i.wave,
    });

    // Проявление текста светом — по таймлайну (4,2 с) или сразу, если интро нет.
    if (i.decided && !i.textSent && s.textReveal) {
      i.textSent = true;
      window.dispatchEvent(new Event("uly:intro-text"));
    }

    // Атмосфера. Степь продолжается под «Сборкой»: утро 07:00 (солнце выше, туман уходит).
    const track = progress.chapterIndex === 1 ? progress.track : progress.chapterIndex > 1 ? 1 : 0;
    const m = computeMorning(s, progress.horizon, track, morning.current);
    const a = world.atmosphere;
    a.uTime.value += reduced ? 0 : dt;
    a.uSkyReveal.value = s.skyReveal;
    const aspect = size.width / Math.max(size.height, 1);
    const horseX = horseOffsetX(DAWN_FOV, aspect);
    const o = steppeOverride;
    const clearings = world.shared.uClearings.value;
    for (let k = 0; k < clearings.length; k++) {
      const c = o.active ? o.clearings[k]! : null;
      clearings[k]!.set(c ? c[0] : 0, c ? c[1] : 0, c ? c[2] : 0);
    }
    if (o.active && progress.chapterIndex >= 2) {
      // «День» и дальше: время суток и завесу задаёт сцена главы.
      a.uSunElevation.value = o.sunElevation;
      a.uGroundFog.value = o.groundFog;
      a.uDaylight.value = 1;
      a.uDusk.value = o.dusk;
      sunDirection(o.sunX, o.sunZ, o.sunElevation, a.uSunDir.value);
    } else {
      a.uSunElevation.value = m.sunElevation;
      a.uGroundFog.value = m.groundFog;
      a.uDaylight.value = m.daylight;
      a.uDusk.value = 0;
      sunDirection(horseX, -HORSE_DISTANCE, m.sunElevation, a.uSunDir.value);
    }
    const boost = state.current?.boost;
    if (boost) {
      if (reduced) boost.snap();
      else boost.update(dt);
      a.uDawnBoost.value = boost.value;
    }
    world.shared.uWave.value = [s.waveFront, s.waveStrength];
    world.terrain.material.uniforms.uWave!.value = [s.waveFront, s.waveStrength];
    world.shared.uSway.value = reduced ? 0 : 1;
    world.shared.uNearClip.value = MathUtils.mapLinear(stageStats.camera.fov, 10.2, 27, 6, 1.5);
    grade.exposure =
      progress.chapterIndex <= 1 ? m.exposure : steppeOverride.active ? steppeOverride.exposure : 1;

    // Рельеф следует за камерой с шагом 4 м.
    const cam = camera.position;
    world.terrain.material.uniforms.uCenter!.value = [
      Math.round(cam.x / 4) * 4,
      Math.round(cam.z / 4) * 4,
    ];

    // Ветер: курсор / палец + программные порывы, затухание по delta.
    const forwardX = -Math.sin(camera.rotation.y);
    const forwardZ = -Math.cos(camera.rotation.y);
    if (!reduced && input.active) world.wind.pointer(camera, input.x, input.y, input.vx, input.vy);
    world.wind.update(gl, dt, { x: cam.x, z: cam.z, forwardX, forwardZ }, !reduced);
    a.tWind.value = world.wind.texture;
    a.uWindOrigin.value.copy(world.wind.origin);

    // Конь: правая треть кадра, ~275 м; уходит шагом, тонет в утреннем тумане.
    state.current?.clips.show(s.horseClip);
    if (horseRoot.current) {
      const z = CAMERA_Z - HORSE_DISTANCE - s.horseWalk * 140;
      const x = horseX + s.horseWalk * 6;
      horseRoot.current.position.set(x, terrainHeight(x, z), z);
      horseRoot.current.rotation.y = Math.atan2(-x, CAMERA_Z - z);
    }
    const hu = world.horseMaterial.uniforms;
    hu.opacity!.value = s.horseAlpha;
    hu.uFogAmount!.value = MathUtils.clamp(0.06 + s.groundFog * 0.32, 0, 0.6);

    // DOM: уход текста и подсказка скролла — атрибуты пишутся только при изменении.
    const d = dom.current;
    d.hero ??= document.querySelector<HTMLElement>(HERO_SELECTOR);
    if (d.hero && d.textOut !== s.textOut) {
      d.textOut = s.textOut;
      d.hero.dataset.exit = String(s.textOut);
    }
    if (d.hint !== s.hintVisible) {
      d.hint = s.hintVisible;
      if (s.hintVisible) html.dataset.introHint = "";
      else delete html.dataset.introHint;
    }

    stageStats.dawn.introTime = introTime;
    stageStats.dawn.wave = s.waveStrength > 0;
    stageStats.dawn.clip = s.horseClip;
    stageStats.dawn.textOut = s.textOut;
  }, 0);

  return (
    <group ref={root}>
      <primitive object={world.sky.mesh} />
      {world.mountains.map(({ mesh }) => (
        <primitive key={mesh.name} object={mesh} />
      ))}
      <primitive object={world.terrain.mesh} />
      <primitive object={world.blades.mesh} />
      <primitive object={world.cards.mesh} />
      <group ref={horseRoot}>
        <primitive object={gltf.scene} />
      </group>
    </group>
  );
}
