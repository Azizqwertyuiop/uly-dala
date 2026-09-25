"use client";

import { advance, Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { NoToneMapping, type PerspectiveCamera } from "three";
import {
  DynamicResolution,
  FirefoxProbe,
  gpuMemoryLimitMb,
  isFirefox,
  isIOS,
  renderPixelRatio,
  TARGET_FPS,
  type DeviceProfile,
} from "@/lib/capabilities";
import { whenIdle } from "@/lib/idle";
import { input } from "@/motion/input";
import { chapterStartScroll, progress } from "@/motion/progress";
import { chapterTempo } from "@/motion/tokens";
import { ticker } from "@/motion/ticker";
import { CameraRigState } from "./camera/rig";
import { horizonPitch, stepBob } from "./steppe/dawn";
import { DebugHud, DebugSplines } from "./debug";
import { configureLoaders } from "./loaders";
import { PostFX } from "./PostFX";
import { planScenes } from "./scenes/plan";
import { sceneRegistry, type LoadedScene } from "./scenes/registry";
import { stageStats } from "./stats";
import { chapterAnchor, chapterTempoId } from "./world";

/*
 * Постоянная 3D-сцена (CLAUDE.md, разделы 6–7). Грузится динамически после первой отрисовки.
 * - frameloop="never": кадр рисует наш ticker (фаза render) через advance().
 * - Камера — CameraRigState в фазе damping; крен 0.
 * - Менеджер сцен: текущая глава + предзагрузка на 50%, выгрузка дальше двух глав, лимит памяти GPU,
 *   компиляция шейдеров заранее в простое (compileAsync → KHR_parallel_shader_compile).
 * - Бюджет пикселей и динамическое разрешение, Firefox < 50 fps за 3 с → medium.
 * - Потеря контекста: пауза, ожидание восстановления, иначе fallback без перезагрузки.
 */

export type StageQuality = "high" | "medium";

type Props = {
  quality: StageQuality;
  profile: DeviceProfile;
  debug: boolean;
  onReady: () => void;
  onFallback: (reason: string) => void;
};

const DAWN_FOV = 2 * Math.atan(24 / (2 * 135)) * (180 / Math.PI);

/** Сколько ждать восстановления контекста, прежде чем уйти в fallback, с. */
const CONTEXT_RESTORE_TIMEOUT = 3;

export default function Stage(props: Props) {
  const [quality, setQuality] = useState<StageQuality>(props.quality);
  return (
    <>
      <Canvas
        frameloop="never"
        dpr={1}
        gl={{
          antialias: quality === "high",
          alpha: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false,
        }}
        // Горы — на 14 км, небо — на 18 км (глава 1).
        camera={{ fov: 10, near: 0.25, far: 20_000, position: [0, 0.6, 12] }}
        style={{ pointerEvents: "none" }}
        onCreated={({ gl }) => {
          // Один тонмаппинг на всё (раздел 6) — AgX в финальном проходе (PostFX), не в рендерере.
          gl.toneMapping = NoToneMapping;
          gl.setClearColor(0x000000, 0);
          // Статистику кадра (draw calls) считаем за весь кадр — сцена + пост-процесс.
          gl.info.autoReset = false;
        }}
      >
        <Runtime {...props} quality={quality} onDowngrade={() => setQuality("medium")} />
      </Canvas>
      {props.debug && <DebugHud />}
    </>
  );
}

function Runtime({
  quality,
  profile,
  debug,
  onReady,
  onFallback,
  onDowngrade,
}: Props & { onDowngrade: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const setDpr = useThree((s) => s.setDpr);
  const rig = useMemo(() => new CameraRigState(chapterTempo.dawn.cameraSmoothing), []);
  const [scenes, setScenes] = useState<Map<string, LoadedScene>>(() => new Map());
  // Загрузчики (KTX2/meshopt) — до первого плана сцен: им нужен renderer.
  useState(() => configureLoaders(gl, quality));
  const loading = useRef(new Set<string>());
  const compiled = useRef(new Set<string>());
  const ready = useRef(false);
  const paused = useRef(false);
  const resolution = useRef(new DynamicResolution(TARGET_FPS[quality]));

  // ---------- Разрешение: бюджет пикселей × DPR-лимит × динамический масштаб ----------
  useEffect(() => {
    resolution.current.targetFps = TARGET_FPS[quality];
    setDpr(
      renderPixelRatio({
        cssWidth: size.width,
        cssHeight: size.height,
        devicePixelRatio: profile.devicePixelRatio,
        coarsePointer: profile.coarsePointer,
        quality,
        scale: resolution.current.scale,
      }),
    );
  }, [quality, size.width, size.height, profile, setDpr]);

  // ---------- Сцены: план при смене главы и пересечении 50% ----------
  useEffect(() => {
    const limit = gpuMemoryLimitMb(quality, isIOS(profile.userAgent, profile.maxTouchPoints));
    let lastKey = "";
    const replan = () => {
      const hasChapters = progress.chapterId !== null;
      const key = hasChapters ? `${progress.chapterIndex}:${progress.local >= 0.5}` : "none";
      if (key === lastKey) return;
      lastKey = key;
      const loaded = new Set([...scenes.keys(), ...loading.current]);
      const plan = hasChapters
        ? planScenes({
            current: progress.chapterIndex,
            local: progress.local,
            loaded,
            registry: sceneRegistry,
            memoryLimitMb: limit,
          })
        : { load: [], dispose: [...loaded], keep: [], memoryMb: 0 };
      stageStats.memoryMb = plan.memoryMb;
      if (plan.dispose.length > 0) {
        setScenes((prev) => {
          const next = new Map(prev);
          plan.dispose.forEach((id) => {
            next.delete(id);
            compiled.current.delete(id);
          });
          return next;
        });
      }
      for (const id of plan.load) {
        const entry = sceneRegistry.find((e) => e.id === id);
        if (!entry || loading.current.has(id)) continue;
        loading.current.add(id);
        void entry.loader().then((loaded) => {
          loading.current.delete(id);
          setScenes((prev) => new Map(prev).set(id, loaded));
        });
      }
      if (!hasChapters && !ready.current) markReady();
    };
    replan();
    return ticker.add("timeline", replan);
    // scenes нужен для актуального набора загруженных; ticker-подписка пересоздаётся при изменении.
  }, [scenes, quality, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Шейдеры новых сцен — заранее, в простое ----------
  useEffect(() => {
    const pending = [...scenes.keys()].filter((id) => !compiled.current.has(id));
    if (pending.length === 0) return;
    const compile = () =>
      void gl.compileAsync(scene, camera).then(() => {
        pending.forEach((id) => compiled.current.add(id));
        stageStats.compiled = [...compiled.current];
      });
    return whenIdle(compile, 1500);
  }, [scenes, gl, scene, camera]);

  // ---------- Готовность: сцена текущей главы на месте → камера сразу в точку, первый кадр ----------
  function markReady() {
    if (ready.current) return;
    ready.current = true;
    // Восстановление после обновления страницы: без облёта от начала, интро пропускается.
    rig.snap(progress.horizon);
    applyCamera(camera, rig.out);
    stageStats.introSkipped = window.scrollY > 0;
    advance(ticker.time * 1000);
    onReady();
  }

  useEffect(() => {
    if (ready.current || progress.chapterId === null) return;
    if (scenes.has(progress.chapterId)) markReady();
  }); // проверка после каждого обновления набора сцен

  // ---------- Кадр: камера (damping) и рендер (render) ----------
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const firefox = isFirefox(profile.userAgent) ? new FirefoxProbe() : null;

    const offDamping = ticker.add("damping", (dt) => {
      if (!ready.current || paused.current) return;
      const tempo = progress.chapterId
        ? chapterTempo[chapterTempoId[progress.chapterId as keyof typeof chapterTempoId]]
        : chapterTempo.dawn;
      // Композиция первого экрана по пропорциям (горизонт 72% / 68% на мобильных) — только в начале.
      const aspect = size.width / Math.max(size.height, 1);
      const framing = 1 - Math.min(Math.max(progress.horizon / 0.12, 0), 1);
      const pitch = (horizonPitch(DAWN_FOV, aspect) - horizonPitch(DAWN_FOV, 16 / 9)) * framing;
      // Шаг коня (ритм 0,6 с) — только на переходе Рассвет → Сборка, 40vh.
      const transition =
        (progress.scrollY - chapterStartScroll(1)) / (0.4 * progress.viewportHeight);
      const y = reduced.matches ? 0 : stepBob(ticker.time, transition);
      rig.update(dt, progress.horizon, input, tempo.cameraSmoothing, reduced.matches, { pitch, y });
      applyCamera(camera, rig.out);
    });

    // GPU-время кадра — только в ?debug и только где есть расширение таймеров.
    const ctx = gl.getContext() as WebGL2RenderingContext;
    const timer = debug ? ctx.getExtension("EXT_disjoint_timer_query_webgl2") : null;
    let query: WebGLQuery | null = null;
    const readGpuTime = () => {
      if (!timer || !query) return;
      if (!ctx.getQueryParameter(query, ctx.QUERY_RESULT_AVAILABLE)) return;
      if (!ctx.getParameter(timer.GPU_DISJOINT_EXT)) {
        stageStats.gpuMs = ctx.getQueryParameter(query, ctx.QUERY_RESULT) / 1e6;
      }
      ctx.deleteQuery(query);
      query = null;
    };

    let cleared = false;
    const offRender = ticker.add("render", (dt, time) => {
      if (!ready.current || paused.current) return;
      // Страница без сцен: один пустой кадр (стереть прошлую сцену) — и дальше не рисуем.
      if (progress.chapterId === null) {
        if (!cleared) advance(time * 1000);
        cleared = true;
        return;
      }
      cleared = false;
      readGpuTime();
      const measure = timer && !query ? ctx.createQuery() : null;
      if (measure && timer) ctx.beginQuery(timer.TIME_ELAPSED_EXT, measure);
      gl.info.reset();
      const started = performance.now();
      advance(time * 1000);
      stageStats.renderMs = performance.now() - started;
      if (measure && timer) {
        ctx.endQuery(timer.TIME_ELAPSED_EXT);
        query = measure;
      }
      stageStats.drawCalls = gl.info.render.calls;
      stageStats.geometries = gl.info.memory.geometries;
      stageStats.textures = gl.info.memory.textures;
      stageStats.pixelRatio = gl.getPixelRatio();

      if (resolution.current.sample(dt)) {
        stageStats.resolutionScale = resolution.current.scale;
        setDpr(
          renderPixelRatio({
            cssWidth: window.innerWidth,
            cssHeight: window.innerHeight,
            devicePixelRatio: profile.devicePixelRatio,
            coarsePointer: profile.coarsePointer,
            quality,
            scale: resolution.current.scale,
          }),
        );
      }
      if (firefox?.sample(dt) && firefox.downgrade && quality === "high") onDowngrade();
    });

    return () => {
      offDamping();
      offRender();
    };
  }, [camera, gl, rig, quality, profile, setDpr, onDowngrade, debug, size.width, size.height]);

  // ---------- Потеря контекста ----------
  useEffect(() => {
    const canvas = gl.domElement;
    let offTimeout: (() => void) | null = null;
    const onLost = (event: Event) => {
      event.preventDefault(); // разрешить восстановление
      paused.current = true;
      stageStats.context = "lost";
      const deadline = ticker.time + CONTEXT_RESTORE_TIMEOUT;
      offTimeout?.();
      // Ticker тикает, пока есть подписчик; таймаут считаем по его времени.
      offTimeout = ticker.add("timeline", (_dt, time) => {
        if (time < deadline) return;
        offTimeout?.();
        offTimeout = null;
        stageStats.context = "fallback";
        onFallback("webglcontextlost");
      });
    };
    const onRestored = () => {
      offTimeout?.();
      offTimeout = null;
      paused.current = false;
      stageStats.context = "ok";
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      offTimeout?.();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [gl, onFallback]);

  // ---------- Сводка для отладки и тестов ----------
  useEffect(() => {
    stageStats.quality = quality;
    stageStats.loaded = [...scenes.keys()];
  }, [quality, scenes]);
  useEffect(
    () =>
      ticker.add("render", () => {
        const o = rig.out;
        stageStats.camera.x = o.position.x;
        stageStats.camera.y = o.position.y;
        stageStats.camera.z = o.position.z;
        stageStats.camera.yaw = o.yaw;
        stageStats.camera.pitch = o.pitch;
        stageStats.camera.roll = camera.rotation.z;
        stageStats.camera.fov = o.fov;
        stageStats.current = progress.chapterId;
        stageStats.frames++;
      }),
    [rig, camera],
  );

  return (
    <>
      <hemisphereLight args={["#f7f4ee", "#6b4a33", 0.9]} />
      <directionalLight position={[20, 30, 10]} intensity={1.6} />
      {sceneRegistry.map((entry) => {
        const loaded = scenes.get(entry.id);
        if (!loaded) return null;
        const Scene = loaded.Component;
        return <Scene key={entry.id} anchor={chapterAnchor(entry.index)} data={loaded.data} />;
      })}
      <PostFX msaa={quality === "high"} />
      {debug && <DebugSplines path={rig.path} />}
    </>
  );
}

const lastFov = { value: 0 };

function applyCamera(camera: PerspectiveCamera, out: CameraRigState["out"]) {
  camera.position.copy(out.position);
  // Порядок YXZ и z = 0: крен ровно ноль (раздел 5, закон «Горизонт»).
  camera.rotation.set(out.pitch, out.yaw, 0, "YXZ");
  if (Math.abs(out.fov - lastFov.value) > 1e-4) {
    lastFov.value = out.fov;
    camera.fov = out.fov;
    camera.updateProjectionMatrix();
  }
}
