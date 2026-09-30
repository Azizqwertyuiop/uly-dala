/*
 * Заглушка видео облёта фазенды (глава 5, medium): ночь, камера медленно идёт вдоль четырёх зон —
 * поле с гирляндами, шатёр, юрта, кухня с огнём; у горизонта — огни Алматы. Параллакс слоями.
 * TODO(assets): настоящая съёмка облёта (docs/assets.md). Функция самодостаточна (без импортов):
 * её тело передаётся в страницу Chromium для кодирования VP9.
 *
 * t — секунды (0…DURATION), w×h — размер кадра, out — RGBA (Uint8ClampedArray w*h*4).
 */
export const FLYOVER_SECONDS = 12;
/** Центры зон по времени облёта (с) — те же, что у остановок в сцене (world/timeline.ts). */
export const FLYOVER_ZONES = [1.5, 4.5, 7.5, 10.5];

export function drawFlyoverFrame(t, w, h, out) {
  const DURATION = 12;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const u = clamp(t / DURATION, 0, 1);
  // Камера: ровно, без рывков — плавное ускорение и торможение.
  const ease = u * u * (3 - 2 * u);
  const horizon = Math.round(h * 0.62);
  const put = (i, r, g, b) => {
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = 255;
  };
  const add = (x, y, r, g, b, k) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    out[i] = Math.min(255, out[i] + r * k);
    out[i + 1] = Math.min(255, out[i + 1] + g * k);
    out[i + 2] = Math.min(255, out[i + 2] + b * k);
  };
  const glow = (cx, cy, radius, r, g, b, k) => {
    const x0 = Math.floor(cx - radius);
    const x1 = Math.ceil(cx + radius);
    const y0 = Math.floor(cy - radius);
    const y1 = Math.ceil(cy + radius);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - cx, y - cy) / radius;
        if (d < 1) add(x, y, r, g, b, k * (1 - d) * (1 - d));
      }
  };
  const fill = (x0, y0, x1, y1, r, g, b) => {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(h, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(w, Math.ceil(x1)); x++)
        put((y * w + x) * 4, r, g, b);
  };
  // Небо и земля.
  for (let y = 0; y < h; y++) {
    const sky = y < horizon;
    const k = sky ? y / horizon : (y - horizon) / (h - horizon);
    const r = sky ? 6 + 18 * k * k : 9 - 4 * k;
    const g = sky ? 8 + 14 * k * k : 9 - 4 * k;
    const b = sky ? 18 + 20 * k * k : 11 - 5 * k;
    for (let x = 0; x < w; x++) put((y * w + x) * 4, r, g, b);
  }
  // Звёзды — неподвижные, далёкий слой почти не смещается.
  let seed = 20240917;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let s = 0; s < 140; s++) {
    const sx = rand() * w * 1.2 - ease * w * 0.05;
    const sy = rand() * horizon * 0.85;
    add(((Math.round(sx) % w) + w) % w, Math.round(sy), 170, 176, 190, 0.3 + rand() * 0.5);
  }
  // Огни Алматы у горизонта — далёкий слой.
  for (let c = 0; c < 90; c++) {
    const cx = w * 0.55 + ((c * 37) % 90) * (w / 160) - ease * w * 0.08;
    add(Math.round(cx), horizon - 1 - (c % 3), 230, 190, 120, 0.5);
  }
  glow(w * 0.8 - ease * w * 0.08, horizon, w * 0.25, 60, 40, 20, 0.35);
  // Ближний слой: зоны вдоль пути (смещаются сильнее — параллакс).
  const span = w * 3.2;
  const shift = ease * span * 0.78;
  const zoneX = (k) => w * 0.55 + k * w * 0.8 - shift;
  // 1 — поле: гирлянда на столбах.
  {
    const x = zoneX(0);
    for (let p = 0; p < 4; p++)
      fill(
        x - w * 0.25 + p * w * 0.17,
        horizon - h * 0.18,
        x - w * 0.25 + p * w * 0.17 + 2,
        horizon + 2,
        20,
        16,
        14,
      );
    for (let i = 0; i <= 40; i++) {
      const bx = x - w * 0.25 + (i / 40) * w * 0.51;
      const by = horizon - h * 0.18 + Math.sin((i / 40) * Math.PI * 3) ** 2 * h * 0.03;
      glow(bx, by, 5, 255, 180, 100, 0.9);
    }
  }
  // 2 — шатёр: тёплый свет изнутри.
  {
    const x = zoneX(1);
    fill(x - w * 0.14, horizon - h * 0.12, x + w * 0.14, horizon + 3, 70, 52, 36);
    for (let y = 0; y < h * 0.08; y++) {
      const half = (y / (h * 0.08)) * w * 0.15;
      fill(x - half, horizon - h * 0.2 + y, x + half, horizon - h * 0.2 + y + 1, 58, 46, 38);
    }
    glow(x, horizon - h * 0.05, w * 0.18, 255, 170, 90, 0.35);
  }
  // 3 — юрта: купол, открытая дверь.
  {
    const x = zoneX(2);
    const rw = w * 0.1;
    for (let y = 0; y < h * 0.14; y++) {
      const dome = y < h * 0.06 ? Math.sqrt(y / (h * 0.06)) * rw : rw;
      fill(x - dome, horizon - h * 0.14 + y, x + dome, horizon - h * 0.14 + y + 1, 44, 38, 34);
    }
    fill(x - w * 0.012, horizon - h * 0.05, x + w * 0.012, horizon + 1, 230, 160, 80);
    glow(x, horizon - h * 0.02, w * 0.05, 255, 170, 90, 0.5);
  }
  // 4 — кухня: огонь, дым, стол.
  {
    const x = zoneX(3);
    fill(x - w * 0.1, horizon - h * 0.02, x + w * 0.06, horizon + 1, 60, 44, 32);
    glow(x + w * 0.1, horizon - h * 0.01, w * 0.07, 255, 120, 40, 0.9);
    glow(x + w * 0.1, horizon - h * 0.01, w * 0.02, 255, 210, 140, 1);
    for (let s = 0; s < 6; s++)
      glow(
        x + w * 0.1 + Math.sin(t * 0.8 + s) * 6,
        horizon - h * (0.05 + s * 0.035),
        w * (0.03 + s * 0.006),
        40,
        38,
        36,
        0.25,
      );
  }
}
