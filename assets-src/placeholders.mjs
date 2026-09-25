/*
 * Кадры-заглушки на месте будущих 3D-сцен и фотографий (CLAUDE.md, раздел 0).
 * Запуск: node assets-src/placeholders.mjs → public/assets/placeholders/*.svg
 * Горизонт — на 72% высоты кадра, как в сцене первого экрана.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../public/assets/placeholders/", import.meta.url);
mkdirSync(OUT, { recursive: true });

function frame({ w = 1600, h = 900, sky, glow, ground, extra = "" }) {
  const hy = Math.round(h * 0.72);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1">${sky
    .map((c, i) => `<stop offset="${(i / (sky.length - 1)).toFixed(2)}" stop-color="${c}"/>`)
    .join("")}</linearGradient>
<radialGradient id="g" cx="0.68" cy="1" r="0.6"><stop offset="0" stop-color="${glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${w}" height="${hy}" fill="url(#s)"/>
<rect width="${w}" height="${hy}" fill="url(#g)"/>
<rect y="${hy}" width="${w}" height="${h - hy}" fill="${ground}"/>
<rect y="${hy - 1}" width="${w}" height="2" fill="${glow}" opacity="0.7"/>
${extra}
</svg>
`;
}

const hy = (h = 900) => Math.round(h * 0.72);
const yurt = (x, h = 900, fill = "#2a2320", r = 90) =>
  `<path d="M${x - r} ${hy(h)} v-${r * 0.55} q${r} -${r * 0.75} ${r * 2} 0 v${r * 0.55} z" fill="${fill}"/>`;
const horse = (x, h = 900, fill = "#0e1016") => {
  const y = hy(h);
  return `<g fill="${fill}"><rect x="${x}" y="${y - 38}" width="46" height="18" rx="8"/><rect x="${x + 4}" y="${y - 22}" width="4" height="22"/><rect x="${x + 38}" y="${y - 22}" width="4" height="22"/><path d="M${x + 6} ${y - 34} l-10 -22 l8 -2 l12 20 z"/></g>`;
};
const stars = (n, w = 1600, h = 900) =>
  Array.from({ length: n }, (_, i) => {
    const x = (i * 397) % w;
    const y = (i * 211) % Math.round(h * 0.6);
    return `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 1.6 : 1}" fill="#f7f4ee" opacity="0.7"/>`;
  }).join("");
const pillar = `<path d="M720 0 h160 l140 900 h-440 z" fill="#f7f4ee" opacity="0.18"/>`;
const table = (h = 900, fill = "#6b4a33") =>
  `<rect x="420" y="${hy(h) + 40}" width="760" height="22" rx="4" fill="${fill}"/>`;

const dawnSky = ["#141824", "#1c2230", "#3a3550", "#c9824a"];
const daySky = ["#b9c2c0", "#dcdfd8", "#ede6da"];
const eveningSky = ["#1c2230", "#6b4a33", "#e0a060"];
const nightSky = ["#0b0e15", "#141824", "#1c2230"];
const fireSky = ["#120d0b", "#2a1b14", "#6b4a33"];

const files = {
  dawn: frame({ sky: dawnSky, glow: "#e8a060", ground: "#10131a", extra: horse(1080) }),
  assembly: frame({
    sky: ["#6f7a86", "#b9b7ab", "#ede6da"],
    glow: "#f2d2a0",
    ground: "#5d5c4a",
    extra: yurt(800, 900, "#3b3128", 130),
  }),
  pillar: frame({
    sky: ["#0d0f14", "#1c2230", "#2a2320"],
    glow: "#f7f4ee",
    ground: "#14110f",
    extra: pillar,
  }),
  fire: frame({ sky: fireSky, glow: "#e0602a", ground: "#0e0a08", extra: table(900, "#3b2a1e") }),
  world: frame({
    sky: nightSky,
    glow: "#6b7a99",
    ground: "#07090d",
    extra: stars(60) + yurt(560, 900, "#050608", 80),
  }),
  return: frame({ sky: dawnSky, glow: "#e8a060", ground: "#10131a" }),
  fazenda: frame({
    sky: nightSky,
    glow: "#8a9283",
    ground: "#07090d",
    extra: stars(80) + yurt(500, 900, "#050608", 90) + yurt(1000, 900, "#050608", 60),
  }),
  "format-conference": frame({
    sky: daySky,
    glow: "#ffffff",
    ground: "#8a9283",
    extra: `<rect x="620" y="420" width="360" height="228" fill="#1c2230"/>`,
  }),
  "format-coffee-break": frame({
    sky: daySky,
    glow: "#ffffff",
    ground: "#8a9283",
    extra: table(900, "#6b4a33"),
  }),
  "format-team-building": frame({ sky: daySky, glow: "#ffffff", ground: "#8a9283" }),
  "format-kudalyk": frame({
    sky: ["#e6e0d4", "#f2eee6", "#f7f4ee"],
    glow: "#ffffff",
    ground: "#d8d0c2",
    extra: table(900, "#f7f4ee"),
  }),
  "format-wedding": frame({
    sky: eveningSky,
    glow: "#e8a060",
    ground: "#1c1612",
    extra: table(900, "#3b2a1e"),
  }),
  "format-private-party": frame({
    sky: eveningSky,
    glow: "#e8a060",
    ground: "#1c1612",
    extra: yurt(700, 900, "#2a2320", 80),
  }),
  "case-conference-in-the-steppe": frame({
    h: 1000,
    sky: daySky,
    glow: "#ffffff",
    ground: "#8a9283",
    extra: yurt(800, 1000, "#6b4a33", 120),
  }),
  "case-kudalyk-two-families": frame({
    h: 1000,
    sky: ["#e6e0d4", "#f7f4ee"],
    glow: "#ffffff",
    ground: "#d8d0c2",
    extra: table(1000, "#f7f4ee"),
  }),
  "case-evening-wedding": frame({
    h: 1000,
    sky: eveningSky,
    glow: "#e8a060",
    ground: "#1c1612",
    extra: table(1000, "#3b2a1e"),
  }),
};

for (const [name, svg] of Object.entries(files)) writeFileSync(new URL(`${name}.svg`, OUT), svg);
console.log(`Готово: ${Object.keys(files).length} файлов`);
