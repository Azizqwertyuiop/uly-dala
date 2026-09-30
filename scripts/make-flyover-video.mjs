/*
 * Заглушка видео облёта фазенды (глава 5, уровень medium) — пока нет съёмки (docs/assets.md).
 * Без альфы, поэтому один файл на все браузеры: H.264 в MP4 (аппаратное декодирование везде),
 * Swift + AVFoundation (встроено в macOS). Ключевой кадр каждые 12 кадров (0,5 с) —
 * видео перематывается скроллом (остановки в зонах). Плюс постер (.png).
 * Запуск: node scripts/make-flyover-video.mjs   (только macOS)
 */
import { spawn } from "node:child_process";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { drawFlyoverFrame, FLYOVER_SECONDS } from "./lib/flyover-frames.mjs";
import { encodePng } from "./lib/png.mjs";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("public/assets/video/", ROOT);
mkdirSync(OUT, { recursive: true });

const FPS = 24;
const FRAMES = FPS * FLYOVER_SECONDS;
// Кратно 16 — размер макроблока H.264.
const [W, H] = [1024, 576];
const KEY = 12;

function poster() {
  const frame = new Uint8ClampedArray(W * H * 4);
  drawFlyoverFrame(1.5, W, H, frame);
  writeFileSync(
    new URL("fazenda-flyover.poster.png", OUT),
    encodePng(W, H, new Uint8Array(frame.buffer)),
  );
}

function h264() {
  return new Promise((resolve, reject) => {
    const out = new URL("fazenda-flyover.medium.mp4", OUT).pathname;
    const swift = spawn(
      "swift",
      [new URL("scripts/lib/encode-h264.swift", ROOT).pathname, W, H, FPS, FRAMES, KEY, out].map(
        String,
      ),
      { stdio: ["pipe", "inherit", "inherit"] },
    );
    swift.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(`swift: ${code}`))));
    const frame = new Uint8ClampedArray(W * H * 4);
    let i = 0;
    const pump = () => {
      while (i < FRAMES) {
        drawFlyoverFrame(i / FPS, W, H, frame);
        i++;
        // Копия кадра: буфер frame перерисовывается раньше, чем поток успевает записать данные.
        if (!swift.stdin.write(Buffer.from(frame))) return swift.stdin.once("drain", pump);
      }
      swift.stdin.end();
    };
    pump();
  });
}

console.log("Облёт фазенды (заглушка):");
poster();
await h264();
for (const f of ["fazenda-flyover.medium.mp4", "fazenda-flyover.poster.png"]) {
  console.log(`  ${f}  ${Math.round(statSync(new URL(f, OUT)).size / 1024)} КБ`);
}
