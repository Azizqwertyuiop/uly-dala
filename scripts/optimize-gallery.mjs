/*
 * Карусели фото на главной (решения заказчика 12–13.11.2026). Два набора:
 *   gallery — тимбилдинги, fazenda — фазенда: карточки 4:5, превью покрывает 900×1125.
 *   assets-src/photos/<набор>/*.(jpg|jpeg|png|webp|heic) — оригиналы (в git не попадают)
 *   → public/assets/photos/<набор>/<имя>-<thumb|full>.jpg — превью и крупно (≤ 1600)
 *   → src/content/<набор>-photos.json (gallery — src/content/gallery.json) — порядок и размеры
 * Порядок — по имени файла. HEIC с iPhone переводится в JPEG системной sips (macOS).
 * EXIF/GPS не публикуются. Запуск: npm run assets:gallery / npm run assets:fazenda.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SETS = {
  gallery: { thumb: { width: 900, height: 1125 }, manifest: "src/content/gallery.json" },
  fazenda: { thumb: { width: 900, height: 1125 }, manifest: "src/content/fazenda-photos.json" },
};
const SET = process.argv[2] ?? "gallery";
if (!(SET in SETS)) throw new Error(`Неизвестный набор: ${SET}. Есть: ${Object.keys(SETS)}`);
const { thumb: THUMB, manifest } = SETS[SET];
const SRC = join(ROOT, "assets-src/photos", SET);
const OUT = join(ROOT, "public/assets/photos", SET);
const MANIFEST = join(ROOT, manifest);
const SIZES = { thumb: THUMB.width, full: 1600 };

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
    const tmp = join(tmpdir(), `uly-${SET}-${i}.jpg`);
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
      // Крупно — целиком в квадрат px; превью — покрывает карточку карусели (обрезает CSS).
      .resize(
        kind === "full"
          ? { width: px, height: px, fit: "inside", withoutEnlargement: true }
          : { ...THUMB, fit: "outside", withoutEnlargement: true },
      )
      .jpeg({ quality: kind === "full" ? 78 : 76, mozjpeg: true, progressive: true })
      .toFile(join(OUT, `${name}-${kind}.jpg`));
    if (kind === "full") size = { width: info.width, height: info.height };
  }
  items.push({ name, ...size });
  console.log(`  ${parse(file).base} → ${name} (${size.width}×${size.height})`);
}
writeFileSync(MANIFEST, JSON.stringify(items, null, 2) + "\n");
console.log(`  ${SET}: ${items.length} фото → ${manifest}`);
