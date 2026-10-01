import type { ChapterId } from "@/components/sections/chapters";
import {
  BEDS,
  bedGains,
  CROSSFADE_TAU,
  GUST_ATTACK,
  GUST_RELEASE,
  LOOP,
  SOUND_FILES,
  type Bed,
} from "./mix";

/*
 * Звук на Web Audio (CLAUDE.md, раздел 8). Создаётся ТОЛЬКО по действию пользователя
 * (кнопка «Звук» в меню): AudioContext, загрузка и декодирование файлов — после включения.
 * Схема: петли слоёв → свой GainNode → общий master → выход. Кроссфейд глав и порывы —
 * плавными целями громкости (setTargetAtTime), без щелчков.
 */

export type SoundSnapshot = {
  state: "off" | "loading" | "on" | "error";
  context: AudioContextState | "none";
  loaded: string[];
  gains: Record<Bed, number>;
  gusts: number;
};

type Layer = { gain: GainNode; source: AudioBufferSourceNode | null };

const MASTER = 0.8;
/** Плавное включение / выключение, с. */
const FADE_TAU = 0.25;

export class SoundEngine {
  readonly snapshot: SoundSnapshot = {
    state: "off",
    context: "none",
    loaded: [],
    gains: { wind: 0, grass: 0, embers: 0, night: 0 },
    gusts: 0,
  };
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly layers = new Map<Bed, Layer>();
  private gustBuffer: AudioBuffer | null = null;
  private chapter: ChapterId | null = null;
  private gust = 0;
  private enabled = false;
  private loading: Promise<void> | null = null;
  private readonly targets = { wind: 0, grass: 0, embers: 0, night: 0 };
  private crossfadeUntil = 0;
  private lastSet = -1;

  /** Вызывать только в обработчике действия пользователя (иначе браузер не даст играть). */
  constructor() {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    for (const bed of BEDS) {
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.master);
      this.layers.set(bed, { gain, source: null });
    }
    this.snapshot.context = this.ctx.state;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    const now = this.ctx.currentTime;
    if (on) {
      void this.ctx.resume().then(() => (this.snapshot.context = this.ctx.state));
      this.master.gain.setTargetAtTime(MASTER, now, FADE_TAU);
      this.snapshot.state = this.loading ? this.snapshot.state : "loading";
      this.loading ??= this.load();
    } else {
      this.master.gain.setTargetAtTime(0, now, FADE_TAU);
      // После затухания — остановить вывод совсем (не тратить батарею).
      window.setTimeout(() => {
        if (!this.enabled)
          void this.ctx.suspend().then(() => (this.snapshot.context = this.ctx.state));
      }, FADE_TAU * 5000);
      this.snapshot.state = "off";
    }
  }

  private async load() {
    try {
      const entries = await Promise.all(
        (Object.entries(SOUND_FILES) as [keyof typeof SOUND_FILES, string][]).map(
          async ([slot, url]) => {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`${url}: ${response.status}`);
            const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
            this.snapshot.loaded.push(slot);
            return [slot, buffer] as const;
          },
        ),
      );
      for (const [slot, buffer] of entries) {
        if (slot === "gust") {
          this.gustBuffer = buffer;
          continue;
        }
        const layer = this.layers.get(slot)!;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = Math.min(LOOP.start, buffer.duration / 4);
        source.loopEnd = Math.min(LOOP.end, buffer.duration);
        source.connect(layer.gain);
        source.start(0, source.loopStart);
        layer.source = source;
      }
      if (this.enabled) this.snapshot.state = "on";
    } catch {
      this.snapshot.state = "error";
    }
  }

  /** Кадр: глава и сила порыва → цели громкостей (кроссфейд глав, порывы — быстрее). */
  update(chapter: ChapterId | null, gust: number, dt: number) {
    const gustTau = gust > this.gust ? GUST_ATTACK : GUST_RELEASE;
    this.gust += (gust - this.gust) * (1 - Math.exp(-dt / gustTau));
    const changed = chapter !== this.chapter;
    this.chapter = chapter;
    const now = this.ctx.currentTime;
    // Цели громкости — не чаще 20 раз в секунду (кроме смены главы).
    if (!changed && now - this.lastSet < 0.05) return;
    this.lastSet = now;
    // Глава сменилась — длинный кроссфейд (и он не перебивается следующими кадрами);
    // иначе — короткое сглаживание (порывы).
    if (changed) this.crossfadeUntil = now + 3 * CROSSFADE_TAU;
    const tau = now < this.crossfadeUntil ? CROSSFADE_TAU : 0.08;
    const gains = bedGains(chapter, this.gust, this.targets);
    for (const bed of BEDS) {
      this.layers.get(bed)!.gain.gain.setTargetAtTime(gains[bed], now, tau);
      this.snapshot.gains[bed] = gains[bed];
    }
  }

  /** Единственный UI-звук: мягкий порыв при отправке брифа. */
  playGust() {
    if (!this.enabled || !this.gustBuffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = this.gustBuffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.9;
    source.connect(gain).connect(this.master);
    source.start();
    this.snapshot.gusts++;
  }

  dispose() {
    for (const layer of this.layers.values()) layer.source?.stop();
    void this.ctx.close();
  }
}
