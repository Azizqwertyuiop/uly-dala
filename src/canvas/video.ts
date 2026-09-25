"use client";

import { NoColorSpace, SRGBColorSpace, Texture, TextureLoader, VideoTexture } from "three";
import type { Tier, VideoAsset } from "./assets";

/*
 * Видеотекстуры с альфой (CLAUDE.md, раздел 6):
 * - HEVC + alpha — Safari и все браузеры на iOS (движок WebKit); VP9 + alpha WebM — остальные;
 * - muted playsinline autoplay; отказ play() (энергосбережение, политика автоплея) → постер;
 * - SRGBColorSpace; альфа предумножается при загрузке в GPU (premultiplyAlpha) — фильтрация
 *   текстуры идёт по предумноженным значениям, поэтому по краю нет тёмной/светлой каймы.
 */

export function prefersHevc(
  ua = navigator.userAgent,
  maxTouchPoints = navigator.maxTouchPoints,
): boolean {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
  const safari = /Safari\//.test(ua) && !/Chrome\/|Chromium\/|CriOS|FxiOS|Edg\//.test(ua);
  return ios || safari;
}

export function pickVideoSource(asset: VideoAsset, tier: Tier, hevc = prefersHevc()) {
  const variant = asset.variants[tier];
  return hevc
    ? { src: variant.hevc, type: 'video/mp4; codecs="hvc1"' }
    : { src: variant.vp9, type: 'video/webm; codecs="vp9"' };
}

export type AlphaVideo = {
  texture: Texture;
  video: HTMLVideoElement;
  /** true — играет видео, false — показан постер. */
  playing: () => boolean;
  dispose: () => void;
};

/*
 * Цветовое пространство данных — sRGB. Декодирование sRGB → линейное делает материал
 * (alphaVideoMaterial) ПОСЛЕ снятия предумножения — единственный правильный порядок для краёв.
 * Видео three и так грузит как RGBA8; постеру явно запрещаем аппаратное sRGB-декодирование,
 * чтобы оба пути были одинаковыми.
 */
export function prepareAlphaTexture(texture: Texture, isPoster = false) {
  texture.colorSpace = isPoster ? NoColorSpace : SRGBColorSpace;
  texture.premultiplyAlpha = true;
  texture.generateMipmaps = false;
  return texture;
}

export function createAlphaVideo(
  asset: VideoAsset,
  tier: Tier,
  onChange: (t: Texture) => void,
): AlphaVideo {
  const video = document.createElement("video");
  const source = pickVideoSource(asset, tier);
  video.muted = true;
  video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.autoplay = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.src = source.src;

  const videoTexture = prepareAlphaTexture(new VideoTexture(video));
  let posterTexture: Texture | null = null;
  let playing = false;

  const showPoster = () => {
    playing = false;
    if (!posterTexture) {
      posterTexture = prepareAlphaTexture(
        new TextureLoader().load(asset.poster, (t) => onChange(t)),
        true,
      );
    }
    onChange(posterTexture);
  };

  // Постер сразу, видео — как только реально пошло.
  showPoster();
  video.addEventListener("playing", () => {
    playing = true;
    onChange(videoTexture);
  });
  video.addEventListener("error", showPoster);
  void video.play().catch(showPoster);

  return {
    get texture() {
      return playing ? videoTexture : (posterTexture ?? videoTexture);
    },
    video,
    playing: () => playing,
    dispose() {
      video.pause();
      video.removeAttribute("src");
      video.load();
      videoTexture.dispose();
      posterTexture?.dispose();
    },
  };
}
