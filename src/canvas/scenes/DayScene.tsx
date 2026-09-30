"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { PMREMGenerator, type Group, type Object3D } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { FormatSlug } from "@/content/formats";
import { dayControl } from "@/lib/dayControl";
import { progress } from "@/motion/progress";
import { Spring } from "@/motion/spring";
import { chapterTempo } from "@/motion/tokens";
import { createSetups } from "../day/setups";
import {
  computeDayLight,
  createDayLight,
  DAY_CLEARING,
  DAY_STATES,
  SLOT_SIDE,
  slotCenter,
  slotZ,
  STATE_SPAN,
} from "../day/timeline";
import { currentTier } from "../loaders";
import { STEPPE_LAYER } from "../PostFX";
import { stageStats } from "../stats";
import { steppeOverride } from "../steppe/control";
import { terrainHeight } from "../steppe/terrain";
import { sceneTempo } from "../tempo";
import type { SceneProps } from "./registry";

/*
 * Глава 3 «День» (CLAUDE.md, раздел 2): одна сцена — шесть площадок в той же степи (полдень).
 * Порядок площадок — по развилке (dayControl), камера проезжает мимо них (путь — rig.setDayOrder).
 * Кадр: прогресс дорожки → сглаживание по темпу (кудалык — 0,6 с) → свет и завеса → площадки.
 * Env map (RoomEnvironment → PMREM) — только металлу и фарфору площадок, не всей сцене.
 */

export type DayData = { led: GLTF; dastarkhan: GLTF };

function setLayer(root: Object3D) {
  root.traverse((node) => node.layers.set(STEPPE_LAYER));
}

export default function DayScene({ anchor, data }: SceneProps) {
  const { led, dastarkhan } = data as DayData;
  const gl = useThree((s) => s.gl);
  const tier = currentTier();

  const world = useMemo(() => {
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    pmrem.dispose();
    const setups = createSetups({ env: env.texture, led, dastarkhan, tier });
    return { env, setups, slugs: Object.keys(setups) as FormatSlug[] };
  }, [gl, led, dastarkhan, tier]);

  const frame = useMemo(
    () => ({
      light: createDayLight(),
      p: new Spring(0, chapterTempo.day.cameraSmoothing),
      reduced:
        typeof window === "undefined"
          ? null
          : window.matchMedia("(prefers-reduced-motion: reduce)"),
      started: false,
      version: -1,
      time: 0,
    }),
    [],
  );
  const root = useRef<Group>(null);
  const [ax, , az] = anchor;

  // Шейдеры площадок — заранее и в фоне (KHR_parallel_shader_compile): скрытые площадки
  // не попадают в общую предкомпиляцию, а первый показ не должен давать рывок кадра.
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const groups = world.slugs.map((slug) => world.setups[slug].group);
    const was = groups.map((g) => g.visible);
    groups.forEach((g) => (g.visible = true));
    if (root.current) void gl.compileAsync(root.current, camera, scene);
    groups.forEach((g, i) => (g.visible = was[i]!));
  }, [world, gl, camera, scene]);

  useEffect(() => {
    if (root.current) setLayer(root.current);
    return () => {
      world.slugs.forEach((slug) => world.setups[slug].dispose());
      world.env.dispose();
      steppeOverride.active = false;
      sceneTempo.id = null;
    };
  }, [world]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const f = frame;
    const reduced = f.reduced?.matches ?? false;
    f.time += reduced ? 0 : dt;
    const index = progress.chapterIndex;
    const target = index === 2 ? progress.track : index > 2 ? 1 : 0;
    const order = dayControl.order;

    // Площадки — в слоты по порядку развилки (меняется редко: по выбору в «Сборке»).
    if (f.version !== dayControl.version) {
      f.version = dayControl.version;
      for (const slug of world.slugs) {
        const c = slotCenter(order.indexOf(slug));
        world.setups[slug].group.position.set(c[0], terrainHeight(ax + c[0], az + c[2]), c[2]);
      }
    }

    // Скраб со сглаживанием по темпу: в кудалыке — 0,6 с (раздел 5), иначе 0,25 с.
    const slotNow = Math.min(DAY_STATES - 1, Math.floor(Math.min(target, 0.9999) / STATE_SPAN));
    const kudalyk = order[slotNow] === "kudalyk";
    f.p.smoothTime = kudalyk
      ? chapterTempo.dayKudalyk.cameraSmoothing
      : chapterTempo.day.cameraSmoothing;
    if (!f.started || reduced) {
      f.p.snap(target);
      f.started = true;
    } else {
      f.p.target = target;
      f.p.update(dt);
    }
    const p = f.p.value;

    // Свет, время суток и завеса — степи. Пишет только своя глава: в «Огне» свет задаёт он.
    const light = computeDayLight(p, order, f.light);
    const o = steppeOverride;
    if (index < 2) o.active = false;
    const own = index === 2;
    if (own) {
      o.active = true;
      o.sunElevation = light.sun;
      o.dusk = light.dusk;
      o.night = 0;
      o.sunX = 1;
      o.sunZ = -0.35;
      o.groundFog = reduced ? light.fog - 0.85 * light.veil : light.fog;
      o.exposure = reduced ? light.exposure / (1 + 0.32 * light.veil) : light.exposure;
    }
    // Темп кудалыка — и для камеры (Stage читает sceneTempo).
    sceneTempo.id = index === 2 && order[light.index] === "kudalyk" ? "dayKudalyk" : null;

    // Скошенные поляны — под текущей площадкой и соседями (в мире). Без аллокаций в кадре.
    let c = 0;
    if (own) {
      for (let k = light.index - 1; k <= light.index + 2 && c < o.clearings.length; k++) {
        const slug = order[k];
        if (!slug) continue;
        const local = DAY_CLEARING[slug];
        const out = o.clearings[c++]!;
        out[0] = ax + SLOT_SIDE + local[0];
        out[1] = az + slotZ(k) + local[1];
        out[2] = local[2];
      }
      while (c < o.clearings.length) o.clearings[c++]![2] = 0;
    }

    // Площадки: рисуем только текущую и соседние (остальные далеко и в тумане).
    for (const slug of world.slugs) {
      const slot = order.indexOf(slug);
      const setup = world.setups[slug];
      const near = index >= 1 && index <= 3 && Math.abs(slot - light.index) <= 1;
      setup.group.visible = near;
      if (!near) continue;
      const local = Math.min(1, Math.max(0, (p - slot * STATE_SPAN) / STATE_SPAN));
      setup.update(local, f.time, slot === light.index && index === 2);
    }

    const s = stageStats.day;
    s.p = p;
    s.state = order[light.index] ?? "";
    s.index = light.index;
    s.veil = light.veil;
    s.tempo = sceneTempo.id ?? "day";
  }, 0);

  return (
    <group ref={root} position={anchor}>
      {world.slugs.map((slug) => (
        <primitive key={slug} object={world.setups[slug].group} />
      ))}
    </group>
  );
}
