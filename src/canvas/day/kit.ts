import {
  BufferGeometry,
  Color,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector2,
  Vector3,
  type Material,
  type Texture,
} from "three";

/*
 * Набор для процедурных площадок «Дня» (заглушки до моделей художника, раздел 0):
 * меши и инстансы с учётом всей памяти — dispose() освобождает всё разом.
 * Материалы — диэлектрики, кроме настоящего металла (медь, хром); у металла — env map.
 */

export type MatOptions = {
  roughness?: number;
  metalness?: number;
  emissive?: number | Color;
  emissiveIntensity?: number;
  env?: Texture | null;
  transparent?: boolean;
  opacity?: number;
  side?: Material["side"];
};

export function createKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const kit = {
    geometry<G extends BufferGeometry>(g: G): G {
      geometries.push(g);
      return g;
    },
    material<M extends Material>(m: M): M {
      materials.push(m);
      return m;
    },
    mat(color: number | Color, o: MatOptions = {}): MeshStandardMaterial {
      return kit.material(
        new MeshStandardMaterial({
          color,
          roughness: o.roughness ?? 0.8,
          metalness: o.metalness ?? 0,
          emissive: o.emissive ?? 0x000000,
          emissiveIntensity: o.emissiveIntensity ?? 1,
          envMap: o.env ?? null,
          transparent: o.transparent ?? false,
          opacity: o.opacity ?? 1,
          side: o.side ?? 0,
        }),
      );
    },
    mesh(
      g: BufferGeometry,
      m: Material,
      parent: Object3D,
      position: [number, number, number] = [0, 0, 0],
      rotation: [number, number, number] = [0, 0, 0],
    ): Mesh {
      const mesh = new Mesh(kit.geometry(g), m);
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      parent.add(mesh);
      return mesh;
    },
    /** Инстансы одной детали — один draw call на все стулья, чашки, лампочки. */
    instances(
      g: BufferGeometry,
      m: Material,
      parent: Object3D,
      placements: { position: [number, number, number]; rotationY?: number; scale?: number }[],
    ): InstancedMesh {
      const inst = new InstancedMesh(kit.geometry(g), m, placements.length);
      const matrix = new Matrix4();
      const q = new Quaternion();
      const up = new Vector3(0, 1, 0);
      const s = new Vector3();
      const p = new Vector3();
      placements.forEach((pl, i) => {
        q.setFromAxisAngle(up, pl.rotationY ?? 0);
        s.setScalar(pl.scale ?? 1);
        matrix.compose(p.set(...pl.position), q, s);
        inst.setMatrixAt(i, matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      parent.add(inst);
      return inst;
    },
    /** Тело вращения по профилю [радиус, высота]. */
    lathe(profile: [number, number][], segments = 32): LatheGeometry {
      return kit.geometry(
        new LatheGeometry(
          profile.map(([r, y]) => new Vector2(r, y)),
          segments,
        ),
      );
    },
    group(parent?: Object3D, name?: string): Group {
      const g = new Group();
      if (name) g.name = name;
      parent?.add(g);
      return g;
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
  return kit;
}

export type Kit = ReturnType<typeof createKit>;

/** Площадка «Дня»: группа в своём слоте и обновление по прогрессу своего состояния. */
export type Setup = {
  group: Group;
  /** local — прогресс состояния 0…1 (уже сглаженный с темпом главы), time — секунды. */
  update(local: number, time: number, active: boolean): void;
  dispose(): void;
};
