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
      this.clips.set(clip, video);
    }
    return video;
  }

  /** Показать клип; следующий по сюжету — заранее, чтобы переключение было без паузы. */
  show(clip: HorseClip) {
    if (clip === this.current) return;
    this.current = clip;
    const video = this.ensure(clip);
    if (clip !== "idle") {
      video.video.currentTime = 0;
      void video.video.play().catch(() => {});
    }
    this.onTexture(video.texture);
    if (clip === "idle") this.ensure("look");
    if (clip === "look") this.ensure("walk");
  }

  get playing() {
    return this.current ? (this.clips.get(this.current)?.playing() ?? false) : false;
  }

  dispose() {
    this.clips.forEach((v) => v.dispose());
    this.clips.clear();
  }
}
