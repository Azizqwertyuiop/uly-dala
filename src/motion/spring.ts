/*
 * Критически демпфированная пружина (CLAUDE.md, раздел 6: «сглаживание критически
 * демпфированными пружинами»). Точное аналитическое решение, а не шаг Эйлера:
 * результат не зависит от частоты кадров — 60 и 120 Гц дают одно и то же.
 *
 * smoothTime — характерное время сглаживания, с (0,45 с для камеры на рассвете и т. п.).
 * Без перелёта через цель: упругих кривых с отскоком нет (раздел 5).
 */

/** Один шаг для одного числа. Пишет результат в out, не выделяет память. */
export function springStep(
  out: { value: number; velocity: number },
  target: number,
  smoothTime: number,
  dt: number,
): void {
  if (smoothTime <= 0) {
    out.value = target;
    out.velocity = 0;
    return;
  }
  const omega = 2 / smoothTime;
  const c0 = out.value - target;
  const c1 = out.velocity + omega * c0;
  const decay = Math.exp(-omega * dt);
  out.value = target + (c0 + c1 * dt) * decay;
  out.velocity = (c1 - omega * (c0 + c1 * dt)) * decay;
}

export class Spring {
  value: number;
  velocity = 0;
  target: number;

  constructor(
    initial: number,
    public smoothTime: number,
  ) {
    this.value = initial;
    this.target = initial;
  }

  update(dt: number): number {
    springStep(this, this.target, this.smoothTime, dt);
    return this.value;
  }

  /** Мгновенно в значение (reduced motion, восстановление позиции после обновления страницы). */
  snap(value = this.target): void {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  /** Почти остановилась — можно не перерисовывать. */
  get settled(): boolean {
    return Math.abs(this.value - this.target) < 1e-4 && Math.abs(this.velocity) < 1e-4;
  }
}

/** Пружина для векторов (позиция камеры, цель взгляда): n компонент в одном буфере. */
export class VectorSpring {
  readonly value: Float64Array;
  readonly velocity: Float64Array;
  readonly target: Float64Array;
  private scratch = { value: 0, velocity: 0 };

  constructor(
    initial: ArrayLike<number>,
    public smoothTime: number,
  ) {
    this.value = Float64Array.from(initial);
    this.velocity = new Float64Array(initial.length);
    this.target = Float64Array.from(initial);
  }

  setTarget(target: ArrayLike<number>): void {
    for (let i = 0; i < this.target.length; i++) this.target[i] = target[i] ?? 0;
  }

  update(dt: number): Float64Array {
    const s = this.scratch;
    for (let i = 0; i < this.value.length; i++) {
      s.value = this.value[i]!;
      s.velocity = this.velocity[i]!;
      springStep(s, this.target[i]!, this.smoothTime, dt);
      this.value[i] = s.value;
      this.velocity[i] = s.velocity;
    }
    return this.value;
  }

  snap(): void {
    this.value.set(this.target);
    this.velocity.fill(0);
  }
}
