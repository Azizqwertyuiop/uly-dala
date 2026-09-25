/*
 * Тестовое видео коня с альфой — пока нет офлайн-рендера от художника (docs/assets.md).
 *   HEVC + alpha (.mov)  — Safari: Swift + AVFoundation (встроено в macOS)
 *   VP9 + alpha (.webm)  — остальные: WebCodecs в Chromium (Playwright) + webm-muxer
 *   постер (.png, альфа) — при блокировке автоплея
 * Варианты: high (десктоп), medium (мобильные). Настоящие: 4K и 1080p, здесь — меньше.
 *
 * Запуск: npm run assets:video   (только macOS: HEVC с альфой кодирует AVFoundation)
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { drawHorseFrame } from "./lib/horse-frames.mjs";
import { encodePng } from "./lib/png.mjs";
import { writeVp9AlphaWebm } from "./lib/webm-alpha.mjs";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("public/assets/video/", ROOT);
mkdirSync(OUT, { recursive: true });

const FPS = 24;
const SECONDS = 9; // петля 8–12 с (раздел 6); пар дыхания — дважды за петлю
const FRAMES = FPS * SECONDS;
const VARIANTS = { high: [1280, 720], medium: [640, 360] };

function poster() {
  const [w, h] = VARIANTS.high;
  const px = drawHorseFrame(0.8, w, h, new Uint8ClampedArray(w * h * 4));
  writeFileSync(new URL("horse-test.poster.png", OUT), encodePng(w, h, new Uint8Array(px.buffer)));
  console.log("  horse-test.poster.png");
}

function hevc(variant, [w, h]) {
  return new Promise((resolve, reject) => {
    const out = new URL(`horse-test.${variant}.mov`, OUT).pathname;
    const swift = spawn(
      "swift",
      [new URL("scripts/lib/encode-hevc-alpha.swift", ROOT).pathname, w, h, FPS, FRAMES, out].map(
        String,
      ),
      {
        stdio: ["pipe", "inherit", "inherit"],
      },
    );
    swift.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(`swift: ${code}`))));
    const frame = new Uint8ClampedArray(w * h * 4);
    let i = 0;
    const pump = () => {
      while (i < FRAMES) {
        drawHorseFrame(i / FPS, w, h, frame);
        i++;
        if (!swift.stdin.write(Buffer.from(frame.buffer))) return swift.stdin.once("drain", pump);
      }
      swift.stdin.end();
    };
    pump();
  }).then((out) => console.log(`  ${out.split("/").pop()}`));
}

async function vp9(browser, origin, variant, [w, h]) {
  const page = await browser.newPage();
  // WebCodecs доступны только в безопасном контексте — localhost подходит.
  await page.goto(origin);
  await page.addScriptTag({ content: `window.drawHorseFrame = ${drawHorseFrame.toString()};` });
  // Chromium не кодирует альфу через WebCodecs — кодируем два потока: цвет и альфу (как яркость).
  const encoded = await page.evaluate(
    async ({ w, h, fps, frames }) => {
      const toBase64 = (bytes) => {
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000)
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(binary);
      };
      const make = (sink) => {
        const encoder = new VideoEncoder({
          output: (chunk) => {
            const bytes = new Uint8Array(chunk.byteLength);
            chunk.copyTo(bytes);
            sink.push({ t: chunk.timestamp, key: chunk.type === "key", data: toBase64(bytes) });
          },
          error: (e) => console.error(e),
        });
        encoder.configure({
          codec: "vp09.00.10.08",
          width: w,
          height: h,
          bitrate: 2_500_000,
          framerate: fps,
          latencyMode: "quality",
        });
        return encoder;
      };
      const colorChunks = [];
      const alphaChunks = [];
      const color = make(colorChunks);
      const alpha = make(alphaChunks);
      const rgba = new Uint8ClampedArray(w * h * 4);
      const yuv = new Uint8Array(w * h * 1.5).fill(128);
      for (let i = 0; i < frames; i++) {
        window.drawHorseFrame(i / fps, w, h, rgba);
        const timestamp = Math.round((i * 1e6) / fps);
        const duration = Math.round(1e6 / fps);
        const keyFrame = i % (fps * 2) === 0;
        const cf = new VideoFrame(rgba, {
          format: "RGBX",
          codedWidth: w,
          codedHeight: h,
          timestamp,
          duration,
        });
        color.encode(cf, { keyFrame });
        cf.close();
        for (let p = 0; p < w * h; p++) yuv[p] = rgba[p * 4 + 3];
        const af = new VideoFrame(yuv, {
          format: "I420",
          codedWidth: w,
          codedHeight: h,
          timestamp,
          duration,
        });
        alpha.encode(af, { keyFrame });
        af.close();
        if (color.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 5));
      }
      await color.flush();
      await alpha.flush();
      return { colorChunks, alphaChunks };
    },
    { w, h, fps: FPS, frames: FRAMES },
  );
  const alphaByTime = new Map(encoded.alphaChunks.map((c) => [c.t, c]));
  const frames = encoded.colorChunks.map((c) => ({
    timestampUs: c.t,
    key: c.key,
    color: Buffer.from(c.data, "base64"),
    alpha: Buffer.from(alphaByTime.get(c.t).data, "base64"),
  }));
  writeFileSync(
    new URL(`horse-test.${variant}.webm`, OUT),
    writeVp9AlphaWebm({ width: w, height: h, fps: FPS, frames }),
  );
  await page.close();
  console.log(`  horse-test.${variant}.webm`);
}

console.log("Тестовое видео:");
poster();
const server = createServer((_, res) => res.end("<!doctype html><title>encode</title>"));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
try {
  for (const [variant, size] of Object.entries(VARIANTS)) {
    await vp9(browser, origin, variant, size);
    await hevc(variant, size);
  }
} finally {
  await browser.close();
  server.close();
}
