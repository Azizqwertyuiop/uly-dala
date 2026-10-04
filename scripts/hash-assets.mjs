/*
 * Хеш содержимого в имени ассета (CLAUDE.md, раздел 12; шаг 20 — CDN и кэш).
 * Для каждого файла public/assets/** (кроме decoders/ и docs/) — первые 10 символов sha256.
 * Результат — src/lib/assets/hashes.json: «/assets/models/yurt.high.glb» → «3fa9c1d2e0».
 * Адрес в коде: /assets/models/yurt.high.3fa9c1d2e0.glb (src/lib/assets/url.ts) — кэш навсегда
 * (immutable): новый файл = новое имя.
 *
 * Не хешируются: decoders/ (транскодер грузит соседние файлы по фиксированным именам, воркер KTX2
 * отдаётся со своей CSP по фиксированному адресу) и docs/ (имя PDF видит человек при скачивании).
 *
 * Запуск: npm run assets:hash (и автоматически перед npm run build).
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PUBLIC = join(ROOT, "public");
const ASSETS = join(PUBLIC, "assets");
export const HASHES_FILE = join(ROOT, "src/lib/assets/hashes.json");
const SKIP = new Set(["decoders", "docs"]);

function* walk(dir) {
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

export function computeHashes() {
  const hashes = {};
  for (const top of readdirSync(ASSETS).sort()) {
    if (SKIP.has(top) || top.startsWith(".")) continue;
    const path = join(ASSETS, top);
    const files = statSync(path).isDirectory() ? [...walk(path)] : [path];
    for (const file of files) {
      const url = "/" + relative(PUBLIC, file).split(sep).join("/");
      hashes[url] = createHash("sha256").update(readFileSync(file)).digest("hex").slice(0, 10);
    }
  }
  return hashes;
}

export const serialize = (hashes) => JSON.stringify(hashes, null, 2) + "\n";

if (import.meta.url === `file://${process.argv[1]}`) {
  const hashes = computeHashes();
  writeFileSync(HASHES_FILE, serialize(hashes));
  console.log(`  хеши ассетов: ${Object.keys(hashes).length} файлов → src/lib/assets/hashes.json`);
}
