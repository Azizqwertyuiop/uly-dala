"use client";

import { useEffect, useRef, useState } from "react";
import {
  HalfFloatType,
  Mesh,
  NoToneMapping,
  NormalBlending,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  TextureLoader,
  VideoTexture,
  WebGLRenderer,
  WebGLRenderTarget,
  type Material,
} from "three";
import { assets } from "./assets";
import { createAlphaVideoMaterial } from "./materials/alphaVideoMaterial";
import { createPostMaterial } from "./materials/post";
import { pickVideoSource, prefersHevc, prepareAlphaTexture } from "./video";

/*
 * Служебная проверка рендера (раздел 6, критерии шага 8):
 *  1) видео с альфой без ореолов — наш путь (предумножение до фильтрации → линейный HDR →
 *     наложение) против эталона, посчитанного на CPU из того же кадра; для контроля — «наивный»
 *     путь с непредумноженной альфой, на котором ореол должен появиться;
 *  2) нет полос в тёмном градиенте неба на 8-битном выходе — с дизерингом синим шумом и без.
 * Результат — на странице и в window.__renderTest (для e2e). В Safari проверяется HEVC.
 */

const W = 640;
const H = 360;
const BG_LIGHT = [237, 230, 218]; // --felt
const BG_DARK = [28, 34, 48]; // --indigo

const dec = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const enc = (v: number) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(Math.max(c, 0), 1) * 255);
};

type HaloResult = { edgePixels: number; bad: number; maxDiff: number };
export type RenderTestResult = {
  codec: "hevc" | "vp9";
  halo: { light: HaloResult; dark: HaloResult; naive: HaloResult };
  banding: {
    dithered: { maxStep: number; maxRun: number };
    plain: { maxStep: number; maxRun: number };
  };
};

function compositeMaterial(bg: number[]) {
  return new ShaderMaterial({
    uniforms: { tScene: { value: null }, uBg: { value: bg.map(dec) } },
    vertexShader:
      "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: /* glsl */ `
      uniform sampler2D tScene; uniform vec3 uBg; varying vec2 vUv;
      vec3 enc(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
      void main(){ vec4 s = texture2D(tScene, vUv); gl_FragColor = vec4(enc(s.rgb + uBg * (1.0 - s.a)), 1.0); }
    `,
    depthTest: false,
  });
}

/** «Наивный» путь: непредумноженная альфа, фильтрация по прямым значениям — даёт ореол. */
function naiveMaterial(map: VideoTexture) {
  return new ShaderMaterial({
    uniforms: { map: { value: map } },
    vertexShader:
      "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: /* glsl */ `
      uniform sampler2D map; varying vec2 vUv;
      vec3 dec(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
      void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(dec(t.rgb), t.a); }
    `,
    transparent: true,
    blending: NormalBlending,
  });
}

async function loadFrame(src: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.src = src;
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error(`видео не загрузилось (${video.error?.code})`));
  });
  video.currentTime = 1;
  await new Promise<void>((resolve) => (video.onseeked = () => resolve()));
  return video;
}

function readCanvas(renderer: WebGLRenderer) {
  const gl = renderer.getContext();
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px; // снизу вверх
}

/*
 * Кадр рисуется со сдвигом на полтекселя: каждый пиксель — среднее четырёх соседних текселей,
 * как при масштабировании плоскости в сцене. Эталон — та же билинейная фильтрация, но
 * физически правильная: по предумноженным значениям (как в нашем пути).
 */
function referenceSample(ref: Uint8ClampedArray, x: number, yTop: number) {
  // Тексели столбцов x, x+1 и строк yTop, yTop−1 (строка сверху — у flipY-текстуры выше).
  let pr = 0,
    pg = 0,
    pb = 0,
    pa = 0;
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [0, -1],
    [1, -1],
  ] as const) {
    const i = ((yTop + dy) * W + (x + dx)) * 4;
    const a = ref[i + 3]!;
    // Предумножение при загрузке в GPU — в 8 битах, как делает браузер.
    pr += Math.round((ref[i]! * a) / 255);
    pg += Math.round((ref[i + 1]! * a) / 255);
    pb += Math.round((ref[i + 2]! * a) / 255);
    pa += a;
  }
  return { p: [pr / 4, pg / 4, pb / 4], a: pa / 4 / 255 };
}

function compareHalo(gpu: Uint8Array, reference: Uint8ClampedArray, bg: number[]): HaloResult {
  let edgePixels = 0;
  let bad = 0;
  let maxDiff = 0;
  for (let yb = 0; yb < H - 1; yb++) {
    const yTop = H - 1 - yb;
    if (yTop < 1) continue;
    for (let x = 0; x < W - 1; x++) {
      const { p, a } = referenceSample(reference, x, yTop);
      if (a <= 0.004 || a >= 0.996) continue; // только край и полупрозрачный пар
      edgePixels++;
      const g = (yb * W + x) * 4; // WebGL — снизу вверх
      let worst = 0;
      for (let c = 0; c < 3; c++) {
        const straight = Math.min(p[c]! / 255 / a, 1);
        const lin = dec(straight * 255);
        const expected = enc(lin * a + dec(bg[c]!) * (1 - a));
        worst = Math.max(worst, Math.abs(gpu[g + c]! - expected));
      }
      maxDiff = Math.max(maxDiff, worst);
      if (worst > 6) bad++;
    }
  }
  return { edgePixels, bad, maxDiff };
}

async function haloTest(canvas: HTMLCanvasElement) {
  const hevc = prefersHevc();
  const video = await loadFrame(pickVideoSource(assets.horse, "medium", hevc).src);
  // Эталон: сам кадр (непредумноженные значения) из 2D-холста.
  const ref2d = document.createElement("canvas");
  ref2d.width = W;
  ref2d.height = H;
  const ctx = ref2d.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(video, 0, 0, W, H);
  const reference = ctx.getImageData(0, 0, W, H).data;

  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = NoToneMapping;
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const target = new WebGLRenderTarget(W, H, { type: HalfFloatType });
  const texture = prepareAlphaTexture(new VideoTexture(video));

  const run = (material: Material, bg: number[]) => {
    // Видео на паузе после перемотки: новых кадров (requestVideoFrameCallback) не будет —
    // загрузку в GPU запрашиваем явно.
    texture.needsUpdate = true;
    straight.needsUpdate = true;
    const scene = new Scene();
    const plane = new PlaneGeometry(2, 2);
    // Сдвиг на полтекселя → билинейная фильтрация на каждом пикселе.
    const uv = plane.attributes.uv!;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.5 / W, uv.getY(i) + 0.5 / H);
    scene.add(new Mesh(plane, material));
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    const comp = compositeMaterial(bg);
    comp.uniforms.tScene!.value = target.texture;
    const quad = new Scene();
    quad.add(new Mesh(new PlaneGeometry(2, 2), comp));
    renderer.render(quad, camera);
    return compareHalo(readCanvas(renderer), reference, bg);
  };

  const straight = new VideoTexture(video);
  straight.premultiplyAlpha = false;
  const ours = createAlphaVideoMaterial(texture);
  const light = run(ours, BG_LIGHT);
  const dark = run(ours, BG_DARK);
  const naive = run(naiveMaterial(straight), BG_LIGHT);
  renderer.dispose();
  return { codec: hevc ? ("hevc" as const) : ("vp9" as const), light, dark, naive };
}

async function bandingTest(canvas: HTMLCanvasElement) {
  const size = 512;
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.toneMapping = NoToneMapping;
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const target = new WebGLRenderTarget(size, size, { type: HalfFloatType });
  // Тёмное предрассветное небо: от #141824 к #1C2230 — всего ~12 уровней на 512 px.
  const sky = new ShaderMaterial({
    uniforms: { c0: { value: [20, 24, 36].map(dec) }, c1: { value: [28, 34, 48].map(dec) } },
    vertexShader:
      "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader:
      "uniform vec3 c0; uniform vec3 c1; varying vec2 vUv; void main(){ gl_FragColor = vec4(mix(c0, c1, vUv.y), 1.0); }",
  });
  const skyScene = new Scene();
  skyScene.add(new Mesh(new PlaneGeometry(2, 2), sky));
  renderer.setRenderTarget(target);
  renderer.render(skyScene, camera);
  renderer.setRenderTarget(null);

  const noise = await new TextureLoader().loadAsync(assets.blueNoise.url);
  const post = createPostMaterial(noise);
  post.uniforms.tScene!.value = target.texture;
  post.uniforms.uGrain!.value = 0;
  post.uniforms.uVignette!.value = 0;
  const quad = new Scene();
  quad.add(new Mesh(new PlaneGeometry(2, 2), post));

  const measure = (dither: boolean) => {
    post.uniforms.uDither!.value = dither ? 1 : 0;
    renderer.render(quad, camera);
    const gl = renderer.getContext();
    const px = new Uint8Array(size * size * 4);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
    // Средняя яркость строки (синий канал — самый «ступенчатый» в индиго) по 256 центральным столбцам.
    const rows: number[] = [];
    for (let y = 0; y < size; y++) {
      let sum = 0;
      for (let x = 128; x < 384; x++) sum += px[(y * size + x) * 4 + 2]!;
      rows.push(sum / 256);
    }
    let maxStep = 0;
    for (let y = 1; y < size; y++) maxStep = Math.max(maxStep, Math.abs(rows[y]! - rows[y - 1]!));
    // Самая длинная «полоса» одного значения в одном столбце.
    let maxRun = 0;
    let run = 1;
    for (let y = 1; y < size; y++) {
      const same = px[(y * size + 256) * 4 + 2] === px[((y - 1) * size + 256) * 4 + 2];
      run = same ? run + 1 : 1;
      maxRun = Math.max(maxRun, run);
    }
    return { maxStep: Math.round(maxStep * 1000) / 1000, maxRun };
  };
  const plain = measure(false);
  const dithered = measure(true);
  renderer.dispose();
  return { dithered, plain };
}

export default function RenderTest() {
  const videoCanvas = useRef<HTMLCanvasElement>(null);
  const bandCanvas = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<RenderTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const halo = await haloTest(videoCanvas.current!);
        const banding = await bandingTest(bandCanvas.current!);
        const r: RenderTestResult = { codec: halo.codec, halo, banding };
        (window as unknown as { __renderTest: RenderTestResult }).__renderTest = r;
        if (!cancelled) setResult(r);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ok = (v: boolean) => (v ? "да ✓" : "НЕТ ✗");
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <canvas
          ref={videoCanvas}
          width={W}
          height={H}
          style={{ width: 320, height: 180 }}
          aria-hidden="true"
        />
        <canvas
          ref={bandCanvas}
          width={512}
          height={512}
          style={{ width: 256, height: 256 }}
          aria-hidden="true"
        />
      </div>
      <output
        data-render-test=""
        style={{ whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", fontSize: 14 }}
      >
        {error
          ? `Ошибка: ${error}`
          : !result
            ? "Проверяем…"
            : [
                `Кодек: ${result.codec === "hevc" ? "HEVC + alpha (Safari)" : "VP9 + alpha (WebM)"}`,
                `Без ореолов на светлом фоне: ${ok(result.halo.light.bad === 0)} (край: ${result.halo.light.edgePixels} px, макс. отклонение ${result.halo.light.maxDiff}/255)`,
                `Без ореолов на тёмном фоне: ${ok(result.halo.dark.bad === 0)} (макс. отклонение ${result.halo.dark.maxDiff}/255)`,
                `Контроль: наивный путь даёт ореол: ${ok(result.halo.naive.maxDiff > 20)} (макс. ${result.halo.naive.maxDiff}/255)`,
                `Без полос с дизерингом: ${ok(result.banding.dithered.maxStep < 0.35)} (шаг ${result.banding.dithered.maxStep}, полоса ${result.banding.dithered.maxRun} px)`,
                `Без дизеринга полосы видны: ${ok(result.banding.plain.maxStep >= 0.9)} (шаг ${result.banding.plain.maxStep}, полоса ${result.banding.plain.maxRun} px)`,
              ].join("\n")}
      </output>
    </div>
  );
}
