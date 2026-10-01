/*
 * OG-изображения (CLAUDE.md, раздел 11) — ключевые кадры сцен, 1200×630 JPEG.
 * Снимаются с нашей же 3D-сцены (браузер с видеокартой, уровень high, текст страницы скрыт):
 * рассвет, сборка, шесть площадок «Дня» (по формату), огонь, фазенда, финал.
 * TODO(assets): с настоящими рендерами — перегенерировать тем же скриптом.
 * Запуск (macOS, нужен запущенный сайт): npm run build && npx next start -p 3200,
 * затем npm run assets:og [-- http://localhost:3200]
 */
import { mkdirSync, statSync } from "node:fs";
import { chromium } from "@playwright/test";

const ORIGIN = process.argv[2] ?? "http://localhost:3200";
const OUT = new URL("../public/og/", import.meta.url);
mkdirSync(OUT, { recursive: true });

// Порядок площадок «Дня» по умолчанию (src/canvas/day/timeline.ts, DEFAULT_ORDER).
const DAY = ["conference", "coffee-break", "team-building", "kudalyk", "wedding", "private-party"];
const HIDE_TEXT = `
  header { display: none !important; }
  nav, footer, [class*="scrollHint"], [class*="LanguageSuggest"] { visibility: hidden !important; }
  main input, main label, main button, main a { opacity: 0 !important; }
  main *:not(canvas) { color: transparent !important; -webkit-text-fill-color: transparent !important;
    background: transparent !important; border-color: transparent !important; box-shadow: none !important; }
  main *::before, main *::after { display: none !important; }
  main img, main picture, main svg, main video { opacity: 0 !important; }
`;

const shots = [
  ["dawn", null, 0],
  ["assembly", "assembly", 0.55],
  ...DAY.map((slug, k) => [slug, "day", (k + 0.5) / DAY.length]),
  ["fire", "fire", 0.9],
  ["world", "world", 0.42],
  ["return", "return", 1],
];

const browser = await chromium.launch({
  channel: "chromium",
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
await page.goto(`${ORIGIN}/ru?quality=high`);
await page.addStyleTag({ content: HIDE_TEXT });
await page.waitForFunction(() => document.documentElement.dataset.canvas === "ready", null, {
  timeout: 60_000,
});
await page.waitForTimeout(7000); // интро рассвета
for (const [name, track, p] of shots) {
  if (track) {
    await page.evaluate(
      ([track, p]) => {
        const t = document.querySelector(`[data-track='${track}']`);
        const top = t.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, top + (t.offsetHeight - window.innerHeight) * p);
      },
      [track, p],
    );
    await page.waitForTimeout(5000);
  }
  await page.screenshot({ path: new URL(`${name}.jpg`, OUT).pathname, type: "jpeg", quality: 82 });
  console.log(
    `  og/${name}.jpg  ${Math.round(statSync(new URL(`${name}.jpg`, OUT)).size / 1024)} КБ`,
  );
}
await browser.close();
