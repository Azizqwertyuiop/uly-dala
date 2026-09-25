import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  Points,
  ShaderMaterial,
} from "three";
import { NOISE_GLSL } from "../steppe/glsl";

/*
 * Столп света сквозь шаңырақ (глава 2, финал): «шаңырақ был первым прожектором».
 * Без настоящего volumetric: конус с шейдером (ярче там, где луч толще по взгляду, светлые
 * полосы дыма медленно ползут вниз), пятно света на полу и пыль в луче.
 * Движение — от света и воздуха (закон «Причина»): пыль дрейфует, полосы текут.
 */

export const PILLAR = { top: 3.08, topRadius: 0.5, bottomRadius: 1.2 } as const;

const LIGHT = "vec3(1.0, 0.86, 0.66)";

export function createPillar(tier: "high" | "medium") {
  const uniforms = {
    uIntensity: { value: 0 },
    uTime: { value: 0 },
  };
  const group = new Group();
  group.name = "pillar";

  // Конус: открытый, от венца до пола.
  const coneGeometry = new CylinderGeometry(
    PILLAR.topRadius,
    PILLAR.bottomRadius,
    PILLAR.top,
    48,
    8,
    true,
  ).translate(0, PILLAR.top / 2, 0);
  const cone = new Mesh(
    coneGeometry,
    new ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vY;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          vY = position.y / ${PILLAR.top.toFixed(2)};
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uIntensity;
        uniform float uTime;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying float vY;
        ${NOISE_GLSL}
        void main() {
          vec3 V = normalize(cameraPosition - vWorld);
          // Толщина луча по взгляду: в центре силуэта ярче, к краям — в ноль.
          float thick = pow(abs(dot(normalize(vNormal), V)), 1.6);
          float a = atan(vWorld.z, vWorld.x);
          float streaks = 0.65 + 0.35 * fbm(vec2(a * 3.0, vY * 2.5 + uTime * 0.05));
          // Ярче у венца, мягко гаснет к полу.
          float fall = mix(0.35, 1.0, vY);
          float glow = thick * streaks * fall * uIntensity * 0.55;
          gl_FragColor = vec4(${LIGHT} * glow, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  cone.name = "pillar_cone";
  group.add(cone);

  // Пятно на полу.
  const pool = new Mesh(
    new CircleGeometry(PILLAR.bottomRadius * 1.35, 48).rotateX(-Math.PI / 2).translate(0, 0.012, 0),
    new ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vP;
        void main() {
          vP = position.xz / ${(PILLAR.bottomRadius * 1.35).toFixed(3)};
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uIntensity;
        varying vec2 vP;
        void main() {
          float r = length(vP);
          float pool = smoothstep(1.0, 0.55, r) * (0.6 + 0.4 * smoothstep(0.75, 0.0, r));
          gl_FragColor = vec4(${LIGHT} * pool * uIntensity * 0.5, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  pool.name = "pillar_pool";
  group.add(pool);

  // Пыль в луче.
  const count = tier === "high" ? 420 : 220;
  const seeds = new Float32Array(count * 4);
  let seed = 7;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < count; i++) seeds.set([rand(), rand(), rand(), rand()], i * 4);
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
  dustGeometry.setAttribute("aSeed", new BufferAttribute(seeds, 4));
  const dust = new Points(
    dustGeometry,
    new ShaderMaterial({
      uniforms: { ...uniforms, uPixelRatio: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vA;
        void main() {
          // Медленный дрейф вниз и вокруг оси; по кругу — вечная петля без скачков.
          float y = fract(aSeed.y - uTime * (0.006 + 0.01 * aSeed.w));
          float r = mix(${PILLAR.topRadius.toFixed(2)}, ${PILLAR.bottomRadius.toFixed(2)}, 1.0 - y) * sqrt(aSeed.x) * 0.95;
          float a = aSeed.z * 6.2832 + uTime * 0.05 * (aSeed.w - 0.5);
          vec3 p = vec3(cos(a) * r, y * ${PILLAR.top.toFixed(2)}, sin(a) * r);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.012 + 0.018 * aSeed.w) * uPixelRatio * 800.0 / -mv.z;
          vA = (0.4 + 0.6 * aSeed.w) * smoothstep(0.0, 0.15, y) * smoothstep(1.0, 0.8, y);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uIntensity;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vA * uIntensity;
          gl_FragColor = vec4(${LIGHT} * a * 0.9, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  dust.name = "pillar_dust";
  dust.frustumCulled = false;
  group.add(dust);

  const materials = [cone.material, pool.material, dust.material] as ShaderMaterial[];
  return {
    group,
    uniforms,
    setPixelRatio: (ratio: number) => {
      (dust.material as ShaderMaterial).uniforms.uPixelRatio!.value = ratio;
    },
    dispose: () => {
      for (const m of [cone, pool, dust]) m.geometry.dispose();
      materials.forEach((m) => m.dispose());
    },
  };
}
