/*
 * Фото команды на главной (решение заказчика 12.11.2026).
 *   assets-src/photos/team/<one|two|three>.(jpg|jpeg|png|webp|heic) — оригиналы (в git не попадают)
 *   → public/assets/photos/team/<key>.jpg — кадр 4:5, 800×1000, без EXIF/GPS
 * Кадрирование — от верха (голова не обрезается). HEIC переводится в JPEG через sips (macOS).
 * После запуска укажите фото в src/content/team.ts. Запуск: npm run assets:team.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = join(ROOT, "assets-src/photos/team");
const OUT = join(ROOT, "public/assets/photos/team");

mkdirSync(SRC, { recursive: true });
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const file of readdirSync(SRC).filter((f) => /\.(jpe?g|png|webp|heic)$/i.test(f))) {
  const { name } = parse(file);
  let input = join(SRC, file);
  if (/\.heic$/i.test(file)) {
    const tmp = join(tmpdir(), `uly-team-${name}.jpg`);
    execFileSync("sips", ["-s", "format", "jpeg", input, "--out", tmp], { stdio: "ignore" });
    input = tmp;
  }
  await sharp(input)
    .rotate()
    .resize(800, 1000, { fit: "cover", position: "top", withoutEnlargement: false })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(join(OUT, `${name}.jpg`));
  console.log(`  команда: ${file} → /assets/photos/team/${name}.jpg`);
}
