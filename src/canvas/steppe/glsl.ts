/*
 * Общие куски GLSL степи (глава 1). Один источник для неба, рельефа, травы и гор —
 * поэтому туман, горизонт и цвет неба совпадают у всех объектов.
 * Высота рельефа продублирована на JS (terrain.ts, terrainHeight) — для коня и камеры.
 */

/** Юниформы атмосферы: одни и те же объекты значений раздаются всем материалам степи. */
export const ATMOSPHERE_UNIFORMS = /* glsl */ `
  uniform vec3 uSunDir;        // направление на солнце (мир)
  uniform float uSunElevation; // градусы; −1 — за конём, под горизонтом
  uniform float uSkyReveal;    // 0…1 — интро
  uniform float uDawnBoost;    // 1…1.08 — полоса рассвета ярче при hover на CTA
  uniform float uGroundFog;    // плотность приземного тумана
  uniform float uHaze;         // дальняя дымка, 1/м
  uniform float uTime;
  uniform sampler2D tWind;     // поле ветра: RG — направление×сила, B — энергия
  uniform vec2 uWindOrigin;    // левый нижний угол поля в мире (x, z)
  uniform float uWindSize;     // размер поля, м
`;

export const NOISE_GLSL = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash12(i);
    float b = hash12(i + vec2(1.0, 0.0));
    float c = hash12(i + vec2(0.0, 1.0));
    float d = hash12(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p = p * 2.03 + vec2(17.1, 9.2);
      a *= 0.5;
    }
    return v;
  }
`;

/** Рельеф ~20×20 км: мягкие холмы; вдоль пути камеры — почти ровно (камера на 0,6 м). */
export const TERRAIN_GLSL = /* glsl */ `
  float terrainHeight(vec2 p) {
    // Расстояние до коридора пути камеры (x = 0, z от +20 до −400 м).
    float dz = max(p.y - 20.0, 0.0) + min(p.y + 400.0, 0.0);
    float d = length(vec2(p.x, dz));
    float amp = mix(0.18, 9.0, smoothstep(120.0, 3000.0, d));
    float h = (fbm(p * 0.0021) - 0.5) * 2.0 * amp;
    h += (vnoise(p * 0.035) - 0.5) * 0.35;
    return h;
  }
`;

/*
 * Небо (процедурная заглушка атмосферы; слот под запечённые карты — tSkyA/tSkyB).
 * Холодный индиго сверху (~9000 K), узкая тёплая полоса у горизонта (~3200 K) со стороны солнца.
 */
export const SKY_GLSL = /* glsl */ `
  // Значения — линейные, под AgX: 0,004–0,012 дают предрассветное индиго (#10131C…#1C2230).
  const vec3 ZENITH = vec3(0.0022, 0.0030, 0.0068);
  const vec3 MID = vec3(0.0060, 0.0082, 0.0175);
  const vec3 COLD = vec3(0.030, 0.038, 0.062);  // ~9000 K
  const vec3 WARM = vec3(0.62, 0.30, 0.11);     // ~3200 K
  vec3 skyColor(vec3 dir) {
    float e = dir.y;
    float sunUp = clamp((uSunElevation + 1.5) / 6.0, 0.0, 1.0); // восход по скроллу
    vec3 col = mix(MID, ZENITH, smoothstep(0.0, 0.45, e));
    col += COLD * (0.35 + 1.2 * sunUp) * exp(-max(e, 0.0) * 7.0);
    // Азимут к солнцу: полоса сильнее со стороны солнца (за конём).
    vec3 sunFlat = normalize(vec3(uSunDir.x, 0.0, uSunDir.z));
    vec3 dirFlat = normalize(vec3(dir.x, 0.0, dir.z) + 1e-5);
    float toward = 0.5 + 0.5 * dot(sunFlat, dirFlat);
    // Узкая тёплая полоса у горизонта — сильнее со стороны солнца.
    float band = exp(-abs(e - 0.003) * mix(220.0, 90.0, sunUp)) * (0.12 + 0.88 * pow(toward, 4.0));
    col += WARM * band * (0.35 + 1.6 * sunUp) * uDawnBoost;
    // Сияние вокруг солнца, без диска (конь на фоне солнечного диска — запрещено).
    float glow = pow(max(dot(normalize(dir), uSunDir), 0.0), 220.0);
    col += WARM * glow * (0.25 + 1.4 * sunUp) * uDawnBoost;
    // Под горизонтом — сумрак земли (виден в дымке).
    col = mix(col, MID * 0.6, smoothstep(0.0, -0.08, e));
    return col * mix(0.15, 1.0, uSkyReveal);
  }
`;

/*
 * Два слоя тумана (раздел 2): приземный (у травы, рассеивается по скроллу, движется от ветра)
 * и дальняя дымка (воздушная перспектива, цвет — небо у горизонта).
 */
export const FOG_GLSL = /* glsl */ `
  vec3 applyFog(vec3 col, vec3 worldPos) {
    vec3 toPoint = worldPos - cameraPosition;
    float d = length(toPoint);
    vec3 dir = toPoint / max(d, 1e-4);
    // Слой 2 — дальняя дымка.
    float haze = 1.0 - exp(-d * uHaze);
    col = mix(col, skyColor(vec3(dir.x, max(dir.y, 0.002), dir.z)), clamp(haze, 0.0, 1.0));
    // Слой 1 — приземный туман: гуще у земли и вдали, «течёт» по ветру.
    vec2 windUv = (worldPos.xz - uWindOrigin) / uWindSize;
    vec2 flow = texture2D(tWind, windUv).rg;
    float h = max(worldPos.y, 0.0);
    float drift = fbm(worldPos.xz * 0.04 + flow * 0.6 + vec2(uTime * 0.03, uTime * 0.01));
    float mist = uGroundFog * (1.0 - exp(-d / 45.0)) * exp(-h / 1.4) * (0.55 + 0.9 * drift);
    vec3 mistColor = skyColor(vec3(dir.x, 0.02, dir.z)) * 1.1 + vec3(0.002, 0.0025, 0.004);
    return mix(col, mistColor, clamp(mist, 0.0, 0.8));
  }
`;

/** Базовые юниформы (значения — общие объекты, см. atmosphere.ts). */
export const STEPPE_HEAD = ATMOSPHERE_UNIFORMS + NOISE_GLSL + TERRAIN_GLSL + SKY_GLSL + FOG_GLSL;
