/*
 * Кадры тестового видео «конь» (CLAUDE.md, раздел 6: видеопетля с альфой).
 * Силуэт тёмно-гнедого коня в три четверти мордой влево, контровой свет по верхнему краю,
 * пар дыхания каждые ~4,5 с. Мягкие края и полупрозрачный пар проверяют отсутствие ореолов.
 * Пишет RGBA с НЕпредумноженной альфой; у полностью прозрачных пикселей RGB = 0 —
 * типичный случай, на котором неправильная фильтрация даёт тёмную кайму.
 *
 * Функция самодостаточна (без импортов) — её текст исполняется и в браузере (VP9 через WebCodecs).
 */
export function drawHorseFrame(t, w, h, out) {
  const s = h / 360; // масштаб относительно 640×360
  const sdEllipse = (px, py, cx, cy, rx, ry, rot) => {
    const c = Math.cos(rot),
      si = Math.sin(rot);
    const x = ((px - cx) * c + (py - cy) * si) / rx;
    const y = (-(px - cx) * si + (py - cy) * c) / ry;
    return (Math.hypot(x, y) - 1) * Math.min(rx, ry);
  };
  const sdBox = (px, py, cx, cy, hw, hh, r) => {
    const dx = Math.abs(px - cx) - hw + r,
      dy = Math.abs(py - cy) - hh + r;
    return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
  };
  const smin = (a, b, k) => {
    const hh = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - hh * hh * k * 0.25;
  };
  // Лёгкое «дыхание» корпуса: 4,5 с.
  const breath = Math.sin((t / 4.5) * Math.PI * 2);
  const horse = (x, y) => {
    let d = sdEllipse(x, y, 340, 190 - breath * 1.2, 120, 52, 0.05);
    d = smin(d, sdEllipse(x, y, 225, 130, 34, 72, 0.55), 26); // шея
    d = smin(d, sdEllipse(x, y, 178, 92, 22, 46, 1.15), 14); // голова
    d = smin(d, sdEllipse(x, y, 205, 58, 6, 14, 0.2), 6); // ухо
    for (const [lx, lean] of [
      [260, -0.05],
      [290, 0.04],
      [395, -0.03],
      [425, 0.05],
    ]) {
      d = smin(d, sdBox(x - (y - 250) * lean, y, lx, 262, 10, 68, 8), 12); // ноги
    }
    d = smin(d, sdEllipse(x, y, 468, 205, 12, 58, -0.35), 10); // хвост
    return d;
  };
  // Пар: облачко у ноздрей, появляется и тает за 1,6 с каждые 4,5 с.
  const phase = (t % 4.5) / 1.6;
  const steamAlpha = phase < 1 ? Math.sin(phase * Math.PI) * 0.38 : 0;
  const steamX = 150 - phase * 26,
    steamY = 118 - phase * 10;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const x = px / s,
        y = py / s;
      const d = horse(x, y) * s; // в пикселях кадра
      const cover = Math.min(Math.max(0.5 - d, 0), 1);
      // Контровой свет: у края и сверху.
      const up = horse(x, y + 1.5) - horse(x, y - 1.5); // > 0 — край смотрит вверх
      const rim = Math.min(Math.max(1 + d / (3 * s), 0), 1) * Math.min(Math.max(up * 0.6, 0), 1);
      let r = 58 + rim * 182,
        g = 36 + rim * 150,
        b = 24 + rim * 96,
        a = cover;
      if (steamAlpha > 0) {
        const sd = sdEllipse(x, y, steamX, steamY, 26 + phase * 20, 12 + phase * 10, 0.2) * s;
        const sa = Math.min(Math.max(0.5 - sd / (6 * s), 0), 1) * steamAlpha * (1 - cover);
        if (sa > 0) {
          const total = a + sa * (1 - a);
          r = (r * a + 230 * sa * (1 - a)) / total;
          g = (g * a + 226 * sa * (1 - a)) / total;
          b = (b * a + 220 * sa * (1 - a)) / total;
          a = total;
        }
      }
      const i = (py * w + px) * 4;
      if (a <= 0) {
        out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0;
      } else {
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
        out[i + 3] = Math.round(a * 255);
      }
    }
  }
  return out;
}
