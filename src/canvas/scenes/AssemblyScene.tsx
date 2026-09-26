"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Vector3, type Group, type Object3D } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { assemblyControl } from "@/lib/assemblyControl";
import { chapterTrack, progress } from "@/motion/progress";
import { Spring } from "@/motion/spring";
import { chapterTempo } from "@/motion/tokens";
import { StageSnap } from "../assembly/snap";
import { computeAssembly, createAssemblyState, type AssemblyPhase } from "../assembly/timeline";
import { buildYurt, YURT_HEIGHT } from "../assembly/yurt";
import { currentTier } from "../loaders";
import { STEPPE_LAYER } from "../PostFX";
import { stageStats } from "../stats";
import { terrainHeight } from "../steppe/terrain";
import { disposeObject } from "./Model";
import type { SceneProps } from "./registry";

/*
 * Глава 2 «Сборка» (CLAUDE.md, раздел 2). Юрта встаёт на круге примятой травы — в той же степи,
 * что и на рассвете (слой STEPPE_LAYER, степь рисуется до конца дорожки «Сборки»).
 * Кадр: прогресс дорожки → мягкое притяжение (только здесь) → таймлайн → детали.
 * DOM: этап (data-phase), позиция подписи (одна CSS-переменная --caption-xy), можно ли вращать.
 */

const STAGE_SELECTOR = "[data-assembly-stage]";
const ROTATE_SELECTOR = "[data-assembly-rotate]";
/** Ширина подписи в CSS (sections.module.css, .caption) — для удержания в кадре. */
const CAPTION_WIDTH = 300;
const CAPTION_MARGIN = 20;
/** Внутри юрты вращать нельзя: дверь должна смотреть на камеру. */
const ROTATE_UNTIL = 0.82;

function setLayer(root: Object3D) {
  root.traverse((node) => node.layers.set(STEPPE_LAYER));
}

export default function AssemblyScene({ anchor, data }: SceneProps) {
  const gltf = data as GLTF;
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const tier = currentTier();

  const yurt = useMemo(() => buildYurt(gltf, tier), [gltf, tier]);
  const frame = useMemo(
    () => ({
      state: createAssemblyState(),
      snap: new StageSnap(0, chapterTempo.assembly.cameraSmoothing),
      yaw: new Spring(0, 0.25),
      hover: new Spring(0, 0.15), // 300 мс (раздел 5, hover 3D-объектов)
      reduced:
        typeof window === "undefined"
          ? null
          : window.matchMedia("(prefers-reduced-motion: reduce)"),
      started: false,
      time: 0,
      point: new Vector3(),
      dom: {
        stage: null as HTMLElement | null,
        rotate: null as HTMLElement | null,
        phase: "" as AssemblyPhase | "",
        x: -1,
        y: -1,
        rotatable: null as boolean | null,
      },
    }),
    [],
  );
  const root = useRef<Group>(null);

  // Освобождение памяти — только при выгрузке сцены (anchor — новый массив на каждый рендер).
  useEffect(() => {
    if (root.current) setLayer(root.current);
    return () => {
      yurt.dispose();
      disposeObject(gltf.scene);
      assemblyControl.enabled = false;
      assemblyControl.yaw = 0;
    };
  }, [yurt, gltf]);

  // Юрта стоит на рельефе (круг примятой травы — на том же месте).
  const [ax, , az] = anchor;
  useEffect(() => {
    yurt.root.position.y = terrainHeight(ax, az);
  }, [yurt, ax, az]);

  useEffect(() => yurt.setPixelRatio(dpr), [yurt, dpr]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const f = frame;
    const reduced = f.reduced?.matches ?? false;
    f.time += reduced ? 0 : dt;
    const index = progress.chapterIndex;
    const target = index === 1 ? progress.track : index > 1 ? 1 : 0;

    // Восстановление посреди страницы и reduced motion: сразу нужное состояние, без анимации.
    if (!f.started || reduced) {
      f.snap.jump(target);
      f.started = true;
    }
    const p = reduced ? target : f.snap.update(dt, target, index === 1);
    const s = computeAssembly(p, f.state);
    yurt.update(s, f.time);

    // Вращение человеком (только вокруг вертикали) и наведение: +30% контрового, подъём на 1%.
    const rotatable = index === 1 && p < ROTATE_UNTIL;
    assemblyControl.enabled = rotatable;
    if (!rotatable) assemblyControl.yaw = 0;
    f.yaw.target = assemblyControl.yaw;
    f.hover.target = rotatable && assemblyControl.hover ? 1 : 0;
    if (reduced) {
      f.yaw.snap();
      f.hover.snap();
    } else {
      f.yaw.update(dt);
      f.hover.update(dt);
    }
    yurt.turn.rotation.y = f.yaw.value;
    yurt.lift.position.y = f.hover.value * YURT_HEIGHT * 0.01;
    yurt.shared.uRim.value = 1 + 0.3 * f.hover.value;

    // DOM: этап, подпись у своей детали, можно ли вращать — пишется только при изменении.
    const d = f.dom;
    // Переход между страницами: старые элементы отсоединены — найти заново.
    if (d.stage && !d.stage.isConnected) {
      d.stage = d.rotate = null;
      d.phase = "";
      d.x = d.y = -1;
      d.rotatable = null;
    }
    d.stage ??= document.querySelector<HTMLElement>(STAGE_SELECTOR);
    d.rotate ??= document.querySelector<HTMLElement>(ROTATE_SELECTOR);
    if (d.stage) {
      if (d.phase !== s.phase) {
        d.phase = s.phase;
        d.stage.dataset.phase = s.phase;
      }
      // Экран закреплён (sticky): его верх относительно окна — из измеренной дорожки.
      const track = chapterTrack("assembly");
      const stageTop = track
        ? Math.min(
            Math.max(track.top - progress.scrollY, 0),
            track.top + track.height - progress.viewportHeight - progress.scrollY,
          )
        : 0;
      yurt.captionAnchor(s.phase, f.point).project(camera);
      const px = ((f.point.x + 1) / 2) * size.width + 24;
      const py = ((1 - f.point.y) / 2) * size.height - stageTop;
      const x = Math.round(
        Math.min(Math.max(px, CAPTION_MARGIN), size.width - CAPTION_WIDTH - CAPTION_MARGIN),
      );
      // Телефон: юрта занимает ширину кадра — подпись стоит ниже неё, на траве.
      const minY = size.width < 768 ? size.height * 0.64 : 96;
      const y = Math.round(Math.min(Math.max(py, minY), size.height - 200));
      if (x !== d.x || y !== d.y) {
        d.x = x;
        d.y = y;
        d.stage.style.setProperty("--caption-xy", `${x}px, ${y}px`);
      }
      if (d.rotatable !== rotatable) {
        d.rotatable = rotatable;
        d.stage.dataset.rotatable = String(rotatable);
        d.rotate?.setAttribute("aria-disabled", String(!rotatable));
      }
    }

    const a = stageStats.assembly;
    a.p = p;
    a.phase = s.phase;
    a.snapping = f.snap.snapping;
    a.yaw = f.yaw.value;
    a.kerege = (s.panels[0]! + s.panels[1]! + s.panels[2]! + s.panels[3]!) / 4;
    let poles = 0;
    for (let i = 0; i < s.poles.length; i++) poles += s.poles[i]!;
    a.uyki = poles / s.poles.length;
    a.shanyrak = s.crown;
    a.kiiz = s.cover;
    a.pillar = s.pillar;
  }, 0);

  return (
    <group ref={root} position={anchor}>
      <primitive object={yurt.root} />
    </group>
  );
}
