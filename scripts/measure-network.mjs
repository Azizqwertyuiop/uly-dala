/*
 * Замер сети для мобильного 4G (шаг 20, CLAUDE.md, раздел 12): TTFB и загрузка ассетов.
 *   node scripts/measure-network.mjs https://<домен> [--runs 3]
 * Запускать с компьютера (или телефона в режиме модема) в Алматы — тогда реальная задержка
 * до сервера входит в замер, а эмуляция 4G добавляет поверх неё ширину канала мобильной сети.
 *
 * 1. Реальная сеть без эмуляции: время TCP-соединения (≈ RTT), TLS, TTFB главной — 5 замеров.
 * 2. Телефон (390×844, CPU ×4) на эмуляции 4G — два профиля:
 *    «4G типичный»: +40 мс, 9 Мбит/с вниз, 1,5 Мбит/с вверх;
 *    «Slow 4G» (как Lighthouse): +150 мс, 1,6 Мбит/с, 0,75 Мбит/с.
 *    TTFB, FCP, LCP, ассеты первой сцены (/_next/static + /assets/), байты, медиана из N прогонов.
 * Пороги раздела 12: LCP ≤ 2,5 с на 4G; первая загрузка ≤ 3 МБ.
 */
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) ?? "http://localhost:3200").replace(
  /\/$/,
  "",
);
const runs = Number(args[args.indexOf("--runs") + 1]) || 3;

const PROFILES = {
  "4G типичный": { latency: 40, download: (9e6 / 8) | 0, upload: (1.5e6 / 8) | 0 },
  "Slow 4G": { latency: 150, download: (1.6e6 / 8) | 0, upload: (0.75e6 / 8) | 0 },
};
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const ms = (x) => (x == null ? "—" : `${Math.round(x)} мс`);
const mb = (x) => `${(x / 1024 / 1024).toFixed(2)} МБ`;

// --- 1. Реальная сеть ---------------------------------------------------------------------------
console.log(`Сайт: ${base}\n\n1. Реальная сеть до сервера (без эмуляции), 5 замеров:`);
const raw = [];
for (let i = 0; i < 5; i++) {
  const out = execFileSync("curl", [
    "-so",
    "/dev/null",
    "-w",
    "%{time_connect} %{time_appconnect} %{time_starttransfer}",
    `${base}/ru`,
  ])
    .toString()
    .split(" ")
    .map(Number);
  raw.push({ connect: out[0] * 1000, tls: out[1] * 1000, ttfb: out[2] * 1000 });
}
console.log(
  `   TCP (≈ RTT): ${ms(median(raw.map((r) => r.connect)))}` +
    `   TLS готов: ${ms(median(raw.map((r) => r.tls)))}` +
    `   TTFB: ${ms(median(raw.map((r) => r.ttfb)))}`,
);

// --- 2. Телефон на 4G ---------------------------------------------------------------------------
const browser = await chromium.launch();
console.log(`\n2. Телефон на эмуляции 4G (CPU ×4), медиана из ${runs}:`);
// medium — обычный телефон (3D); fallback — слабый телефон (видео-секвенции). Headless-браузер
// без видеокарты сам выбрал бы fallback, поэтому уровень задаётся явно.
const QUALITIES = { medium: "обычный телефон", fallback: "слабый телефон" };
for (const [quality, who] of Object.entries(QUALITIES))
  for (const [name, net] of Object.entries(PROFILES)) {
    const results = [];
    for (let i = 0; i < runs; i++) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        locale: "ru-RU",
      });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: net.latency,
        downloadThroughput: net.download,
        uploadThroughput: net.upload,
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      let bytes = 0;
      cdp.on("Network.loadingFinished", (e) => (bytes += e.encodedDataLength));
      await page.addInitScript(() => {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) window.__lcp = e.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
      });
      await page.goto(`${base}/ru?quality=${quality}`, { waitUntil: "load", timeout: 120_000 });
      await page.waitForTimeout(3000);
      const m = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime;
        const res = performance.getEntriesByType("resource");
        const scene = res.filter((r) => /\/(_next\/static|assets)\//.test(r.name));
        return {
          ttfb: nav.responseStart,
          fcp,
          lcp: window.__lcp,
          load: nav.loadEventEnd,
          sceneEnd: Math.max(0, ...scene.map((r) => r.responseEnd)),
          sceneCount: scene.length,
        };
      });
      results.push({ ...m, bytes });
      await context.close();
    }
    const pick = (k) => median(results.map((r) => r[k] ?? 0));
    console.log(
      `   ${quality} (${who}), ${name}:\n      TTFB ${ms(pick("ttfb"))} · FCP ${ms(pick("fcp"))} · LCP ${ms(pick("lcp"))}` +
        ` · ассеты сцены (${pick("sceneCount")} файлов) загружены к ${ms(pick("sceneEnd"))}` +
        ` · всего ${mb(pick("bytes"))}`,
    );
  }
await browser.close();
console.log(
  "\nПороги (раздел 12): LCP ≤ 2500 мс на 4G, первая загрузка ≤ 3 МБ. Рекомендации — docs/deploy.md.",
);
