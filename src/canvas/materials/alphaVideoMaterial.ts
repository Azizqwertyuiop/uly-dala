import {
  CustomBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  type Texture,
} from "three";

/*
 * Материал видео с альфой без ореолов (CLAUDE.md, раздел 6: «предумноженная альфа, без ореолов»).
 *
 * Текстура загружена с UNPACK_PREMULTIPLY_ALPHA (texture.premultiplyAlpha = true), поэтому
 * билинейная фильтрация смешивает уже предумноженные значения — у прозрачных пикселей RGB = 0
 * не «протекает» в край. Дальше в шейдере: снять предумножение → sRGB в линейный → снова
 * предумножить. Смешивание — предумноженное: ONE, ONE_MINUS_SRC_ALPHA.
 * Сцена рисуется в линейный HDR-буфер; тонмаппинг — один, в финальном проходе (post.ts).
 */
export function createAlphaVideoMaterial(map: Texture | null = null) {
  return new ShaderMaterial({
    uniforms: {
      map: { value: map },
      opacity: { value: 1 },
      // Воздушная перспектива: дальний объект (конь на ~275 м) слегка тонет в дымке.
      uFogColor: { value: [0.006, 0.008, 0.016] },
      uFogAmount: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float opacity;
      uniform vec3 uFogColor;
      uniform float uFogAmount;
      varying vec2 vUv;
      vec3 srgbToLinear(vec3 c) {
        return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
      }
      void main() {
        vec4 t = texture2D(map, vUv);          // предумноженный sRGB
        float a = t.a * opacity;
        vec3 straight = t.a > 0.0 ? clamp(t.rgb / t.a, 0.0, 1.0) : vec3(0.0);
        vec3 lin = mix(srgbToLinear(straight), uFogColor, uFogAmount);
        gl_FragColor = vec4(lin * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    premultipliedAlpha: true,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    toneMapped: false,
  });
}
