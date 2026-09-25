"use client";

import { useEffect, useState, type ComponentType } from "react";
import { whenIdle } from "@/lib/idle";
import { decideQuality, readDeviceProfile, type DeviceProfile } from "@/lib/capabilities";
import { useUiStore } from "@/store/ui";
import styles from "./CanvasRoot.module.css";

type StageModule = typeof import("@/canvas/Stage");

const setLoad = (value: number) =>
  document.documentElement.style.setProperty("--stage-load", String(value));
type StageProps = Parameters<StageModule["default"]>[0];

/*
 * Постоянный <Canvas> в корневом layout (CLAUDE.md, раздел 7): fixed, слой --z-canvas,
 * aria-hidden, не пересоздаётся при навигации внутри языка.
 * - Уровень качества определяется один раз; fallback и режим «Коротко» — Canvas не монтируется.
 * - three.js грузится динамически после загрузки страницы: hero-DOM его не ждёт.
 * - html[data-canvas]: off | loading | ready. При ready статичные кадры глав скрываются.
 */
export function CanvasRoot() {
  const uiMode = useUiStore((s) => s.uiMode);
  const [Stage, setStage] = useState<ComponentType<StageProps> | null>(null);
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [quality, setQuality] = useState<"high" | "medium" | "fallback" | null>(null);
  const [debug, setDebug] = useState(false);

  // Решение об уровне качества — один раз, после загрузки страницы и в простое.
  useEffect(() => {
    let cancelled = false;
    const decide = () => {
      if (cancelled) return;
      const p = readDeviceProfile();
      const decision = decideQuality(p);
      setProfile(p);
      setQuality(decision.quality);
      setDebug(new URLSearchParams(window.location.search).has("debug"));
      document.documentElement.dataset.quality = decision.quality;
      if (decision.quality === "fallback") return;
      // Прелоадер-горизонт (раздел 2): линия прочерчивается по прогрессу загрузки 3D.
      setLoad(0.35);
      void import("@/canvas/Stage").then((mod) => {
        if (cancelled) return;
        setLoad(0.7);
        setStage(() => mod.default);
      });
    };
    // three.js — после load и в простое: первый экран (и LCP) уже отрисован статичным кадром,
    // сцена его тихо подменяет. Замер: с холстом и без него LCP одинаков.
    let cancelIdle = () => {};
    const onLoad = () => {
      cancelIdle = whenIdle(decide);
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => {
      cancelled = true;
      cancelIdle();
      window.removeEventListener("load", onLoad);
    };
  }, []);

  const active =
    Stage !== null &&
    profile !== null &&
    (quality === "high" || quality === "medium") &&
    uiMode !== "brief";

  useEffect(() => {
    const html = document.documentElement;
    if (!active) html.dataset.canvas = "off";
    else if (html.dataset.canvas !== "ready") html.dataset.canvas = "loading";
  }, [active]);

  return (
    <div className={styles.root} aria-hidden="true" data-canvas-root="">
      {active && (
        <Stage
          quality={quality}
          profile={profile}
          debug={debug}
          onReady={() => {
            setLoad(1);
            document.documentElement.dataset.canvas = "ready";
          }}
          onFallback={() => {
            // Без перезагрузки: Canvas размонтируется, возвращаются статичные кадры.
            document.documentElement.dataset.quality = "fallback";
            setQuality("fallback");
          }}
        />
      )}
    </div>
  );
}
