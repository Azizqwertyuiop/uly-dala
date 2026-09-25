"use client";

import { useEffect, useMemo, useRef } from "react";
import { BufferGeometry, Line, LineBasicMaterial } from "three";
import { ticker } from "@/motion/ticker";
import type { CameraPath } from "./camera/path";
import { stageStats } from "./stats";

/*
 * Отладка (?debug): fps, JS/GPU мс на кадр, draw calls, память, сплайны камеры.
 * JS — время всего кадра ticker; GPU — EXT_disjoint_timer_query_webgl2 там, где есть (иначе «—»).
 */

export function DebugHud() {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let frames = 0;
    let elapsed = 0;
    let jsTotal = 0;
    let frameStart = 0;
    const offStart = ticker.add("input", () => {
      frameStart = performance.now();
    });
    const offEnd = ticker.add("render", (dt) => {
      frames++;
      elapsed += dt;
      jsTotal += performance.now() - frameStart;
      if (elapsed < 0.5 || !ref.current) return;
      const s = stageStats;
      const c = s.camera;
      ref.current.textContent = [
        `fps        ${(frames / elapsed).toFixed(0)}`,
        `JS, мс     ${(jsTotal / frames).toFixed(2)}`,
        `GPU, мс    ${s.gpuMs === null ? "—" : s.gpuMs.toFixed(2)}`,
        `render, мс ${s.renderMs.toFixed(2)}`,
        `draw calls ${s.drawCalls}`,
        `память     ${s.memoryMb} МБ (оценка) · geo ${s.geometries} · tex ${s.textures}`,
        `качество   ${s.quality} · DPR ${s.pixelRatio.toFixed(2)} · масштаб ${s.resolutionScale}`,
        `контекст   ${s.context}`,
        `глава      ${s.current ?? "—"} · загружены ${s.loaded.join(", ") || "—"}`,
        `шейдеры    ${s.compiled.join(", ") || "—"}`,
        `камера     ${c.x.toFixed(1)} ${c.y.toFixed(2)} ${c.z.toFixed(1)} · fov ${c.fov.toFixed(1)}° · крен ${c.roll}`,
      ].join("\n");
      frames = 0;
      elapsed = 0;
      jsTotal = 0;
    });
    return () => {
      offStart();
      offEnd();
    };
  }, []);

  return (
    <pre
      ref={ref}
      data-debug-hud=""
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 80,
        left: 8,
        zIndex: 1100,
        margin: 0,
        padding: "8px 10px",
        background: "rgba(10, 12, 18, 0.82)",
        color: "#f7f4ee",
        font: "11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace",
        pointerEvents: "none",
        whiteSpace: "pre",
      }}
    />
  );
}

/** Сплайны камеры: позиция — светлая линия, цель взгляда — акцентная. */
export function DebugSplines({ path }: { path: CameraPath }) {
  const lines = useMemo(() => {
    const make = (points: ReturnType<CameraPath["position"]["getPoints"]>, color: string) =>
      new Line(new BufferGeometry().setFromPoints(points), new LineBasicMaterial({ color }));
    return [
      make(path.position.getPoints(400), "#f7f4ee"),
      make(path.target.getPoints(400), "#e0602a"),
    ];
  }, [path]);
  useEffect(
    () => () =>
      lines.forEach((line) => {
        line.geometry.dispose();
        (line.material as LineBasicMaterial).dispose();
      }),
    [lines],
  );
  return (
    <>
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </>
  );
}
