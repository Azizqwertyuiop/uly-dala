/*
 * Заглушка Gaussian Splatting фазенды (глава 5, уровень high) — пока нет съёмки (docs/assets.md).
 * Формат .splat (antimatter15): на сплат 32 байта — позиция 3×f32, масштаб 3×f32 (линейный),
 * цвет RGBA 4×u8 (sRGB, как у съёмки), поворот 4×u8 (кватернион w,x,y,z: q·128 + 128).
 * Оси — как в сцене: Y вверх, камера смотрит по −Z. Зоны — те же, что в world/timeline.ts.
 * Запуск: node scripts/generate-splat.mjs → public/assets/splats/fazenda.splat
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { ZONES } from "./lib/fazenda-zones.mjs";

const OUT = new URL("../public/assets/splats/", import.meta.url);
mkdirSync(OUT, { recursive: true });

let seed = 7;
const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());

const splats = [];
const push = (x, y, z, s, [r, g, b], a = 230, sy = s) =>
  splats.push({ x, y, z, sx: s, sy, sz: s, r, g, b, a });

// Земля: тёмная трава и тропинки, ночь.
for (let i = 0; i < 16000; i++) {
  const r = Math.sqrt(rand()) * 34;
  const a = rand() * Math.PI * 2;
  const x = Math.cos(a) * r;
  const z = Math.sin(a) * r - 9;
  const shade = 14 + rand() * 16;
  push(x, rand() * 0.05, z, 0.18 + rand() * 0.2, [shade * 0.9, shade, shade * 0.75], 235, 0.03);
}
// Поле: столбы и гирлянда тёплых ламп.
{
  const [cx, cz] = ZONES.field;
  for (let p = 0; p < 5; p++) {
    const px = cx - 6 + p * 3;
    for (let h = 0; h < 30; h++) push(px, h * 0.1, cz - 2, 0.04, [40, 32, 26], 250);
  }
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const x = cx - 6 + t * 12;
    const y = 2.9 - Math.sin(t * Math.PI * 4) ** 2 * 0.35;
    push(x, y, cz - 2, 0.05, [255, 196, 120], 255);
    for (let g = 0; g < 3; g++)
      push(
        x + gauss() * 0.15,
        y + gauss() * 0.15,
        cz - 2 + gauss() * 0.15,
        0.12,
        [255, 150, 70],
        60,
      );
  }
}
// Шатёр: белый тент, тёплый свет изнутри.
{
  const [cx, cz] = ZONES.tent;
  for (let i = 0; i < 8000; i++) {
    const side = rand();
    let x, y, z;
    if (side < 0.55) {
      // Стенки 6 × 5 м, высота 2,6 м.
      const u = rand() * 22;
      y = rand() * 2.6;
      if (u < 6) [x, z] = [cx - 3 + u, cz - 2.5];
      else if (u < 11) [x, z] = [cx + 3, cz - 2.5 + (u - 6)];
      else if (u < 17) [x, z] = [cx + 3 - (u - 11), cz + 2.5];
      else [x, z] = [cx - 3, cz + 2.5 - (u - 17)];
    } else {
      // Крыша-пирамида.
      const k = rand();
      x = cx + (rand() * 2 - 1) * 3 * (1 - k);
      z = cz + (rand() * 2 - 1) * 2.5 * (1 - k);
      y = 2.6 + k * 1.3;
    }
    const warm = 180 + rand() * 60;
    push(x, y, z, 0.07, [warm, warm * 0.86, warm * 0.68], 230);
  }
}
// Юрта: войлочный купол, открытая дверь с тёплым светом.
{
  const [cx, cz] = ZONES.yurt;
  for (let i = 0; i < 8000; i++) {
    const a = rand() * Math.PI * 2;
    const k = rand();
    const wall = k < 0.45;
    const r = wall ? 3.0 : 3.0 * (1 - (k - 0.45) / 0.55) + 0.6 * ((k - 0.45) / 0.55);
    const y = wall ? (k / 0.45) * 1.6 : 1.6 + ((k - 0.45) / 0.55) * 1.5;
    const door =
      wall && Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.17;
    const c = door ? [240, 170, 90] : [150 + rand() * 30, 136 + rand() * 25, 118 + rand() * 20];
    push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, 0.07, c, door ? 255 : 235);
  }
}
// Кухня: огонь, дым, длинный стол.
{
  const [cx, cz] = ZONES.kitchen;
  for (let i = 0; i < 1500; i++) {
    const r = Math.abs(gauss()) * 0.25;
    const a = rand() * Math.PI * 2;
    const y = Math.abs(gauss()) * 0.35;
    const hot = 1 - Math.min(1, y / 0.8);
    push(
      cx + 2 + Math.cos(a) * r,
      y,
      cz + Math.sin(a) * r,
      0.05,
      [255, 90 + hot * 120, 30 + hot * 60],
      240,
    );
  }
  for (let i = 0; i < 1200; i++)
    push(cx + 2 + gauss() * 0.3, 0.6 + rand() * 3, cz + gauss() * 0.3, 0.25, [60, 56, 54], 40);
  for (let i = 0; i < 2000; i++)
    push(
      cx - 2 + rand() * 4,
      0.75 + rand() * 0.04,
      cz - 0.6 + rand() * 1.2,
      0.07,
      [120, 86, 60],
      250,
    );
}

const buffer = Buffer.alloc(splats.length * 32);
splats.forEach((s, i) => {
  const o = i * 32;
  buffer.writeFloatLE(s.x, o);
  buffer.writeFloatLE(s.y, o + 4);
  buffer.writeFloatLE(s.z, o + 8);
  buffer.writeFloatLE(s.sx, o + 12);
  buffer.writeFloatLE(s.sy, o + 16);
  buffer.writeFloatLE(s.sz, o + 20);
  buffer[o + 24] = Math.round(Math.min(255, s.r));
  buffer[o + 25] = Math.round(Math.min(255, s.g));
  buffer[o + 26] = Math.round(Math.min(255, s.b));
  buffer[o + 27] = s.a;
  // Без поворота: w = 1.
  buffer[o + 28] = 255;
  buffer[o + 29] = 128;
  buffer[o + 30] = 128;
  buffer[o + 31] = 128;
});
writeFileSync(new URL("fazenda.splat", OUT), buffer);
console.log(
  `public/assets/splats/fazenda.splat  ${splats.length} сплатов, ${Math.round(buffer.length / 1024)} КБ`,
);
