import {
  Data3DTexture,
  LinearFilter,
  NearestFilter,
  RepeatWrapping,
  ShaderMaterial,
  type Texture,
} from "three";
import { identityLut } from "./lut";

/*
 * Финальный проход (CLAUDE.md, раздел 6) — один на всю сцену:
 *  1. тонмаппинг AgX (единственный на сайте), экспозиция — uniform для таймлайна;
 *  2. слот LUT (по умолчанию тождественная);
 *  3. зерно плёнки 2–3%, новое 24 раза в секунду;
 *  4. лёгкая единая виньетка;
 *  5. кодирование в sRGB и дизеринг синим шумом (±1/255, треугольное распределение) — без полос.
 * Вход — линейный HDR-буфер с предумноженной альфой; выход — предумноженный sRGB для холста с alpha.
 */

export const GRAIN_AMOUNT = 0.025;
export const GRAIN_FPS = 24;
export const VIGNETTE = 0.18;

export const DITHER_GLSL = /* glsl */ `
  uniform sampler2D tBlueNoise;
  uniform vec2 uNoiseOffset;
  // Треугольный дизеринг: два значения синего шума → распределение [−1, 1] / 255.
  vec3 ditherSrgb(vec3 srgb, vec2 fragCoord) {
    vec2 p = (fragCoord + uNoiseOffset) / 64.0;
    float n1 = texture2D(tBlueNoise, p).r;
    float n2 = texture2D(tBlueNoise, p + vec2(0.5, 0.25)).r;
    return srgb + (n1 + n2 - 1.0) / 255.0;
  }
`;

const AGX_GLSL = /* glsl */ `
  // AgX (Troy Sobotka), реализация как в three.js (MIT), базовая кривая без «punchy».
  vec3 agxContrast(vec3 x) {
    vec3 x2 = x * x;
    vec3 x4 = x2 * x2;
    return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
  }
  vec3 agx(vec3 color) {
    const mat3 inset = mat3(0.856627153315983, 0.137318972929847, 0.11189821299995,
                            0.0951212405381588, 0.761241990602591, 0.0767994186031903,
                            0.0482516061458583, 0.101439036467562, 0.811302368396859);
    const mat3 outset = mat3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826,
                             -0.11060664309660323, 1.157823702216272, -0.11060664309660294,
                             -0.016493938717834573, -0.016493938717834257, 1.2519364065950405);
    const float minEv = -12.47393;
    const float maxEv = 4.026069;
    color = inset * color;
    color = max(color, 1e-10);
    color = clamp(log2(color), minEv, maxEv);
    color = (color - minEv) / (maxEv - minEv);
    color = agxContrast(color);
    color = outset * color;
    color = pow(max(vec3(0.0), color), vec3(2.2)); // обратно в линейное
    return clamp(color, 0.0, 1.0);
  }
`;

export function createPostMaterial(blueNoise: Texture, lut: Data3DTexture = identityLut()) {
  blueNoise.wrapS = blueNoise.wrapT = RepeatWrapping;
  blueNoise.minFilter = blueNoise.magFilter = NearestFilter;
  blueNoise.generateMipmaps = false;
  lut.minFilter = lut.magFilter = LinearFilter;

  return new ShaderMaterial({
    uniforms: {
      tScene: { value: null },
      tBlueNoise: { value: blueNoise },
      tLut: { value: lut },
      uLutAmount: { value: 0 },
      uExposure: { value: 1 },
      uGrain: { value: GRAIN_AMOUNT },
      uGrainSeed: { value: 0 },
      uVignette: { value: VIGNETTE },
      uDither: { value: 1 },
      uNoiseOffset: { value: [0, 0] },
      uResolution: { value: [1, 1] },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      precision highp sampler3D;
      uniform sampler2D tScene;
      uniform sampler3D tLut;
      uniform float uLutAmount;
      uniform float uExposure;
      uniform float uGrain;
      uniform float uGrainSeed;
      uniform float uVignette;
      uniform float uDither;
      uniform vec2 uResolution;
      varying vec2 vUv;
      ${AGX_GLSL}
      ${DITHER_GLSL}
      float hash(vec2 p) {
        p = fract(p * vec2(443.897, 441.423));
        p += dot(p, p.yx + 19.19);
        return fract((p.x + p.y) * p.x);
      }
      vec3 linearToSrgb(vec3 c) {
        return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      }
      void main() {
        vec4 scene = texture2D(tScene, vUv);
        float a = scene.a;
        if (a <= 0.0) { gl_FragColor = vec4(0.0); return; }
        vec3 color = scene.rgb / a * uExposure;
        color = agx(color);
        // LUT — в пространстве отображения (как у колориста).
        vec3 display = linearToSrgb(color);
        vec3 graded = texture(tLut, clamp(display, 0.0, 1.0)).rgb;
        display = mix(display, graded, uLutAmount);
        // Зерно: яркостное, сильнее в полутонах, новое 24 раза в секунду.
        float luma = dot(display, vec3(0.2126, 0.7152, 0.0722));
        float grain = hash(gl_FragCoord.xy + uGrainSeed * 17.0) - 0.5;
        display += grain * uGrain * (1.0 - abs(luma - 0.5) * 1.2);
        // Виньетка.
        vec2 q = vUv - 0.5;
        display *= 1.0 - uVignette * dot(q, q) * 2.0;
        // Дизеринг перед квантованием в 8 бит.
        if (uDither > 0.5) display = ditherSrgb(display, gl_FragCoord.xy);
        gl_FragColor = vec4(clamp(display, 0.0, 1.0) * a, a);
      }
    `,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}

/** Сдвиг шума и зерна обновляется 24 раза в секунду (раздел 6). */
export function grainFrame(time: number): number {
  return Math.floor(time * GRAIN_FPS);
}
