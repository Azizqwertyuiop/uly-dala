/*
 * Конвейер ассетов (CLAUDE.md, раздел 6): assets-src → public/assets.
 *
 *   модели  assets-src/models/*.glb → public/assets/models/<имя>.{high,medium}.glb
 *           dedup → prune → weld → (medium: simplify) → textureResize → KTX2 → quantize → meshopt
 *           KTX2: ETC1S — цвет/эмиссия (sRGB), UASTC — нормали (линейные).
 *   декодеры three/examples/jsm/libs/basis → public/assets/decoders/basis (локально, без CDN)
 *
 * Запуск: npm run assets        (после изменения исходников)
 * Без системных программ: KTX2 — ktx2-encoder (WASM Basis Universal), картинки — sharp.
 */
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { Logger, NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  meshopt,
  prune,
  quantize,
  simplify,
  textureCompress,
  weld,
} from "@gltf-transform/functions";
import { ktx2 } from "ktx2-encoder/gltf-transform";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const ROOT = new URL("../", import.meta.url);
const SRC = new URL("assets-src/models/", ROOT);
const OUT = new URL("public/assets/models/", ROOT);
const DECODERS = new URL("public/assets/decoders/basis/", ROOT);

// Кодировщик Basis (WASM) печатает отладку в stdout даже с enableDebug: false — отсекаем её.
const NOISY =
  /^(Encoding slice|Slice: |Mode: |basis_|Total slices|Processing|Image |Source image|Using |Wrote |Compression|Total |Output |Encoding |Layer |Mipmap |Frame |ETC1S|UASTC)/;
const writeOut = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, ...rest) =>
  String(chunk)
    .split("\n")
    .every((line) => line === "" || NOISY.test(line))
    ? true
    : writeOut(chunk, ...rest);

const VARIANTS = {
  // high — десктоп; medium — мобильные и встроенные браузеры (раздел 6).
  high: { maxTexture: 2048, simplifyRatio: 1 },
  medium: { maxTexture: 1024, simplifyRatio: 0.6 },
};

/** Декодер картинок для ktx2-encoder в Node. */
async function imageDecoder(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data) };
}

function copyDecoders() {
  mkdirSync(DECODERS, { recursive: true });
  const libs = new URL("node_modules/three/examples/jsm/libs/basis/", ROOT);
  for (const file of ["basis_transcoder.js", "basis_transcoder.wasm"]) {
    copyFileSync(new URL(file, libs), new URL(file, DECODERS));
  }
  console.log("  декодеры KTX2 → public/assets/decoders/basis/");
}

async function optimize(file, variant, opts) {
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
  });
  const doc = await io.read(new URL(file, SRC).pathname);
  doc.setLogger(new Logger(Logger.Verbosity.WARN));

  // keepAttributes: UV остаются, даже если в файле у материала нет текстуры — видео и экраны
  // назначаются в коде (horse_plane, led_screen). Без этого prune() удалит TEXCOORD_0.
  const steps = [dedup(), prune({ keepAttributes: true }), weld()];
  if (opts.simplifyRatio < 1) {
    steps.push(
      simplify({ simplifier: MeshoptSimplifier, ratio: opts.simplifyRatio, error: 0.001 }),
    );
  }
  steps.push(
    // Ограничение размера текстур для варианта (перекодирование в PNG перед KTX2).
    textureCompress({
      encoder: sharp,
      targetFormat: "png",
      resize: [opts.maxTexture, opts.maxTexture],
    }),
    // Нормали — UASTC (линейные, без артефактов блоков).
    ktx2({
      isUASTC: true,
      slots: /normalTexture/,
      isNormalMap: true,
      generateMipmap: true,
      needSupercompression: true,
      imageDecoder,
    }),
    // Цвет и эмиссия — ETC1S в sRGB.
    ktx2({
      isUASTC: false,
      slots: /baseColorTexture|emissiveTexture/,
      isSetKTX2SRGBTransferFunc: true,
      generateMipmap: true,
      qualityLevel: 160,
      imageDecoder,
    }),
    // Прочие (roughness/metalness/occlusion) — ETC1S линейные.
    ktx2({
      isUASTC: false,
      slots: /metallicRoughnessTexture|occlusionTexture/,
      generateMipmap: true,
      imageDecoder,
    }),
    quantize(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await doc.transform(...steps);

  const name = file.replace(/\.glb$/, "");
  const out = new URL(`${name}.${variant}.glb`, OUT).pathname;
  await io.write(out, doc);
  const before = statSync(new URL(file, SRC)).size;
  const after = statSync(out).size;
  console.log(
    `  ${name}.${variant}.glb  ${(before / 1024).toFixed(0)} КБ → ${(after / 1024).toFixed(0)} КБ`,
  );
}

mkdirSync(OUT, { recursive: true });
console.log("Ассеты:");
copyDecoders();
for (const file of readdirSync(SRC).filter((f) => f.endsWith(".glb"))) {
  for (const [variant, opts] of Object.entries(VARIANTS)) await optimize(file, variant, opts);
}
