import type { Texture } from "three";
import { assets, type Tier } from "../assets";
import { createAlphaVideo, type AlphaVideo } from "../video";
import type { HorseClip } from "./dawn";

/*
 * Клипы коня (раздел 2): стоит (петля) → смотрит в камеру → уходит шагом.
 * Переключение — сменой текстуры материала, без перезагрузки источника у текущего клипа.
 * TODO(assets): три офлайн-рендера; пока все три клипа — тестовое видео (docs/assets.md).
 */
export class HorseClips {
  private clips = new Map<HorseClip, AlphaVideo>();
  private current: HorseClip | null = null;
  /** Коня видно: иначе (глава ушла, конь растворился) видео стоит — не декодируется. */
  private active = true;

  constructor(
    private tier: Tier,
    private onTexture: (texture: Texture) => void,
  ) {}

  private ensure(clip: HorseClip): AlphaVideo {
    let video = this.clips.get(clip);
    if (!video) {
      video = createAlphaVideo(assets.horse, this.tier, (texture) => {
        if (this.current === clip) this.onTexture(texture);
      });
      // Заранее загруженный следующий клип не играет, пока не нужен (декодер не тратится).
      const v = video.video;
      v.addEventListener(
        "playing",
        () => {
          if (this.current !== clip || !this.active) v.pause();
        },
        { once: true },
      );
      this.clips.set(clip, video);
    }
    return video;
  }

  /** Показать клип; следующий по сюжету — заранее, чтобы переключение было без паузы. */
  show(clip: HorseClip) {
    if (clip === this.current) return;
    this.current = clip;
    const video = this.ensure(clip);
    this.clips.forEach((other, id) => id !== clip && other.video.pause());
    if (clip !== "idle") video.video.currentTime = 0;
    if (this.active) void video.video.play().catch(() => {});
    this.onTexture(video.texture);
    if (clip === "idle") this.ensure("look");
    if (clip === "look") this.ensure("walk");
  }

  /** Коня видно или нет: видео играет только когда видно. */
  setActive(active: boolean) {
    if (active === this.active) return;
    this.active = active;
    const video = this.current ? this.clips.get(this.current)?.video : null;
    if (!video) return;
    if (active) void video.play().catch(() => {});
    else video.pause();
  }

  /** Видео сейчас декодируется (играет): для e2e — неактивная глава видео не тратит. */
  get decoding() {
    const video = this.current ? this.clips.get(this.current)?.video : null;
    return !!video && !video.paused;
  }

  get playing() {
    return this.current ? (this.clips.get(this.current)?.playing() ?? false) : false;
  }

  dispose() {
    this.clips.forEach((v) => v.dispose());
    this.clips.clear();
  }
}
