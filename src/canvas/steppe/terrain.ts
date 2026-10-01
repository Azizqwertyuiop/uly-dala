import { BufferAttribute, BufferGeometry, Mesh, ShaderMaterial, type IUniform } from "three";
import { STEPPE_HEAD } from "./glsl";

/*
 * Рельеф степи ~20×20 км (раздел 2 — «Рельеф, мягкий шум, LOD»).
 * LOD — полярная сетка вокруг камеры: кольца с экспоненциально растущим шагом
 * (0,5 м у ног → сотни метров у горизонта). Высота — в вершинном шейдере (terrainHeight),
 * центр сетки следует за камерой с привязкой к шагу, чтобы рельеф не «плыл».
 * Дальняя трава — шейдерная поверхность этого же материала (блики и рябь ветра).
 */

// ---------- Высота на JS — точная копия GLSL (для коня, камеры, тестов) ----------

const fract = (v: number) => v - Math.floor(v);
function hash12(x: number, y: number) {
  let a = fract(x * 0.1031),
    b = fract(y * 0.1031),
    c = fract(x * 0.1031);
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d;
  b += d;
  c += d;
  return fract((a + b) * c);
}
function vnoise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const a = hash12(ix, iy),
    b = hash12(ix + 1, iy),
    c = hash12(ix, iy + 1),
    d = hash12(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}
function fbm(x: number, y: number) {
  let v = 0,
    a = 0.5;
  for (let i = 0; i < 4; i++) {
    v += a * vnoise(x, y);
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 9.2;
    a *= 0.5;
  }
  return v;
}
const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Высота рельефа в точке (x, z), м. */
export function terrainHeight(x: number, z: number): number {
  const dz = Math.max(z - 20, 0) + Math.min(z + 400, 0);
  const d = Math.hypot(x, dz);
  const amp = 0.18 + (9 - 0.18) * smoothstep(120, 3000, d);
  return (
    (fbm(x * 0.0021, z * 0.0021) - 0.5) * 2 * amp + (vnoise(x * 0.035, z * 0.035) - 0.5) * 0.35
  );
}

// ---------- Сетка ----------

export const TERRAIN_RADIUS = 10_000;
const SEGMENTS = 192;
const FIRST_RING = 0.5;
const GROWTH = 1.045;

function polarGrid(): BufferGeometry {
  const radii = [0];
  for (let r = FIRST_RING; r < TERRAIN_RADIUS; r *= GROWTH) radii.push(r);
  radii.push(TERRAIN_RADIUS);
  const rings = radii.length;
  const positions = new Float32Array((1 + (rings - 1) * SEGMENTS) * 3);
  let v = 1;
  for (let i = 1; i < rings; i++) {
    for (let s = 0; s < SEGMENTS; s++) {
      const a = (s / SEGMENTS) * Math.PI * 2;
      positions.set([Math.cos(a) * radii[i]!, 0, Math.sin(a) * radii[i]!], v * 3);
      v++;
    }
  }
  const indices: number[] = [];
  for (let s = 0; s < SEGMENTS; s++) indices.push(0, 1 + ((s + 1) % SEGMENTS), 1 + s);
  for (let i = 1; i < rings - 1; i++) {
    const a0 = 1 + (i - 1) * SEGMENTS;
    const b0 = 1 + i * SEGMENTS;
    for (let s = 0; s < SEGMENTS; s++) {
      const s1 = (s + 1) % SEGMENTS;
      indices.push(a0 + s, a0 + s1, b0 + s, a0 + s1, b0 + s1, b0 + s);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

export function createTerrain(atmosphere: Record<string, IUniform>) {
  const material = new ShaderMaterial({
    uniforms: {
      ...atmosphere,
      uCenter: { value: [0, 0] },
      uWave: { value: [-100, 0] },
      uCircle: { value: [0, -60, 3.2] },
      uPressed: { value: 1 },
    },
    vertexShader: /* glsl */ `
      ${STEPPE_HEAD}
      uniform vec2 uCenter;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        vec2 p = position.xz + uCenter;
        float h = terrainHeight(p);
        float e = 0.6 + length(position.xz) * 0.01;
        float hx = terrainHeight(p + vec2(e, 0.0)) - h;
        float hz = terrainHeight(p + vec2(0.0, e)) - h;
        vNormalW = normalize(vec3(-hx, e, -hz));
        vWorld = vec3(p.x, h, p.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${STEPPE_HEAD}
      uniform vec2 uWave;
      uniform vec3 uCircle;
      uniform float uPressed;
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        vec3 N = normalize(vNormalW);
        vec3 V = normalize(cameraPosition - vWorld);
        float d = distance(vWorld, cameraPosition);
        float sunUp = clamp((uSunElevation + 1.5) / 6.0, 0.0, 1.0);
        // Сухая степь: полынь и солома, в контровом свете почти силуэт.
        float patchy = fbm(vWorld.xz * 0.03);
        vec3 base = mix(vec3(0.0035, 0.0038, 0.0026), vec3(0.010, 0.0092, 0.0058), patchy);
        vec3 col = base * (0.35 + 0.35 * uSkyReveal + 0.6 * max(dot(N, uSunDir), 0.0));
        // Дальняя трава как поверхность: серебряный блик навстречу солнцу и рябь ветра.
        float backlit = pow(max(dot(-V, uSunDir), 0.0), 6.0);
        float stripes = vnoise(vWorld.xz * vec2(0.9, 0.35) + vec2(uTime * 0.6, 0.0));
        float wave = exp(-pow((d - uWave.x) / 30.0, 2.0)) * uWave.y;
        float sheen = backlit * (0.35 + 0.65 * stripes) * (0.6 + 2.2 * wave) * smoothstep(8.0, 60.0, d);
        col += vec3(0.62, 0.66, 0.74) * sheen * 0.05 * (0.25 + 0.9 * sunUp) * uSkyReveal;
        // Круг примятой травы — светлее: стебли лежат.
        float circle = 1.0 - smoothstep(uCircle.z - 0.3, uCircle.z + 0.3, distance(vWorld.xz, uCircle.xy));
        col = mix(col, col * 1.6 + vec3(0.01), circle * 0.6 * uPressed);
        col *= dayGain();
        col = applyFog(col, vWorld);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new Mesh(polarGrid(), material);
  mesh.frustumCulled = false;
  mesh.name = "steppe_terrain";
  return { mesh, material };
}
