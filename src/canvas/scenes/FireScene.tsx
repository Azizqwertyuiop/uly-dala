"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { PMREMGenerator, Vector3, type Group, type Object3D } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { fireControl } from "@/lib/fireControl";
import { chapterTrack, progress } from "@/motion/progress";
import { Spring } from "@/motion/spring";
import { chapterTempo } from "@/motion/tokens";
import { trackT } from "../camera/path";
import { scenePose } from "../camera/scenePose";
import { createFirePose, firePose, HEARTH, PHASE, PLAN_CENTER } from "../fire/camera";
import { createHearth } from "../fire/hearth";
import { createTable } from "../fire/table";
import { computeFireLight, createFireLight } from "../fire/timeline";
import { hearth as hearthLight } from "../hearth";
import { currentTier } from "../loaders";
import { STEPPE_LAYER } from "../PostFX";
import { stageStats } from "../stats";
import { steppeOverride } from "../steppe/control";
import { terrainHeight } from "../steppe/terrain";
import type { SceneProps } from "./registry";

/*
 * Глава 4 «Огонь» (CLAUDE.md, раздел 2): очаг и дастархан в той же степи, закат → ночь.
 * Кадр: прогресс дорожки → сглаживание по темпу главы → свет и ночь степи → поза камеры
 * (dolly zoom в вид сверху, передаётся в CameraRig) → очаг, стол, подписи блюд (DOM).
 * Подписи блюд — кнопки в DOM над своими блюдами: позиция — проекция 3D → экран (--xy).
 */

const STAGE_SELECTOR = "[data-fire-stage]";
const NARROW = 768;

function setLayer(root: Object3D) {
  root.traverse((node) => node.layers.set(STEPPE_LAYER));
}

const phaseOf = (p: number) =>
  p < PHASE.gather[1]
    ? "gather"
    : p < PHASE.macro[1]
      ? "macro"
      : p < PHASE.dolly[1]
        ? "dolly"
        : "plan";

export default function FireScene({ anchor, data }: SceneProps) {
  const dastarkhan = data as GLTF;
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const tier = currentTier();
  const [ax, , az] = anchor;

  const world = useMemo(() => {
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    pmrem.dispose();
    return {
      env,
      hearth: createHearth(env.texture, tier),
      table: createTable(dastarkhan, env.texture),
    };
  }, [gl, dastarkhan, tier]);

  const frame = useMemo(
    () => ({
      p: new Spring(0, chapterTempo.fire.cameraSmoothing),
      light: createFireLight(),
      pose: createFirePose(),
      reduced:
        typeof window === "undefined"
          ? null
          : window.matchMedia("(prefers-reduced-motion: reduce)"),
      started: false,
      shown: false,
      time: 0,
      point: new Vector3(),
      dom: {
        stage: null as HTMLElement | null,
        phase: "",
        set: "",
        hotspots: [] as { el: HTMLElement; x: number; y: number }[],
      },
    }),
    [],
  );
  const root = useRef<Group>(null);

  // Шейдеры — заранее, в фоне; скрытые блюда других сетов тоже.
  useEffect(() => {
    const dishes = Object.values(world.table.sets).flat();
    const was = dishes.map((d) => d.group.visible);
    dishes.forEach((d) => (d.group.visible = true));
    if (root.current) void gl.compileAsync(root.current, camera, scene);
    dishes.forEach((d, i) => (d.group.visible = was[i]!));
  }, [world, gl, camera, scene]);

  useEffect(() => {
    if (root.current) setLayer(root.current);
    return () => {
      world.hearth.dispose();
      world.table.dispose();
      world.env.dispose();
      scenePose.active = false;
      if (hearthLight.light) hearthLight.light.intensity = 0;
    };
  }, [world]);

  useEffect(() => {
    if (root.current) root.current.position.y = terrainHeight(ax + PLAN_CENTER[0], az);
  }, [ax, az]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const f = frame;
    const reduced = f.reduced?.matches ?? false;
    f.time += reduced ? 0 : dt;
    const index = progress.chapterIndex;
    const own = index === 3;
    const target = own ? progress.track : index > 3 ? 1 : 0;
    if (!f.started || reduced) {
      f.p.snap(target);
      f.started = true;
    } else {
      f.p.target = target;
      f.p.update(dt);
    }
    const p = f.p.value;

    // Закат → ночь; свет очага. Степью командует только своя глава.
    const light = computeFireLight(p, f.light);
    const o = steppeOverride;
    if (own) {
      o.active = true;
      o.sunElevation = light.sunElevation;
      o.dusk = light.dusk;
      o.night = light.night;
      o.groundFog = 0;
      o.exposure = light.exposure;
      o.sunX = 1;
      o.sunZ = -0.2;
      const c = o.clearings[0]!;
      c[0] = ax + PLAN_CENTER[0];
      c[1] = az + PLAN_CENTER[2];
      c[2] = -6.5; // у огня и под ковром травы нет совсем (план чистый)
      for (let k = 1; k < o.clearings.length; k++) o.clearings[k]![2] = 0;
    }
    const lamp = hearthLight.light;
    if (lamp) {
      const near = index >= 2 && index <= 4;
      lamp.position.set(ax + HEARTH[0], 0.55, az + HEARTH[2]);
      // Огонь «дышит» медленно (≤ 1 Гц) — ничего не мигает.
      lamp.intensity = near
        ? light.hearth * (1 + (reduced ? 0 : 0.06 * Math.sin(f.time * 2.3)))
        : 0;
    }

    // Поза камеры: dolly zoom в вид сверху; на телефоне — список блюд вместо плана.
    const aspect = size.width / Math.max(1, size.height);
    const narrow = size.width < NARROW;
    const pose = firePose(p, aspect, narrow, f.pose);
    const sp = scenePose;
    // Вход — с совпадающего ключа пути; выход — плавно в хвосте главы к следующей.
    const tail = (progress.camera - trackT(3, 1)) / (0.8 - trackT(3, 1));
    const weight = index === 3 ? 1 - Math.min(1, Math.max(0, tail)) : 0;
    sp.active = weight > 0;
    if (sp.active) {
      sp.position.set(ax + pose.position.x, pose.position.y, az + pose.position.z);
      sp.target.set(ax + pose.target.x, pose.target.y, az + pose.target.z);
      sp.focal = pose.focal;
      sp.still = pose.still;
      sp.weight = weight;
    }

    world.hearth.update(f.time, light.glowRadius, own ? light.glow : 0, reduced);
    world.table.show(fireControl.set, reduced || !f.shown);
    f.shown = true;
    world.table.update(dt, pose.ortho, fireControl.hover, reduced);

    // DOM: фаза главы и позиции подписей блюд — только при смене / движении.
    const d = f.dom;
    if (d.stage && !d.stage.isConnected) {
      d.stage = null;
      d.phase = d.set = "";
    }
    d.stage ??= document.querySelector<HTMLElement>(STAGE_SELECTOR);
    if (d.stage) {
      const phase = phaseOf(p);
      if (phase !== d.phase) {
        d.phase = phase;
        d.stage.dataset.phase = phase;
      }
      if (d.set !== fireControl.set) {
        d.set = fireControl.set;
        d.hotspots = world.table.current().map((v) => ({
          el: d.stage!.querySelector<HTMLElement>(`[data-dish="${fireControl.set}:${v.dish.id}"]`)!,
          x: -1,
          y: -1,
        }));
      }
      // Подписи — в координатах окна (слой fixed, как и холст); только пока экран закреплён
      // и вид уже сверху: иначе 3D обрезан рамкой главы, а подписи висели бы над страницей.
      const track = chapterTrack("fire");
      const stuck =
        !!track &&
        progress.scrollY >= track.top - 1 &&
        progress.scrollY <= track.top + track.height - progress.viewportHeight + 1;
      const hotspots = stuck && pose.ortho > 0.5 && !narrow ? "on" : "off";
      if (d.stage.dataset.hotspots !== hotspots) d.stage.dataset.hotspots = hotspots;
      if (hotspots === "on") {
        const views = world.table.current();
        for (let i = 0; i < views.length; i++) {
          const h = d.hotspots[i];
          if (!h?.el) continue;
          world.table.dishWorld(views[i]!, f.point).project(camera);
          const x = Math.round(((f.point.x + 1) / 2) * size.width);
          const y = Math.round(((1 - f.point.y) / 2) * size.height);
          if (x !== h.x || y !== h.y) {
            h.x = x;
            h.y = y;
            h.el.style.setProperty("--xy", `${x}px, ${y}px`);
          }
        }
      }
    }

    const s = stageStats.fire;
    s.p = p;
    s.phase = phaseOf(p);
    s.ortho = pose.ortho;
    s.focal = pose.focal;
    s.set = fireControl.set;
    s.hover = fireControl.hover ?? "";
    s.night = light.night;
  }, 0);

  return (
    <group ref={root} position={anchor}>
      <primitive object={world.table.group} />
      <primitive object={world.hearth.group} />
    </group>
  );
}
