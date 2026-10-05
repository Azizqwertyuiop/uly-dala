/*
 * Фото событий «Дня» (CLAUDE.md, разделы 2, 17; требования — docs/assets.md).
 *   assets-src/photos/day/<формат>.(jpg|jpeg|png|webp|tif|heic)  — оригинал (в git не попадает)
 *   → public/assets/photos/day/<формат>-<ширина>.jpg               — 750, 1200, 1800 px, 3:2
 *     (не больше ширины оригинала — без растягивания)
 *   → src/content/day-photos.json                                  — какие форматы уже со снимком
 * Кадрирование 3:2 по «самому интересному» (sharp attention), JPEG mozjpeg, без EXIF/GPS
 * (метаданные с геопозицией и камерой не публикуются).
 * Запуск: npm run assets:photos (затем npm run assets:hash — хеш в имени для кэша).
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SRC = join(ROOT, "assets-src/photos/day");
const OUT = join(ROOT, "public/assets/photos/day");
const MANIFEST = join(ROOT, "src/content/day-photos.json");
const SLUGS = [
  "conference",
  "coffee-break",
  "team-building",
  "kudalyk",
  "wedding",
  "private-party",
];
export const PHOTO_WIDTHS = [750, 1200, 1800];

mkdirSync(SRC, { recursive: true });
mkdirSync(OUT, { recursive: true });

const manifest = {};
for (const file of readdirSync(SRC).sort()) {
  const { name, ext } = parse(file);
  if (!/^\.(jpe?g|png|webp|tiff?|heic)$/i.test(ext)) continue;
  if (!SLUGS.includes(name)) {
    console.warn(`  пропущен ${file}: имя — один из форматов (${SLUGS.join(", ")})`);
    continue;
  }
  const input = sharp(join(SRC, file)).rotate(); // поворот по EXIF, сами метаданные не пишутся
  const meta = await input.metadata();
  // Не растягиваем: размеры — только не больше оригинала.
  const source = meta.width ?? 0;
  const fit = PHOTO_WIDTHS.filter((w) => w <= source);
  // Оригинал меньше самого маленького размера — одна версия в родной ширине.
  if (fit.length === 0) fit.push(source);
  if ((meta.width ?? 0) < 1800)
    console.warn(`  ${file}: ${meta.width}px — меньше 1800, на большом экране будет мягким`);
  for (const width of fit) {
    const out = join(OUT, `${name}-${width}.jpg`);
    const info = await input
      .clone()
      .resize(width, Math.round((width * 2) / 3), {
        fit: "cover",
        position: sharp.strategy.attention,
      })
      .jpeg({ quality: width >= 1800 ? 76 : 80, mozjpeg: true, progressive: true })
      .toFile(out);
    console.log(`  ${name}-${width}.jpg — ${Math.round(info.size / 1024)} КБ`);
  }
  manifest[name] = fit;
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  `  фото «Дня»: ${Object.keys(manifest).length} из ${SLUGS.length} форматов → src/content/day-photos.json`,
);
