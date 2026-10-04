/*
 * Упаковка релиза после next build (шаг 20, docs/deploy.md).
 * .next/standalone становится самодостаточным релизом:
 *   server.js, node_modules, .next/   — сервер Next.js (запуск: node server.js)
 *   public/, .next/static/            — статика для самого Next (запасной путь)
 *   cdn/_next/static/**               — сборка JS/CSS (имена уже с хешем)
 *   cdn/assets/**\/name.<хеш>.ext     — ассеты с хешем содержимого в имени
 *   RELEASE                           — id релиза (коммит)
 * cdn/ на сервере сливается в общее хранилище (без удаления старого): страницы, открытые до
 * выкладки, догружают свои файлы и после неё. Caddy отдаёт cdn/ с Cache-Control: immutable.
 * Файлы cdn/assets — жёсткие ссылки на public/ (место на диске и в архиве не удваивается).
 */
import {
  cpSync,
  existsSync,
  linkSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const OUT = join(ROOT, ".next/standalone");
if (!existsSync(join(OUT, "server.js")))
  throw new Error("нет .next/standalone — сначала next build");

const hashes = JSON.parse(readFileSync(join(ROOT, "src/lib/assets/hashes.json"), "utf8"));

for (const dir of ["public", ".next/static", "cdn"])
  rmSync(join(OUT, dir), { recursive: true, force: true });
cpSync(join(ROOT, "public"), join(OUT, "public"), { recursive: true });
cpSync(join(ROOT, ".next/static"), join(OUT, ".next/static"), { recursive: true });
cpSync(join(ROOT, ".next/static"), join(OUT, "cdn/_next/static"), { recursive: true });

for (const [path, hash] of Object.entries(hashes)) {
  const dot = path.lastIndexOf(".");
  const target = join(OUT, "cdn", `${path.slice(0, dot)}.${hash}${path.slice(dot)}`);
  mkdirSync(dirname(target), { recursive: true });
  linkSync(join(OUT, "public", path), target);
}

let release = process.env.RELEASE;
if (!release) {
  try {
    release = execSync("git rev-parse --short=12 HEAD", { cwd: ROOT }).toString().trim();
  } catch {
    release = "local";
  }
}
writeFileSync(join(OUT, "RELEASE"), release + "\n");
console.log(`  релиз ${release} → .next/standalone (cdn: ${Object.keys(hashes).length} ассетов)`);
