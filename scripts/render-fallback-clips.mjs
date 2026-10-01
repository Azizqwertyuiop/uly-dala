/*
 * Заглушки видео-секвенций fallback (CLAUDE.md, раздел 6) — снимаются с нашей же 3D-сцены:
 * браузер с видеокартой, уровень high, текст страницы скрыт — в кадре только сцена.
 *   «Рассвет»: интро по времени (с серебряной волной — первый визит), затем скролл главы;
 *   остальные главы — скролл по их закреплённой дорожке.
 * Кадры → H.264 MP4 (Swift + AVFoundation), ключевой кадр каждые 6 кадров (перемотка).
 * TODO(assets): настоящие офлайн-рендеры (docs/assets.md) — тем же путём или через ffmpeg.
 * Запуск (только macOS, нужен запущенный сайт): npm run build && npx next start -p 3200,
 * затем npm run assets:fallback [-- http://localhost:3200]
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const ORIGIN = process.argv[2] ?? "http://localhost:3200";
const ROOT = new URL("../", import.meta.url);
const OUT = new URL("public/assets/video/fallback/", ROOT);
mkdirSync(OUT, { recursive: true });

const FPS = 24;
const INTRO_SECONDS = 4.5; // src/content/fallbackClips.ts
const SCROLL_FRAMES = 48; // 2 с
const [W, H] = [1024, 576];
const KEY = 6;
const BITRATE = 1_500_000;
// «День» — без клипа: в fallback у него кадры форматов (src/content/fallbackClips.ts).
const TRACKS = { assembly: "assembly", fire: "fire", world: "world", return: "return" };

const HIDE_TEXT = `
  main *:not(canvas), header, footer, nav, [data-hero-text], [class*="scrollHint"] {
    color: transparent !important; background: transparent !important; border-color: transparent !important;
    box-shadow: none !important; text-shadow: none !important; fill: transparent !important;
  }
  main *::before, main *::after { display: none !important; }
  main img, main picture, main svg, main video { opacity: 0 !important; }
`;

const frame = (dir, i) => join(dir, `frame_${String(i).padStart(4, "0")}.png`);

function encode(dir, name, width, height) {
  return new Promise((resolve, reject) => {
    const out = new URL(`${name}.mp4`, OUT).pathname;
    const swift = spawn(
      "swift",
      [
        new URL("scripts/lib/encode-h264-frames.swift", ROOT).pathname,
        dir,
        width,
        height,
        FPS,
        KEY,
        BITRATE,
        out,
      ].map(String),
      { stdio: "inherit" },
    );
    swift.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(`swift: ${code}`))));
  });
}

// Два прохода: широкий кадр и портрет телефона (портретные ключи камеры, горизонт 68%).
const VARIANTS = [
  { suffix: "", width: W, height: H },
  { suffix: ".portrait", width: H, height: W },
];

const browser = await chromium.launch({
  channel: "chromium",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});

async function render({ suffix, width, height }) {
  // Свежий контекст: серебряная волна — «первый визит» (флаг в localStorage пуст).
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/ru?quality=high`);
  await page.addStyleTag({ content: HIDE_TEXT });
  await page.waitForFunction(() => document.documentElement.dataset.canvas === "ready", null, {
    timeout: 60_000,
  });

  // «Рассвет»: интро по времени — кадры по реальным часам, раскладка на 24 кадра/с.
  {
    const dir = mkdtempSync(join(tmpdir(), "uly-dawn-"));
    const shots = [];
    const start = Date.now();
    while (Date.now() - start < INTRO_SECONDS * 1000) {
      const t = (Date.now() - start) / 1000;
      shots.push({ t, buffer: await page.screenshot() });
    }
    let n = 0;
    for (let i = 0; i < INTRO_SECONDS * FPS; i++) {
      const t = i / FPS;
      let pick = shots[0];
      for (const s of shots) if (s.t <= t) pick = s;
      writeFileSync(frame(dir, n++), pick.buffer);
    }
    const max = await page.evaluate(
      () => document.getElementById("dawn").offsetHeight - innerHeight,
    );
    for (let i = 0; i < SCROLL_FRAMES; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), (max * i) / (SCROLL_FRAMES - 1));
      await page.waitForTimeout(260);
      await page.screenshot({ path: frame(dir, n++) });
    }
    await encode(dir, `dawn${suffix}`, width, height);
    rmSync(dir, { recursive: true });
  }

  for (const [name, track] of Object.entries(TRACKS)) {
    const dir = mkdtempSync(join(tmpdir(), `uly-${name}-`));
    const box = await page.evaluate((id) => {
      const t = document.querySelector(`[data-track='${id}']`);
      const r = t.getBoundingClientRect();
      return { top: r.top + scrollY, run: t.offsetHeight - innerHeight };
    }, track);
    // Подход к дорожке — сцена успевает загрузиться и встать.
    await page.evaluate((y) => window.scrollTo(0, y), box.top - height);
    await page.waitForTimeout(1500);
    await page.evaluate((y) => window.scrollTo(0, y), box.top);
    await page.waitForTimeout(6000);
    for (let i = 0; i < SCROLL_FRAMES; i++) {
      await page.evaluate(
        (y) => window.scrollTo(0, y),
        box.top + (box.run * i) / (SCROLL_FRAMES - 1),
      );
      await page.waitForTimeout(260);
      await page.screenshot({ path: frame(dir, i) });
    }
    await encode(dir, `${name}${suffix}`, width, height);
    rmSync(dir, { recursive: true });
  }
  await context.close();
}

console.log("Секвенции fallback:");
for (const variant of VARIANTS) await render(variant);
await browser.close();
for (const name of ["dawn", ...Object.keys(TRACKS)])
  for (const { suffix } of VARIANTS) {
    const file = `${name}${suffix}.mp4`;
    console.log(`  fallback/${file}  ${Math.round(statSync(new URL(file, OUT)).size / 1024)} КБ`);
  }
