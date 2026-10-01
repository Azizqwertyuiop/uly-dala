"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { progress } from "@/motion/progress";
import { Spring } from "@/motion/spring";
import { chapterTempo } from "@/motion/tokens";
import { realLayer } from "../real/layer";
import { computeReturn, createReturnState, RETURN_CIRCLE } from "../return/timeline";
import { stageStats } from "../stats";
import { steppeReturn } from "../steppe/control";
import { CAMERA_Z } from "../steppe/dawn";
import type { SceneProps } from "./registry";

/*
 * Глава 6 «Снова рассвет» (CLAUDE.md, раздел 2): та же степь, что в главе 1 (DawnScene —
 * зависимость главы), без юрты и коня. Сцена ничего не рисует сама: ведёт степь из ночи
 * фазенды к первому кадру сайта — звёзды гаснут, горизонт светлеет, круг травы поднимается.
 */

const INDEX = 5;
const WORLD = 4;

export default function ReturnScene({ anchor }: SceneProps) {
  const [ax, , az] = anchor;
  const frame = useMemo(
    () => ({
      p: new Spring(0, chapterTempo.dawnAgain.cameraSmoothing),
      state: createReturnState(),
      started: false,
      night: -1,
      stage: null as HTMLElement | null,
      reduced:
        typeof window === "undefined"
          ? null
          : window.matchMedia("(prefers-reduced-motion: reduce)"),
    }),
    [],
  );

  useEffect(
    () => () => {
      steppeReturn.active = false;
    },
    [],
  );

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const f = frame;
    const index = progress.chapterIndex;
    const target = index === INDEX ? progress.track : index > INDEX ? 1 : 0;
    const reduced = f.reduced?.matches ?? false;
    if (!f.started || reduced) {
      f.p.snap(target);
      f.started = true;
    } else {
      f.p.target = target;
      f.p.update(dt);
    }
    const s = computeReturn(f.p.value, f.state);

    // Степью командует финал с хвоста фазенды (там она уже под реальным слоем).
    const r = steppeReturn;
    r.active = index > WORLD || (index === WORLD && realLayer.handoff > 0);
    r.sunElevation = s.sunElevation;
    r.groundFog = s.groundFog;
    r.exposure = s.exposure;
    r.predawn = s.predawn;
    r.stars = s.stars;
    r.pressed = s.pressed;
    r.circle[0] = ax + RETURN_CIRCLE.x;
    r.circle[1] = az + CAMERA_Z - RETURN_CIRCLE.ahead;
    r.circle[2] = RETURN_CIRCLE.radius;

    // DOM: подложка под фразой темнеет вместе с ночью (иначе ночью она светлее неба).
    const night = Math.round(s.predawn * 50) / 50;
    if (night !== f.night) {
      f.night = night;
      f.stage ??= document.querySelector<HTMLElement>("[data-return-stage]");
      f.stage?.style.setProperty("--finale-night", String(night));
    }

    const st = stageStats.return;
    st.p = f.p.value;
    st.stars = s.stars;
    st.predawn = s.predawn;
    st.pressed = s.pressed;
    st.handoff = realLayer.handoff;
    st.active = r.active;
  }, 0);

  return null;
}
