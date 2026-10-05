"use client";

import { advance, Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { NoToneMapping, type Object3D, type PerspectiveCamera } from "three";
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
import { track } from "@/lib/analytics/track";
import { reportError } from "@/lib/monitoring/report";
import { failedPrograms } from "./shaderCheck";
import { input } from "@/motion/input";
import { chapterStartScroll, progress } from "@/motion/progress";
import { chapterTempo } from "@/motion/tokens";
import { ticker } from "@/motion/ticker";
import { CameraRigState } from "./camera/rig";
import { horizonPitch, stepBob } from "./steppe/dawn";
import { DebugHud, DebugSplines } from "./debug";
import { configureLoaders } from "./loaders";
import { sceneOnScreen } from "./onScreen";
import { PostFX, STEPPE_LAYER } from "./PostFX";
import { DomImages } from "./real/DomImages";
import { planScenes } from "./scenes/plan";
import { sceneRegistry, type LoadedScene } from "./scenes/registry";
import { stageStats } from "./stats";
import { dayControl } from "@/lib/dayControl";
import { sceneTempo } from "./tempo";
import { hearth } from "./hearth";
import { LIGHT_DAY, sceneLights } from "./lights";
import { scenePose } from "./camera/scenePose";
import { assemblyYawOffset, dayYawOffset, sceneFov } from "./camera/framing";
import { stateAt } from "./day/timeline";
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

const NO_POINTER = { x: 0, y: 0 } as const;
const frameOffsets = { pitch: 0, yaw: 0, y: 0 };
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
          // Проверка шейдеров (getProgramInfoLog) синхронна: процессор ждёт видеокарту на каждой
          // новой программе. В продакшене — без неё; в ?debug — с ней (ошибки шейдеров в консоли).
          gl.debug.checkShaderErrors = props.debug;
        }}
      >
        <Runtime
          {...props}
          quality={quality}
          onDowngrade={() => {
            setQuality("medium");
            document.documentElement.dataset.quality = "medium";
            track("quality", { tier: "medium", reason: "firefox-fps" });
          }}
        />
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
  useState(() => configureLoaders(gl, quality, profile));
  // Понижение уровня (Firefox < 50 fps) — следующие главы грузятся уже в medium.
  useEffect(() => configureLoaders(gl, quality, profile), [gl, quality, profile]);
  const loading = useRef(new Set<string>());
  const compiled = useRef(new Set<string>());
  // Сцена рисуется, только когда её шейдеры скомпилированы (в простое, параллельно):
  // иначе первый кадр новой главы компилирует синхронно — зависание на сотни миллисекунд.
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
  const ready = useRef(false);
  const paused = useRef(false);
  const dayVersion = useRef(-1);
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
        // Выгруженная сцена при повторной загрузке снова ждёт компиляции.
        setShown((prev) => new Set([...prev].filter((id) => !plan.dispose.includes(id))));
      }
      for (const id of plan.load) {
        const entry = sceneRegistry.find((e) => e.id === id);
        if (!entry || loading.current.has(id)) continue;
        loading.current.add(id);
        void entry.loader().then((loaded) => {
          // «Загружается» → «загружена» — в одном обновлении состояния: иначе между ними план
          // (при параллельной догрузке другой сцены) видит главу ни там, ни там и грузит её снова.
          setScenes((prev) => {
            loading.current.delete(id);
            return new Map(prev).set(id, loaded);
          });
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
        // Шейдер не собрался (в продакшене checkShaderErrors выключен — проверяем сами, после
        // готовности программ это не ждёт видеокарту) → мониторинг с тегом webgl и fallback.
        const failed = failedPrograms(gl);
        if (failed.length > 0) {
          reportError({
            tag: "webgl",
            kind: "shader_link",
            message: `shader program failed to link: ${failed.map((f) => f.name).join(", ")}`,
            detail: { programs: failed.length, scenes: pending.join(",") },
          });
          stageStats.context = "fallback";
          onFallback("shader");
          return;
        }
        pending.forEach((id) => compiled.current.add(id));
        stageStats.compiled = [...compiled.current];
        setShown(new Set(compiled.current));
      });
    // До первого кадра — сразу (иначе готовность ждала бы простоя), дальше — в простое.
    if (!ready.current) {
      compile();
      return;
    }
    return whenIdle(compile, 1500);
  }, [scenes, gl, scene, camera, onFallback]);

  // ---------- Готовность: сцена текущей главы на месте → камера сразу в точку, первый кадр ----------
  function markReady() {
    if (ready.current) return;
    ready.current = true;
    // Восстановление после обновления страницы: без облёта от начала, интро пропускается.
    rig.snap(progress.camera);
    applyCamera(camera, rig.out);
    stageStats.introSkipped = window.scrollY > 0;
    advance(ticker.time * 1000);
    onReady();
  }

  useEffect(() => {
    if (ready.current || progress.chapterId === null) return;
    // Готово, когда на месте и глава, и мир, в котором она стоит (степь).
    const entry = sceneRegistry.find((e) => e.id === progress.chapterId);
    // У главы без сцены («День» — фото) ждать нечего.
    const need = entry ? [entry.id, ...(entry.requires ?? [])] : [];
    if (need.every((id) => scenes.has(id) && shown.has(id))) markReady();
  }); // проверка после каждого обновления набора сцен

  // ---------- Кадр: камера (damping) и рендер (render) ----------
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const firefox = isFirefox(profile.userAgent) ? new FirefoxProbe() : null;

    const offDamping = ticker.add("damping", (dt) => {
      if (!ready.current || paused.current) return;
      // Темп главы; сцена может задать свой (кудалык в «Дне» — ×1.6, сглаживание 0,6 с).
      const tempo = sceneTempo.id
        ? chapterTempo[sceneTempo.id]
        : progress.chapterId
          ? chapterTempo[chapterTempoId[progress.chapterId as keyof typeof chapterTempoId]]
          : chapterTempo.dawn;
      // Порядок форматов «Дня» (развилка) изменился — путь камеры перестраивается.
      // Набор ключей камеры: портрет телефона — свой; облёт «Сборки» — только на high.
      rig.setLayout({
        portrait: size.width < size.height,
        flyover: quality === "high",
      });
      if (dayVersion.current !== dayControl.version) {
        dayVersion.current = dayControl.version;
        rig.setDayOrder(dayControl.order);
      }
      // Композиция первого экрана по пропорциям (горизонт 72% / 68% на мобильных) — в начале…
      const aspect = size.width / Math.max(size.height, 1);
      // …и в финале: «Снова рассвет» — тот же кадр (петля).
      const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
      const framing = Math.max(
        1 - clamp01(progress.horizon / 0.12),
        clamp01((progress.horizon - 0.9) / 0.1),
      );
      const pitch = (horizonPitch(DAWN_FOV, aspect) - horizonPitch(DAWN_FOV, 16 / 9)) * framing;
      // Шаг коня (ритм 0,6 с) — только на переходе Рассвет → Сборка, 40vh.
      const transition =
        (progress.scrollY - chapterStartScroll(1)) / (0.4 * progress.viewportHeight);
      const y = reduced.matches ? 0 : stepBob(ticker.time, transition);
      // «Сборка» на узком экране: камера доворачивается к юрте (только рысканье).
      const daySlot = progress.chapterIndex === 2 ? stateAt(progress.track).index : 0;
      const yaw =
        assemblyYawOffset(rig.path, progress.camera, aspect) +
        dayYawOffset(rig.path, progress.camera, aspect, daySlot);
      rig.update(
        dt,
        progress.camera,
        // Смещение кадра за курсором — только мышь: палец прокручивает страницу, а не «смотрит».
        input.pointerType === "touch" ? NO_POINTER : input,
        tempo.cameraSmoothing,
        reduced.matches,
        // Без аллокаций в кадре: один объект сдвигов на всё время.
        Object.assign(frameOffsets, { pitch, yaw, y }),
        scenePose.active ? scenePose : null,
      );
      rig.out.fov = sceneFov(rig.out.fov, progress.camera, aspect);
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
    let idleCleared = false;
    const offRender = ticker.add("render", (dt, time) => {
      if (!ready.current || paused.current) return;
      // Статика: сцены на экране нет (бриф, футер, тексты) — один пустой кадр и стоп.
      if (!sceneOnScreen()) {
        if (idleCleared) {
          stageStats.idle = true;
          return;
        }
        idleCleared = true;
      } else {
        idleCleared = false;
      }
      stageStats.idle = false;
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
      reportError({ tag: "webgl", kind: "context_lost", message: "webglcontextlost" });
      const deadline = ticker.time + CONTEXT_RESTORE_TIMEOUT;
      offTimeout?.();
      // Ticker тикает, пока есть подписчик; таймаут считаем по его времени.
      offTimeout = ticker.add("timeline", (_dt, time) => {
        if (time < deadline) return;
        offTimeout?.();
        offTimeout = null;
        stageStats.context = "fallback";
        reportError({
          tag: "webgl",
          kind: "fallback",
          message: `context not restored in ${CONTEXT_RESTORE_TIMEOUT}s → fallback`,
        });
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
        stageStats.camera.pose = rig.poseWeight;
        stageStats.current = progress.chapterId;
        stageStats.frames++;
      }),
    [rig, camera],
  );

  return (
    <>
      {/* Свет — и для слоя степи (юрта, площадки «Дня»): в three.js свет тоже фильтруется слоями. */}
      <hemisphereLight
        args={["#f7f4ee", "#6b4a33", LIGHT_DAY.hemi]}
        ref={(light) => {
          bothLayers(light);
          sceneLights.hemi = light;
        }}
      />
      <directionalLight
        position={[20, 30, 10]}
        intensity={LIGHT_DAY.sun}
        ref={(light) => {
          bothLayers(light);
          sceneLights.sun = light;
        }}
      />
      {/* Свет очага «Огня» — с самого начала, сила 0 (без пересборки шейдеров при появлении). */}
      <pointLight
        args={["#ff9a55", 0, 7, 1.4]}
        ref={(light) => {
          bothLayers(light);
          hearth.light = light;
        }}
      />
      {sceneRegistry.map((entry) => {
        const loaded = scenes.get(entry.id);
        if (!loaded) return null;
        const Scene = loaded.Component;
        return (
          <group key={entry.id} visible={shown.has(entry.id)}>
            <Scene anchor={chapterAnchor(entry.index)} data={loaded.data} />
          </group>
        );
      })}
      <DomImages />
      <PostFX msaa={quality === "high"} />
      {debug && <DebugSplines path={rig.path} />}
    </>
  );
}

/** Объект виден и в основном слое, и в слое степи. */
const bothLayers = (object: Object3D | null) => object?.layers.enable(STEPPE_LAYER);

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
