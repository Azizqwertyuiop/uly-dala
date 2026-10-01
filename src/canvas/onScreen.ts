import { chapterIds } from "@/components/sections/chapters";
import { chapterBounds, chapterTrack, progress } from "@/motion/progress";

/*
 * Есть ли на экране участок со сценой (CLAUDE.md, раздел 12: «рендер стоит в статике»).
 * 3D видно только в своих полосах: первый экран «Рассвета», закреплённые дорожки глав
 * и глава «Этот мир существует» целиком (кадры архива — WebGL поверх <img>).
 * Бриф, футер, тексты между дорожками — без 3D: кадр не рисуется.
 * Только измеренные границы (обновляются при ресайзе) — без чтения DOM в кадре.
 */

const TRACKS = ["assembly", "day", "fire", "return"] as const;
const DAWN = chapterIds.indexOf("dawn");
const WORLD = chapterIds.indexOf("world");

export function sceneOnScreen(): boolean {
  const top = progress.scrollY;
  const bottom = top + (progress.viewportHeight || window.innerHeight);
  const hit = (a: number, b: number) => b > top && a < bottom;
  const bounds = chapterBounds();
  for (const index of [DAWN, WORLD]) {
    const b = bounds[index];
    if (b && hit(b.top, b.top + b.height)) return true;
  }
  for (const id of TRACKS) {
    const t = chapterTrack(id);
    if (t && hit(t.top, t.top + t.height)) return true;
  }
  return false;
}
