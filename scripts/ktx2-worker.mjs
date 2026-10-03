/*
 * Воркер KTX2 отдельным файлом (CLAUDE.md, раздел 14: CSP не должна ломать декодеры).
 * Транскодер Basis (Emscripten/embind) создаёт функции через new Function — это 'unsafe-eval'.
 * KTX2Loader по умолчанию собирает воркер в blob:, а blob-воркер наследует CSP страницы
 * (без eval). Поэтому тот же самый код воркера лежит файлом /assets/decoders/basis/ktx2-worker.js
 * и отдаётся со своей узкой CSP (eval разрешён только в нём, next.config.ts).
 *
 * Тело — ровно как у KTX2Loader.init() в three; совпадение проверяет src/canvas/ktx2Worker.test.ts.
 * Запуск: node scripts/ktx2-worker.mjs (вызывается и из npm run assets).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

const ROOT = new URL("../", import.meta.url);
export const KTX2_WORKER_FILE = new URL("public/assets/decoders/basis/ktx2-worker.js", ROOT);

export function ktx2WorkerSource() {
  const jsContent = readFileSync(
    new URL("node_modules/three/examples/jsm/libs/basis/basis_transcoder.js", ROOT),
    "utf8",
  );
  const fn = KTX2Loader.BasisWorker.toString();
  return [
    "/* Сгенерировано scripts/ktx2-worker.mjs — не редактировать вручную. */",
    "/* constants */",
    "let _EngineFormat = " + JSON.stringify(KTX2Loader.EngineFormat),
    "let _EngineType = " + JSON.stringify(KTX2Loader.EngineType),
    "let _TranscoderFormat = " + JSON.stringify(KTX2Loader.TranscoderFormat),
    "let _BasisFormat = " + JSON.stringify(KTX2Loader.BasisFormat),
    "/* basis_transcoder.js */",
    jsContent,
    "/* worker */",
    fn.substring(fn.indexOf("{") + 1, fn.lastIndexOf("}")),
  ].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(KTX2_WORKER_FILE, ktx2WorkerSource());
  console.log("  воркер KTX2 → public/assets/decoders/basis/ktx2-worker.js");
}
