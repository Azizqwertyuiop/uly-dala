import { Color, type MeshStandardMaterial, type Texture } from "three";

/*
 * Материалы юрты: стандартные PBR-материалы из glTF + небольшие вставки в шейдер.
 * - Контровой свет (rim): общий для всех деталей; при наведении +30% (раздел 5, hover 3D).
 * - Гармошка кереге: панель приходит сжатой по углу и раскрывается у места.
 * - Кийиз: войлок укрывает каркас сверху вниз, по кромке идёт волна ткани.
 *   TODO(assets): Vertex Animation Texture от художника (раздел 6) — заменит эту заглушку,
 *   интерфейс тот же: одно число uCover 0…1.
 * - Лайтмапы по этапам (слоты): запечённый свет каждого этапа, один динамический свет — солнце.
 */

export type YurtUniforms = {
  uRim: { value: number };
  uRimColor: { value: Color };
};

/** Общие юниформы всех деталей (одни объекты значений — меняются в одном месте). */
export function createYurtUniforms(): YurtUniforms {
  return {
    uRim: { value: 1 },
    uRimColor: { value: new Color(0.9, 0.62, 0.36).multiplyScalar(0.18) },
  };
}

type Options = {
  shared: YurtUniforms;
  /** Гармошка: центр панели по углу (рад) и раскрытие 0…1. */
  accordion?: { uCenter: { value: number }; uOpen: { value: number } };
  /** Войлок: укрытие 0…1, время для волны ткани, верх каркаса (м). */
  cover?: { uCover: { value: number }; uTime: { value: number }; uTop: { value: number } };
};

const RIM = /* glsl */ `
  float rimView = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  totalEmissiveRadiance += uRimColor * pow(rimView, 3.0) * uRim;
`;

/** Копия материала модели со вставками. Ключ программы — по набору вставок (а не по объекту). */
export function patchYurtMaterial(base: MeshStandardMaterial, opts: Options): MeshStandardMaterial {
  const material = base.clone();
  const key = ["yurt", opts.accordion ? "acc" : "", opts.cover ? "cover" : ""].join(":");
  material.customProgramCacheKey = () => key;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, opts.shared, opts.accordion ?? {}, opts.cover ?? {});
    let vs = shader.vertexShader;
    let fs = shader.fragmentShader;
    const vsHead: string[] = [];
    const fsHead = ["uniform float uRim;", "uniform vec3 uRimColor;"];

    if (opts.accordion) {
      vsHead.push("uniform float uCenter;", "uniform float uOpen;");
      // Угол вершины относительно центра панели сжимается: 18% ширины → 100%.
      vs = vs.replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        float accA = atan(position.z, position.x);
        float accD = atan(sin(accA - uCenter), cos(accA - uCenter));
        float accRot = accD * (mix(0.18, 1.0, uOpen) - 1.0);
        mat2 accM = mat2(cos(accRot), sin(accRot), -sin(accRot), cos(accRot));
        objectNormal.xz = accM * objectNormal.xz;`,
      );
      vs = vs.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        transformed.xz = accM * transformed.xz;`,
      );
    }

    if (opts.cover) {
      vsHead.push(
        "uniform float uCover;",
        "uniform float uTime;",
        "uniform float uTop;",
        "varying float vCoverS;",
      );
      fsHead.push("uniform float uCover;", "varying float vCoverS;");
      // s — путь войлока сверху вниз: 0 у венца, 1 у земли. Кромка — волна ткани.
      vs = vs.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vCoverS = clamp((uTop - position.y) / uTop, 0.0, 1.0);
        float coverBand = exp(-pow((vCoverS - uCover) / 0.06, 2.0));
        float coverA = atan(position.z, position.x);
        float coverWave = 0.6 + 0.4 * sin(coverA * 9.0 + uTime * 1.7);
        transformed += normalize(objectNormal) * coverBand * coverWave * 0.14 * (1.0 - uCover * uCover);`,
      );
      fs = fs.replace(
        "void main() {",
        `void main() {
        if (vCoverS > uCover + 0.002) discard;`,
      );
    }

    vs = vs.replace("void main() {", `${vsHead.join("\n")}\nvoid main() {`);
    fs = fs.replace("void main() {", `${fsHead.join("\n")}\nvoid main() {`);
    fs = fs.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${RIM}`);
    shader.vertexShader = vs;
    shader.fragmentShader = fs;
  };
  return material;
}

/*
 * Лайтмапы по этапам (раздел 6): «запечённые лайтмапы для этапов, один динамический свет».
 * Слоты: kerege, uyki, shanyrak, kiiz — второй набор UV (uv1). Пока карт нет (TODO(assets)),
 * материалы остаются на динамическом свете. Карта меняется на границе этапа — там, где детали
 * встают на место и свет в любом случае меняется.
 */
export const LIGHTMAP_SLOTS = ["kerege", "uyki", "shanyrak", "kiiz"] as const;

export type StageLightmaps = readonly (Texture | null)[];

/** Карта этапа: последняя доступная не позже этапа (если у этапа своей нет). */
export function lightmapForStage(maps: StageLightmaps, stage: number): Texture | null {
  for (let i = Math.min(stage, maps.length - 1); i >= 0; i--) if (maps[i]) return maps[i]!;
  return null;
}

/** Ставит карту этапа материалам; пересборка шейдера — только если карта появилась/пропала. */
export function applyStageLightmap(
  materials: readonly MeshStandardMaterial[],
  maps: StageLightmaps,
  stage: number,
): void {
  const map = lightmapForStage(maps, stage);
  for (const m of materials) {
    if (m.lightMap === map) continue;
    if (Boolean(m.lightMap) !== Boolean(map)) m.needsUpdate = true;
    m.lightMap = map;
  }
}
