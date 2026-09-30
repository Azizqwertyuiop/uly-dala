import type { Transition } from "@/canvas/materials/transitions";
import styles from "./SceneImage.module.css";

type Props = {
  src: string;
  /** Описание сцены — оно же текстовая замена будущего 3D (CLAUDE.md, раздел 10). */
  alt: string;
  width: number;
  height: number;
  /** Кадр первого экрана: грузится сразу. */
  priority?: boolean;
  sizes?: string;
  className?: string;
  /** Место 3D-сцены главы: кадр скрывается, когда сцена на холсте готова. */
  sceneSlot?: boolean;
  /** Реальный кадр (глава 5): WebGL-двойник поверх <img> с переходом появления. */
  gl?: Transition;
  /** Имя общего элемента для перехода между страницами (View Transitions). */
  transitionName?: string;
};

/**
 * Статичный кадр на месте будущей 3D-сцены или фотографии.
 * Размеры заданы явно — места под кадр резервируется заранее, без сдвига вёрстки.
 */
export function SceneImage({
  src,
  alt,
  width,
  height,
  priority,
  sizes,
  className,
  sceneSlot,
  gl,
  transitionName,
}: Props) {
  return (
    <picture
      className={className ? `${styles.picture} ${className}` : styles.picture}
      data-scene-slot={sceneSlot ? "" : undefined}
    >
      {/* Статичные SVG-заглушки; конвейер ассетов (next/image или свой) — шаг 8. */}
      <img
        className={styles.image}
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        data-gl-image={gl ? "" : undefined}
        data-gl-transition={gl}
        style={transitionName ? { viewTransitionName: transitionName } : undefined}
      />
    </picture>
  );
}
