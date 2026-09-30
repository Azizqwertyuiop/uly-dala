import {
  BufferAttribute,
  CanvasTexture,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearMipmapLinearFilter,
  Mesh,
  ShaderMaterial,
  Vector3,
  type IUniform,
} from "three";
import { STEPPE_HEAD } from "./glsl";

/*
 * Ковыль (раздел 6: «реалтайм, 120–150k стеблей high / 60–80k medium; качество — шейдером»).
 *  - ближняя зона — InstancedMesh стеблей в плитке 40×40 м, плитка «едет» за камерой;
 *  - средняя — крестовые карточки с текстурой куста (16–230 м), mip bias против мерцания;
 *  - дальняя — поверхность рельефа (terrain.ts), трава растворяется в ней по цвету.
 * Материал двусторонний, полупрозрачный по краям; анизотропный серебряный блик ости
 * (Kajiya–Kay) резко растёт в контровом свете; роса — искры на ближних стеблях.
 * high: alphaToCoverage + MSAA; medium: alphaTest.
 */

export const GRASS_COUNT = { high: 140_000, medium: 70_000 } as const;
export const CARD_COUNT = { high: 26_000, medium: 13_000 } as const;
export const BLADE_TILE = 40;
export const CARD_TILE = 480;

const SHARED = /* glsl */ `
  uniform float uTile;
  uniform vec2 uWave;      // x — расстояние фронта от камеры, y — сила
  uniform vec3 uCircle;    // x, z центра круга примятой травы, радиус
  uniform float uSway;     // 0 — reduced motion (стебли неподвижны)
  uniform float uNearClip; // м: при 135 мм ближняя трава не заслоняет кадр
  uniform vec3 uClearings[4]; // поляны: x, z, радиус (0 — нет; < 0 — травы нет совсем: под ковром)
  // Площадка события в степи — на скошенной траве: низкий дастархан и стулья не тонут в ковыле.
  float mown(vec2 p) {
    float m = 0.0;
    for (int i = 0; i < 4; i++) {
      vec3 c = uClearings[i];
      float r = abs(c.z);
      float strength = c.z < 0.0 ? 1.25 : 1.0;
      if (r > 0.0) m = max(m, strength * (1.0 - smoothstep(r - 0.5, r + 0.3, distance(p, c.xy))));
    }
    return m;
  }
  vec2 tilePosition(vec2 offset) {
    vec2 cam = cameraPosition.xz;
    return cam + mod(offset - cam + uTile * 0.5, uTile) - uTile * 0.5;
  }
  // Изгиб стебля: бриз + поле ветра + фронт серебряной волны (толкает траву к камере).
  vec3 windBend(vec2 p, float phase, out float wave) {
    vec2 windUv = (p - uWindOrigin) / uWindSize;
    vec4 w = texture2D(tWind, windUv);
    float inField = step(0.0, windUv.x) * step(windUv.x, 1.0) * step(0.0, windUv.y) * step(windUv.y, 1.0);
    vec2 breeze = vec2(0.30, -0.18) * (0.55 + 0.45 * sin(uTime * 1.3 + phase * 6.2831 + p.x * 0.27)) * uSway;
    float d = distance(p, cameraPosition.xz);
    wave = exp(-pow((d - uWave.x) / 16.0, 2.0)) * uWave.y;
    vec2 toCam = normalize(cameraPosition.xz - p + 1e-4);
    vec2 bend = breeze * 0.22 + w.rg * 0.32 * inField + toCam * wave * 0.85;
    return vec3(bend.x, w.b * inField, bend.y);
  }
`;

const SHADING = /* glsl */ `
  // Свет стебля: подсветка на просвет, диффуз, серебро ости в контровом свете.
  vec3 grassColor(vec3 world, vec3 N, vec3 T, float along, float awn, float tint, float wave, float gust) {
    vec3 V = normalize(cameraPosition - world);
    vec3 L = uSunDir;
    float sunUp = clamp((uSunElevation + 1.5) / 6.0, 0.0, 1.0);
    vec3 sunCol = mix(vec3(1.0, 0.58, 0.28), vec3(1.0, 0.9, 0.78), sunUp);
    // Стебель в контровом свете — почти силуэт; светится только ость.
    vec3 base = mix(vec3(0.004, 0.0045, 0.003), vec3(0.018, 0.017, 0.010), along) * (0.8 + 0.4 * tint);
    float ambient = 0.35 + 0.35 * uSkyReveal;
    float diffuse = abs(dot(N, L)) * 0.35;
    float back = max(dot(-V, L), 0.0);          // смотрим против солнца
    float transmit = pow(back, 5.0) * 0.9;
    vec3 H = normalize(L + V);
    float th = dot(normalize(T), H);
    float aniso = pow(sqrt(max(1.0 - th * th, 0.0)), 90.0);
    // «Резко растущий в контровом свете»: высокая степень back.
    float silver = awn * (aniso * 0.05 + pow(back, 12.0) * 0.16) * (1.0 + wave * 5.0 + gust * 1.5);
    vec3 col = base * (ambient + diffuse) + base * transmit * sunCol * 2.0;
    // Днём солнце высоко — контровой блик ости слабеет (иначе трава белеет); на закате возвращается.
    col += silver * vec3(0.80, 0.85, 0.95) * (0.4 + 1.4 * sunUp) * uSkyReveal * mix(1.0, 0.25, uDaylight * (1.0 - uDusk)) * (1.0 - uNight);
    return col * dayGain();
  }
`;

function bladeGeometry(tier: "high" | "medium") {
  // Стебель: 4 сегмента, сужается к ости. x — сторона (−0,5…0,5), y — доля высоты.
  const levels = [0, 0.3, 0.55, 0.78, 1];
  const positions: number[] = [];
  const uvs: number[] = [];
  levels.forEach((y, i) => {
    if (i === levels.length - 1) {
      positions.push(0, y, 0);
      uvs.push(0.5, y);
    } else {
      positions.push(-0.5, y, 0, 0.5, y, 0);
      uvs.push(0, y, 1, y);
    }
  });
  const indices: number[] = [];
  for (let i = 0; i < levels.length - 2; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const tip = (levels.length - 1) * 2;
  indices.push(tip - 2, tip - 1, tip);

  const count = GRASS_COUNT[tier];
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.setIndex(indices);
  const offsets = new Float32Array(count * 2);
  const rands = new Float32Array(count * 4);
  let seed = 12345;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < count; i++) {
    offsets[i * 2] = rand() * BLADE_TILE;
    offsets[i * 2 + 1] = rand() * BLADE_TILE;
    rands.set([rand(), rand(), rand(), rand()], i * 4);
  }
  geometry.setAttribute("aOffset", new InstancedBufferAttribute(offsets, 2));
  geometry.setAttribute("aRand", new InstancedBufferAttribute(rands, 4));
  geometry.instanceCount = count;
  return geometry;
}

export function createBlades(
  atmosphere: Record<string, IUniform>,
  tier: "high" | "medium",
  shared: Record<string, IUniform>,
) {
  const material = new ShaderMaterial({
    uniforms: { ...atmosphere, ...shared, uTile: { value: BLADE_TILE } },
    vertexShader: /* glsl */ `
      ${STEPPE_HEAD}
      ${SHARED}
      attribute vec2 aOffset;
      attribute vec4 aRand;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vN;
      varying vec3 vT;
      varying float vTint;
      varying float vWave;
      varying float vGust;
      varying float vDist;
      varying float vSeed;
      void main() {
        vec2 p = tilePosition(aOffset);
        float d = distance(p, cameraPosition.xz);
        // Не у самой камеры (не заслонять кадр) и растворение к краю плитки — там карточки.
        float fade = smoothstep(uNearClip, uNearClip + 2.0, d) * (1.0 - smoothstep(uTile * 0.36, uTile * 0.5, d));
        // Ковыль ниже камеры (0,6 м): ости серебрятся под линией горизонта, не заслоняя коня.
        float height = mix(0.22, 0.5, aRand.x) * fade * max(0.0, 1.0 - 0.8 * mown(p));
        float width = mix(0.010, 0.024, aRand.y);
        float ang = aRand.z * 6.2831853;
        vec2 side = vec2(cos(ang), sin(ang));
        float y = position.y;
        float wave;
        vec3 bend = windBend(p, aRand.w, wave);
        // Круг примятой травы: стебли лежат от центра наружу.
        float flatten = 1.0 - smoothstep(uCircle.z - 0.35, uCircle.z + 0.25, distance(p, uCircle.xy));
        vec2 outward = normalize(p - uCircle.xy + 1e-4);
        float k = y * y;
        vec3 root = vec3(p.x, terrainHeight(p), p.y);
        vec3 offset = vec3(side.x * position.x * width * (1.0 - y * 0.8), 0.0, side.y * position.x * width * (1.0 - y * 0.8));
        vec3 up = vec3(0.0, y * height * (1.0 - flatten * 0.82), 0.0);
        vec3 lean = vec3(bend.x, 0.0, bend.z) * k * height + vec3(outward.x, 0.0, outward.y) * y * height * 0.9 * flatten;
        vec3 world = root + offset + up + lean - vec3(0.0, length(lean) * y * 0.3, 0.0);
        vT = normalize(vec3(bend.x * 2.0 * y + outward.x * flatten, height, bend.z * 2.0 * y + outward.y * flatten));
        vN = normalize(cross(vec3(side.x, 0.0, side.y), vT));
        vUv = uv;
        vWorld = world;
        vTint = aRand.y;
        vWave = wave;
        vGust = bend.y;
        vDist = d;
        vSeed = aRand.w;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${STEPPE_HEAD}
      ${SHARED}
      ${SHADING}
      uniform float uAlphaTest;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vN;
      varying vec3 vT;
      varying float vTint;
      varying float vWave;
      varying float vGust;
      varying float vDist;
      varying float vSeed;
      void main() {
        // Край стебля мягкий: при alphaToCoverage — сглаживание без сортировки.
        float edge = 1.0 - smoothstep(0.55, 1.0, abs(vUv.x * 2.0 - 1.0));
        float alpha = edge;
        if (alpha < uAlphaTest) discard;
        vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
        float awn = smoothstep(0.72, 1.0, vUv.y);
        vec3 col = grassColor(vWorld, N, vT, vUv.y, awn, vTint, vWave, vGust);
        // Роса: искры на ближних стеблях, зависят от угла взгляда.
        if (vDist < 7.0) {
          float cell = floor(vUv.y * 14.0);
          float glint = step(0.93, hash12(vec2(vSeed * 97.0, cell)));
          vec3 V = normalize(cameraPosition - vWorld);
          float spec = pow(max(dot(reflect(-uSunDir, N), V), 0.0), 48.0);
          col += vec3(0.9, 0.92, 1.0) * glint * spec * 3.0 * (1.0 - vDist / 7.0) * uSkyReveal;
        }
        col = applyFog(col, vWorld);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    side: DoubleSide,
    transparent: false,
  });
  material.uniforms.uAlphaTest = { value: tier === "high" ? 0.01 : 0.5 };
  material.alphaToCoverage = tier === "high";
  const mesh = new Mesh(bladeGeometry(tier), material);
  mesh.frustumCulled = false;
  mesh.name = "steppe_grass_near";
  return { mesh, material };
}

/** Текстура куста ковыля для карточек: тонкие дуги с серебристыми остями, с mip-картами. */
function clumpTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  let seed = 99;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 90; i++) {
    const x = size * (0.2 + rand() * 0.6);
    const h = size * (0.55 + rand() * 0.42);
    const lean = (rand() - 0.5) * size * 0.35;
    ctx.strokeStyle = `rgba(255,255,255,${0.55 + rand() * 0.45})`;
    ctx.lineWidth = 1 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, size);
    ctx.quadraticCurveTo(x + lean * 0.3, size - h * 0.6, x + lean, size - h);
    ctx.stroke();
  }
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  return texture;
}

function cardGeometry(tier: "high" | "medium") {
  // Две скрещённые плоскости 1,2 × 0,9 м.
  const w = 0.6,
    h = 0.9;
  const positions = new Float32Array([
    -w,
    0,
    0,
    w,
    0,
    0,
    w,
    h,
    0,
    -w,
    h,
    0,
    0,
    0,
    -w,
    0,
    0,
    w,
    0,
    h,
    w,
    0,
    h,
    -w,
  ]);
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]);
  const geometry = new InstancedBufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const count = CARD_COUNT[tier];
  const offsets = new Float32Array(count * 2);
  const rands = new Float32Array(count * 4);
  let seed = 777;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < count; i++) {
    offsets[i * 2] = rand() * CARD_TILE;
    offsets[i * 2 + 1] = rand() * CARD_TILE;
    rands.set([rand(), rand(), rand(), rand()], i * 4);
  }
  geometry.setAttribute("aOffset", new InstancedBufferAttribute(offsets, 2));
  geometry.setAttribute("aRand", new InstancedBufferAttribute(rands, 4));
  geometry.instanceCount = count;
  return geometry;
}

export function createCards(
  atmosphere: Record<string, IUniform>,
  tier: "high" | "medium",
  shared: Record<string, IUniform>,
) {
  const material = new ShaderMaterial({
    uniforms: {
      ...atmosphere,
      ...shared,
      uTile: { value: CARD_TILE },
      tClump: { value: clumpTexture() },
      uMipBias: { value: -0.6 },
      uAlphaTest: { value: tier === "high" ? 0.15 : 0.5 },
    },
    vertexShader: /* glsl */ `
      ${STEPPE_HEAD}
      ${SHARED}
      attribute vec2 aOffset;
      attribute vec4 aRand;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vWave;
      varying float vGust;
      varying float vFade;
      varying float vTint;
      void main() {
        vec2 p = tilePosition(aOffset);
        float d = distance(p, cameraPosition.xz);
        // Кольцо средней зоны: от края стеблей до растворения в поверхности.
        vFade = smoothstep(max(14.0, uNearClip + 8.0), max(20.0, uNearClip + 14.0), d) * (1.0 - smoothstep(170.0, 230.0, d));
        float scale = mix(0.3, 0.55, aRand.x) * vFade * max(0.0, 1.0 - 0.8 * mown(p));
        float ang = aRand.z * 6.2831853;
        mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
        vec2 xz = rot * position.xz * scale;
        float wave;
        vec3 bend = windBend(p, aRand.w, wave);
        float k = position.y / 0.9;
        vec3 world = vec3(p.x + xz.x, terrainHeight(p) + position.y * scale, p.y + xz.y);
        world += vec3(bend.x, 0.0, bend.z) * k * k * 0.9 * scale;
        vUv = uv;
        vWorld = world;
        vWave = wave;
        vGust = bend.y;
        vTint = aRand.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${STEPPE_HEAD}
      ${SHARED}
      ${SHADING}
      uniform sampler2D tClump;
      uniform float uMipBias;
      uniform float uAlphaTest;
      varying vec2 vUv;
      varying vec3 vWorld;
      varying float vWave;
      varying float vGust;
      varying float vFade;
      varying float vTint;
      void main() {
        // mip bias: карточки вдали не «кипят» и не размываются в кашу.
        // Порог по альфе: mip-карты размывают прозрачные края — без него карточка видна прямоугольником.
        float alpha = smoothstep(0.2, 0.6, texture2D(tClump, vUv, uMipBias).a) * vFade;
        if (alpha < uAlphaTest) discard;
        vec3 N = vec3(0.0, 1.0, 0.0);
        vec3 T = vec3(0.0, 1.0, 0.0);
        vec3 col = grassColor(vWorld, N, T, vUv.y, smoothstep(0.65, 1.0, vUv.y), vTint, vWave, vGust);
        col = applyFog(col, vWorld);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    side: DoubleSide,
  });
  material.alphaToCoverage = tier === "high";
  const mesh = new Mesh(cardGeometry(tier), material);
  mesh.frustumCulled = false;
  mesh.name = "steppe_grass_cards";
  return { mesh, material };
}

/** Сколько скошенных полян одновременно (текущая площадка «Дня» и соседние). */
export const CLEARINGS = 4;

/** Юниформы, общие для стеблей, карточек и рельефа (волна, круг, поляны, покачивание). */
export function createGrassShared() {
  return {
    uWave: { value: [-100, 0] },
    uCircle: { value: [0, -60, 3.2] },
    uClearings: { value: Array.from({ length: CLEARINGS }, () => new Vector3()) },
    uSway: { value: 1 },
    uNearClip: { value: 6 },
  } satisfies Record<string, IUniform>;
}
