import {
  Group,
  Mesh,
  Vector3,
  type BufferGeometry,
  type MeshStandardMaterial,
  type Object3D,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  applyStageLightmap,
  createYurtUniforms,
  patchYurtMaterial,
  type StageLightmaps,
} from "./materials";
import { createPillar } from "./pillar";
import { bakeGeometry, recenter, splitByAngle } from "./split";
import { createTech } from "./tech";
import {
  KEREGE_PANELS,
  pathFraction,
  POLE_COUNT,
  type AssemblyPhase,
  type AssemblyState,
} from "./timeline";

/*
 * Юрта «Сборки» из деталей модели (финальные имена узлов: kerege, uyki, shanyrak, kiiz, esik).
 * Каждая деталь приходит «как руками»: по дуге из-за кадра, последние 8% пути — settle
 * (pathFraction). Положение — чистая функция состояния таймлайна: обратимо при скролле назад.
 * Иерархия: root → lift (подъём при наведении) → turn (вращение человеком) → детали.
 */

/** Дверной проём — спереди (+Z), как в модели (docs/assets.md). */
const DOOR_ANGLE = Math.PI / 2;
/** Верх каркаса (м) — для войлока, укрывающего сверху вниз. */
const FRAME_TOP = 3.14;
/** Высота юрты, м: подъём при наведении — 1% высоты (раздел 5). */
export const YURT_HEIGHT = 3.2;
const TAU = Math.PI * 2;

type Piece = {
  object: Object3D;
  rest: Vector3;
  /** Смещение старта от места, м (из-за кадра). */
  from: Vector3;
  /** Высота дуги, м. */
  lift: number;
  /** Наклон «на руках» в начале пути, рад (x, z). */
  tilt: [number, number];
};

function place(piece: Piece, u: number) {
  const o = piece.object;
  o.visible = u > 0;
  if (!o.visible) return;
  const f = pathFraction(u);
  const k = 1 - f;
  o.position.set(
    piece.rest.x + piece.from.x * k,
    piece.rest.y + piece.from.y * k + piece.lift * Math.sin(Math.PI * f),
    piece.rest.z + piece.from.z * k,
  );
  o.rotation.x = piece.tilt[0] * k;
  o.rotation.z = piece.tilt[1] * k;
}

function findMesh(root: Object3D, name: string): Mesh {
  const node = root.getObjectByName(name);
  let mesh: Mesh | null = null;
  node?.traverse((o) => {
    if (!mesh && (o as Mesh).isMesh) mesh = o as Mesh;
  });
  if (!mesh) throw new Error(`В модели юрты нет узла «${name}» (docs/assets.md)`);
  return mesh;
}

/** Опоры подписей этапов в координатах юрты: подпись стоит у своей детали. */
const CAPTION_ANCHORS: Record<AssemblyPhase, [number, number, number]> = {
  kerege: [-2.3, 1.1, 2.1],
  uyki: [-1.5, 2.5, 1.2],
  shanyrak: [0, 3.25, 0],
  kiiz: [2.1, 1.4, 2.1],
  pillar: [0, 2.2, 0],
};

export function buildYurt(gltf: GLTF, tier: "high" | "medium", lightmaps: StageLightmaps = []) {
  const shared = createYurtUniforms();
  const geometries: BufferGeometry[] = [];
  const materials: MeshStandardMaterial[] = [];
  const keep = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
  const mat = (m: MeshStandardMaterial) => (materials.push(m), m);

  const root = new Group();
  root.name = "yurt_assembly";
  const lift = new Group();
  const turn = new Group();
  root.add(lift);
  lift.add(turn);

  // --- Кереге: 4 панели-гармошки, стык панелей — у дверного проёма.
  const keregeMesh = findMesh(gltf.scene, "kerege");
  const keregeBase = keregeMesh.material as MeshStandardMaterial;
  const keregeBaked = bakeGeometry(keregeMesh, gltf.scene);
  const panelGeometries = splitByAngle(keregeBaked, KEREGE_PANELS, DOOR_ANGLE);
  keregeBaked.dispose();
  const accordion = panelGeometries.map((_, k) => ({
    uCenter: { value: DOOR_ANGLE + ((k + 0.5) * TAU) / KEREGE_PANELS },
    uOpen: { value: 0 },
  }));
  const panels: Piece[] = panelGeometries.map((g, k) => {
    const mesh = new Mesh(
      keep(g),
      mat(patchYurtMaterial(keregeBase, { shared, accordion: accordion[k] })),
    );
    mesh.name = `kerege_${k}`;
    turn.add(mesh);
    const c = accordion[k]!.uCenter.value;
    return {
      object: mesh,
      rest: new Vector3(),
      from: new Vector3(Math.cos(c) * 8, 4, Math.sin(c) * 8),
      lift: 1.2,
      tilt: [0, 0],
    };
  });

  // --- Своя техника: заносится через дверной проём вместе со стенами.
  const tech = createTech();
  turn.add(tech.group);
  const techPieces: Piece[] = tech.pieces.map((p) => ({
    object: p.object,
    rest: new Vector3(...p.rest),
    from: new Vector3(p.from[0] - p.rest[0], p.from[1] - p.rest[1], p.from[2] - p.rest[2]),
    lift: 0.5,
    tilt: [0, 0],
  }));

  // --- Есік: дверь на петле (левый край проёма), открывается наружу в финале.
  const doorMesh = findMesh(gltf.scene, "esik");
  const doorGeometry = keep(bakeGeometry(doorMesh, gltf.scene));
  doorGeometry.computeBoundingBox();
  const box = doorGeometry.boundingBox!;
  const hinge = recenter(
    doorGeometry,
    new Vector3(box.min.x, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2),
  );
  const door = new Mesh(
    doorGeometry,
    mat(patchYurtMaterial(doorMesh.material as MeshStandardMaterial, { shared })),
  );
  door.name = "esik";
  turn.add(door);
  const doorPiece: Piece = {
    object: door,
    rest: hinge,
    from: new Vector3(-3, 0, 5),
    lift: 0.4,
    tilt: [0, 0],
  };

  // --- Уықи: 48 жердей, каждая — отдельная деталь с опорой в своём центре (для наклона).
  const woodMaterial = mat(
    patchYurtMaterial(findMesh(gltf.scene, "uyki").material as MeshStandardMaterial, { shared }),
  );
  const uykiMesh = findMesh(gltf.scene, "uyki");
  const uykiBaked = bakeGeometry(uykiMesh, gltf.scene);
  const poleGeometries = splitByAngle(uykiBaked, POLE_COUNT, -Math.PI / POLE_COUNT);
  uykiBaked.dispose();
  const poles: Piece[] = poleGeometries.map((g, i) => {
    const center = recenter(keep(g));
    const mesh = new Mesh(g, woodMaterial);
    mesh.name = `uyki_${i}`;
    turn.add(mesh);
    const a = (i / POLE_COUNT) * TAU;
    return {
      object: mesh,
      rest: center,
      from: new Vector3(Math.cos(a) * 4, 5, Math.sin(a) * 4),
      lift: 0.6,
      tilt: [0.5, 0.25],
    };
  });

  // --- Шаңырақ: опускается вертикально сверху, медленнее всех.
  const crownMesh = findMesh(gltf.scene, "shanyrak");
  const crown = new Mesh(keep(bakeGeometry(crownMesh, gltf.scene)), woodMaterial);
  crown.name = "shanyrak";
  turn.add(crown);
  const crownPiece: Piece = {
    object: crown,
    rest: new Vector3(),
    from: new Vector3(0, 8, 0),
    lift: 0,
    tilt: [0, 0],
  };

  // --- Кийиз: укрывает каркас сверху вниз (заглушка VAT).
  const kiizMesh = findMesh(gltf.scene, "kiiz");
  const cover = { uCover: { value: 0 }, uTime: { value: 0 }, uTop: { value: FRAME_TOP } };
  const kiiz = new Mesh(
    keep(bakeGeometry(kiizMesh, gltf.scene)),
    mat(patchYurtMaterial(kiizMesh.material as MeshStandardMaterial, { shared, cover })),
  );
  kiiz.name = "kiiz";
  turn.add(kiiz);

  // --- Финал: столп света сквозь шаңырақ.
  const pillar = createPillar(tier);
  turn.add(pillar.group);

  return {
    root,
    lift,
    turn,
    shared,
    setPixelRatio: pillar.setPixelRatio,

    /** Ставит все детали по состоянию таймлайна. Память не выделяет. */
    update(state: AssemblyState, time: number) {
      for (let k = 0; k < panels.length; k++) {
        place(panels[k]!, state.panels[k]!);
        accordion[k]!.uOpen.value = state.accordion[k]!;
      }
      for (let i = 0; i < techPieces.length; i++) {
        // Техника — по одной, со сдвигом (не строем).
        place(techPieces[i]!, Math.min(1, Math.max(0, (state.tech - i * 0.1) / 0.6)));
      }
      place(doorPiece, state.door);
      door.rotation.y = -1.75 * state.doorOpen;
      for (let i = 0; i < poles.length; i++) place(poles[i]!, state.poles[i]!);
      place(crownPiece, state.crown);

      kiiz.visible = state.cover > 0;
      cover.uCover.value = state.cover;
      cover.uTime.value = time;

      pillar.group.visible = state.pillar > 0;
      pillar.uniforms.uIntensity.value = state.pillar;
      pillar.uniforms.uTime.value = time;
      tech.uniforms.uOn.value = state.techOn;
      tech.uniforms.uTime.value = time;

      applyStageLightmap(materials, lightmaps, state.stage);
    },

    /** Опора подписи этапа в мире (после вращения и подъёма). */
    captionAnchor(phase: AssemblyPhase, out: Vector3): Vector3 {
      const [x, y, z] = CAPTION_ANCHORS[phase];
      return out.set(x, y, z).applyMatrix4(turn.matrixWorld);
    },

    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      pillar.dispose();
      tech.dispose();
    },
  };
}

export type Yurt = ReturnType<typeof buildYurt>;
