/*
 * Заглушки звука (CLAUDE.md, раздел 8) — пока нет записей с фазенды (docs/assets.md).
 * Синтетический шум, не музыка и не «эмбиент»: ветер, шелест травы, угли, ночь, порыв.
 * Петли — 8 с, рабочий участок 1…7 с (LOOP в src/lib/sound/mix.ts): периоды модуляции делят 6 с,
 * поэтому стык петли не щёлкает, какой бы ни была задержка кодека в начале файла.
 * AAC (.m4a) через Swift + AVFoundation (только macOS). Запуск: npm run assets:audio
 */
import { spawn } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("public/assets/audio/", ROOT);
mkdirSync(OUT, { recursive: true });

const RATE = 22050;
const LOOP_SECONDS = 8;
let seed = 11;
const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const white = () => rand() * 2 - 1;
const TAU = Math.PI * 2;

/** Однополюсный фильтр нижних частот (k — 0…1, меньше — темнее). */
const lowpass = (k) => {
  let y = 0;
  return (x) => (y += k * (x - y));
};
const highpass = (k) => {
  const lp = lowpass(k);
  return (x) => x - lp(x);
};

function render(seconds, sample) {
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = sample(i / RATE, i);
  // Нормализация по пику — до −6 dBFS.
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < n; i++) out[i] *= 0.5 / (peak || 1);
  return out;
}

const sounds = {
  // Ветер: низкий «коричневый» шум, дыхание с периодами 6 / 3 / 2 с.
  wind: () => {
    const lp = lowpass(0.02);
    const lp2 = lowpass(0.05);
    return render(LOOP_SECONDS, (t) => {
      const swell =
        0.55 +
        0.25 * Math.sin((TAU * t) / 6) +
        0.12 * Math.sin((TAU * t) / 3 + 1) +
        0.08 * Math.sin((TAU * t) / 2);
      return lp2(lp(white())) * swell;
    });
  },
  // Шелест травы: светлый шум с частой неровной модуляцией (периоды 1,5 / 0,75 / 0,5 с).
  grass: () => {
    const hp = highpass(0.08);
    const lp = lowpass(0.5);
    return render(LOOP_SECONDS, (t) => {
      const flutter =
        0.5 +
        0.25 * Math.sin((TAU * t) / 1.5) +
        0.15 * Math.sin((TAU * t) / 0.75 + 2) +
        0.1 * Math.sin((TAU * t) / 0.5 + 4);
      return lp(hp(white())) * flutter * flutter;
    });
  },
  // Угли: тихий низкий гул и редкие треск-щелчки.
  embers: () => {
    const lp = lowpass(0.015);
    const crackles = Array.from({ length: 34 }, () => ({
      at: rand() * LOOP_SECONDS,
      amp: 0.3 + rand() * 0.7,
      decay: 120 + rand() * 300,
    }));
    const hp = highpass(0.3);
    return render(LOOP_SECONDS, (t) => {
      let c = 0;
      for (const k of crackles) {
        const d = t - k.at;
        if (d >= 0 && d < 0.05) c += white() * k.amp * Math.exp(-d * k.decay);
      }
      return lp(white()) * 0.35 + hp(c) * 0.9;
    });
  },
  // Ночь: тишина степи — очень тихий ветер у земли.
  night: () => {
    const lp = lowpass(0.008);
    return render(LOOP_SECONDS, (t) => lp(white()) * (0.6 + 0.4 * Math.sin((TAU * t) / 6)));
  },
  // Порыв (отправка брифа): шум, тон которого поднимается и опадает, 2,4 с.
  gust: () => {
    let y = 0;
    return render(2.4, (t) => {
      const e = Math.sin(Math.PI * Math.min(1, t / 2.4)) ** 2;
      const k = 0.02 + 0.12 * e;
      y += k * (white() - y);
      return y * e;
    });
  },
};

function encode(name, samples) {
  return new Promise((resolve, reject) => {
    const out = new URL(`${name}.m4a`, OUT).pathname;
    const swift = spawn(
      "swift",
      [new URL("scripts/lib/encode-aac.swift", ROOT).pathname, RATE, 48000, out].map(String),
      {
        stdio: ["pipe", "inherit", "inherit"],
      },
    );
    swift.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(`swift: ${code}`))));
    swift.stdin.end(Buffer.from(samples.buffer));
  });
}

console.log("Заглушки звука:");
for (const [name, make] of Object.entries(sounds)) {
  await encode(name, make());
  console.log(`  ${name}.m4a  ${Math.round(statSync(new URL(`${name}.m4a`, OUT)).size / 1024)} КБ`);
}
