import { bezierEasing } from "@/motion/bezier";
import { Spring } from "@/motion/spring";
import { ease } from "@/motion/tokens";
import { STAGE_SPAN } from "./timeline";

/*
 * Мягкое притяжение — ТОЛЬКО в Сборке (CLAUDE.md, раздел 5):
 * остановка в пределах 6% от конца этапа → через 200 мс сцена (не скролл!) доезжает
 * до состояния конца этапа за 500 мс. Скролл страницы не трогаем — жёсткого захвата нет.
 * В остальное время сцена следует за скроллом со сглаживанием по темпу главы (скраб).
 */

export const SNAP_ZONE = 0.06;
export const SNAP_DELAY = 0.2;
export const SNAP_DURATION = 0.5;
/** Изменение прогресса меньше этого — не движение (шум инерции тачпада). */
const STILL = 1e-5;

const settle = bezierEasing(ease.settle);

/** Конец этапа, к которому притягивает прогресс p, или null (не в зоне притяжения). */
export function snapTarget(p: number, span = STAGE_SPAN, zone = SNAP_ZONE): number | null {
  if (p <= 0 || p >= 1) return null;
  const stage = Math.floor(p / span);
  const local = p / span - stage;
  return local >= 1 - zone ? Math.min(1, (stage + 1) * span) : null;
}

export class StageSnap {
  value: number;
  private readonly spring: Spring;
  private last: number;
  private idle = 0;
  private snap: { from: number; to: number; t: number } | null = null;

  constructor(initial: number, smoothTime: number) {
    this.value = initial;
    this.last = initial;
    this.spring = new Spring(initial, smoothTime);
  }

  /** Сцена сейчас притянута (или доезжает) к концу этапа. */
  get snapping(): boolean {
    return this.snap !== null;
  }

  /**
   * target — прогресс по скроллу; enabled — притяжение разрешено (не reduced motion, глава на экране).
   * Возвращает прогресс сцены.
   */
  update(dt: number, target: number, enabled: boolean): number {
    if (Math.abs(target - this.last) > STILL) {
      this.last = target;
      this.idle = 0;
      if (this.snap) {
        // Скролл продолжился — сцена снова следует за ним, плавно, с текущего места.
        this.snap = null;
        this.spring.snap(this.value);
      }
    } else {
      this.idle += dt;
    }

    if (!this.snap && enabled && this.idle >= SNAP_DELAY) {
      const to = snapTarget(target);
      if (to !== null && Math.abs(to - this.value) > STILL) {
        this.snap = { from: this.value, to, t: 0 };
      }
    }

    if (this.snap) {
      const s = this.snap;
      s.t = Math.min(SNAP_DURATION, s.t + dt);
      this.value = s.from + (s.to - s.from) * settle(s.t / SNAP_DURATION);
      return this.value;
    }

    this.spring.target = target;
    this.value = this.spring.update(dt);
    return this.value;
  }

  /** Мгновенно в состояние (reduced motion, восстановление после обновления страницы). */
  jump(value: number): void {
    this.value = value;
    this.last = value;
    this.idle = 0;
    this.snap = null;
    this.spring.snap(value);
  }
}
