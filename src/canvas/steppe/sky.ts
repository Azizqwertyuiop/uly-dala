import {
  BackSide,
  CylinderGeometry,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  type IUniform,
  type Texture,
} from "three";
import { STEPPE_HEAD } from "./glsl";

/*
 * Небо и горы (раздел 2, раздел 6: «небо, дальний план, горы — офлайн, запечённые карты
 * под несколько времён суток, смешиваются шейдером»).
 * Сейчас — процедурная атмосфера (skyColor). Слот под запечённые карты: tSkyA / tSkyB
 * (equirect) и uSkyBlend; пока карт нет (uBaked = 0), рисуется процедурное небо.
 * Горы — три слоя силуэтов на 7, 10 и 14 км; чем дальше, тем больше их «съедает» дымка.
 */

export function createSky(atmosphere: Record<string, IUniform>) {
  const material = new ShaderMaterial({
    uniforms: {
      ...atmosphere,
      tSkyA: { value: null as Texture | null },
      tSkyB: { value: null as Texture | null },
      uSkyBlend: { value: 0 },
      uBaked: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 clip = projectionMatrix * viewMatrix * world;
        gl_Position = clip.xyww; // на дальней плоскости
      }
    `,
    fragmentShader: /* glsl */ `
      ${STEPPE_HEAD}
      uniform sampler2D tSkyA;
      uniform sampler2D tSkyB;
      uniform float uSkyBlend;
      uniform float uBaked;
      varying vec3 vWorld;
      vec2 equirect(vec3 d) {
        return vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415926 + 0.5);
      }
      void main() {
        vec3 dir = normalize(vWorld - cameraPosition);
        vec3 col = skyColor(dir);
        if (uBaked > 0.5) {
          vec2 uv = equirect(dir);
          col = mix(texture2D(tSkyA, uv).rgb, texture2D(tSkyB, uv).rgb, uSkyBlend) * mix(0.15, 1.0, uSkyReveal);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: BackSide,
    depthWrite: false,
  });
  const mesh = new Mesh(new SphereGeometry(18_000, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.name = "steppe_sky";
  return { mesh, material };
}

const LAYERS = [
  { radius: 7_000, height: 180, seed: 3.1, haze: 0.35 },
  { radius: 10_000, height: 320, seed: 7.7, haze: 0.55 },
  { radius: 14_000, height: 520, seed: 11.3, haze: 0.72 },
];

export function createMountains(atmosphere: Record<string, IUniform>) {
  return LAYERS.map((layer, i) => {
    const material = new ShaderMaterial({
      uniforms: {
        ...atmosphere,
        uHeight: { value: layer.height },
        uSeed: { value: layer.seed },
        uLayerHaze: { value: layer.haze },
      },
      vertexShader: /* glsl */ `
        ${STEPPE_HEAD}
        uniform float uHeight;
        uniform float uSeed;
        varying vec3 vWorld;
        varying float vTop;
        void main() {
          vec3 p = position;
          float a = atan(p.z, p.x);
          // Гряда: хребты по окружности, со стороны солнца (за конём) — ниже, горизонт открыт.
          float ridge = fbm(vec2(a * 9.0 + uSeed, uSeed)) * 0.75 + vnoise(vec2(a * 40.0, uSeed)) * 0.25;
          vTop = step(0.0, p.y);
          p.y = vTop > 0.5 ? uHeight * ridge : -60.0;
          vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        ${STEPPE_HEAD}
        uniform float uLayerHaze;
        varying vec3 vWorld;
        void main() {
          vec3 dir = normalize(vWorld - cameraPosition);
          vec3 horizon = skyColor(vec3(dir.x, 0.004, dir.z));
          vec3 silhouette = vec3(0.0012, 0.0014, 0.0024);
          vec3 col = mix(silhouette, horizon, uLayerHaze);
          gl_FragColor = vec4(col * mix(0.15, 1.0, uSkyReveal), 1.0);
        }
      `,
    });
    const mesh = new Mesh(
      new CylinderGeometry(layer.radius, layer.radius, 1, 720, 1, true),
      material,
    );
    mesh.position.y = 0.5;
    mesh.frustumCulled = false;
    mesh.renderOrder = -9 + i;
    mesh.name = `steppe_mountains_${i}`;
    return { mesh, material };
  });
}
