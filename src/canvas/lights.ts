import type { DirectionalLight, HemisphereLight } from "three";

/*
 * Общий свет сцены (Stage): небо и солнце. Ночью «Огня» он гаснет — главным светом становится
 * очаг (hearth.ts). Степь (DawnScene) выставляет силу по времени суток.
 */
export const sceneLights = {
  hemi: null as HemisphereLight | null,
  sun: null as DirectionalLight | null,
};

/** Сила по умолчанию (день). */
export const LIGHT_DAY = { hemi: 0.9, sun: 1.6 };
/** Ночью: немного холодного неба, «луна». */
export const LIGHT_NIGHT = { hemi: 0.2, sun: 0.06 };
