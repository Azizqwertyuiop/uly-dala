/*
 * Галерея тимбилдингов на главной (решение заказчика 12.11.2026).
 *   assets-src/photos/gallery/*.(jpg|jpeg|png|webp|heic) — оригиналы (в git не попадают)
 *   → public/assets/photos/gallery/<имя>-<900|1600>.jpg     — превью (покрывает 900×1125) и крупно (≤ 1600)
 *   → src/content/gallery.json                              — порядок (по имени файла) и размеры
 * HEIC с iPhone переводится в JPEG системной sips (macOS). EXIF/GPS не публикуются.
 * Запуск: npm run assets:gallery (затем хеш в имени — npm run assets:hash, входит в команду).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = join(ROOT, "assets-src/photos/gallery");
const OUT = join(ROOT, "public/assets/photos/gallery");
const MANIFEST = join(ROOT, "src/content/gallery.json");
const SIZES = { thumb: 900, full: 1600 };

mkdirSync(SRC, { recursive: true });
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC)
  .filter((f) => /\.(jpe?g|png|webp|heic)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));

const items = [];
for (const [i, file] of files.entries()) {
  let input = join(SRC, file);
  if (/\.heic$/i.test(file)) {
    const tmp = join(tmpdir(), `uly-gallery-${i}.jpg`);
    execFileSync(
      "sips",
      ["-s", "format", "jpeg", "-s", "formatOptions", "95", input, "--out", tmp],
      {
        stdio: "ignore",
      },
    );
    input = tmp;
  }
  const name = String(i + 1).padStart(2, "0");
  const base = sharp(input).rotate();
  let size = null;
  for (const [kind, px] of Object.entries(SIZES)) {
    const info = await base
      .clone()
      // Крупно — целиком в квадрат px; превью — покрывает карточку карусели 4:5 (обрезает CSS).
      .resize(
        kind === "full"
          ? { width: px, height: px, fit: "inside", withoutEnlargement: true }
          : {
              width: px,
              height: Math.round((px * 5) / 4),
              fit: "outside",
              withoutEnlargement: true,
            },
      )
      .jpeg({ quality: kind === "full" ? 78 : 76, mozjpeg: true, progressive: true })
      .toFile(join(OUT, `${name}-${kind}.jpg`));
    if (kind === "full") size = { width: info.width, height: info.height };
  }
  items.push({ name, ...size });
  console.log(`  ${parse(file).base} → ${name} (${size.width}×${size.height})`);
}
writeFileSync(MANIFEST, JSON.stringify(items, null, 2) + "\n");
console.log(`  галерея: ${items.length} фото → src/content/gallery.json`);
