import { BufferAttribute, BufferGeometry, Matrix4, Vector3, type Mesh, type Object3D } from "three";

/*
 * Детали юрты из модели. В glTF кереге и уықи — по одному мешу на все рейки/жерди
 * (так дешевле и так их отдаёт художник). Чтобы детали приходили по одной, меш режется
 * по углу вокруг оси юрты: треугольник попадает в сектор по углу своего центра.
 * Работает для любой радиально-симметричной модели — заглушку можно заменить без кода.
 * Режется один раз при загрузке сцены (не в кадре).
 */

/** Копия геометрии в float32 с запечённой трансформацией узла относительно корня модели. */
export function bakeGeometry(mesh: Mesh, root: Object3D): BufferGeometry {
  root.updateWorldMatrix(true, true);
  const relative = new Matrix4().copy(root.matrixWorld).invert().multiply(mesh.matrixWorld);
  const source = mesh.geometry;
  const out = new BufferGeometry();
  // Квантованные атрибуты (KHR_mesh_quantization) — в обычные float: getX учитывает normalized.
  for (const name of ["position", "normal", "uv", "uv1"]) {
    const attr = source.getAttribute(name);
    if (!attr) continue;
    const array = new Float32Array(attr.count * attr.itemSize);
    for (let i = 0; i < attr.count; i++) {
      for (let c = 0; c < attr.itemSize; c++)
        array[i * attr.itemSize + c] = attr.getComponent(i, c);
    }
    out.setAttribute(name, new BufferAttribute(array, attr.itemSize));
  }
  if (source.index) out.setIndex(Array.from(source.index.array as ArrayLike<number>));
  out.applyMatrix4(relative);
  return out;
}

const TAU = Math.PI * 2;

/** Сектор угла a (рад) при count секторах, начиная с offset. */
export function sectorOf(a: number, count: number, offset: number): number {
  const x = (((a - offset) % TAU) + TAU) % TAU;
  return Math.min(count - 1, Math.floor((x / TAU) * count));
}

/** Режет геометрию на count секторов по углу atan2(z, x) центра треугольника. */
export function splitByAngle(
  geometry: BufferGeometry,
  count: number,
  offset = 0,
): BufferGeometry[] {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const names = Object.keys(g.attributes);
  const buckets = Array.from({ length: count }, () =>
    Object.fromEntries(names.map((n) => [n, [] as number[]])),
  );
  const pos = g.getAttribute("position");
  for (let t = 0; t < pos.count; t += 3) {
    const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3;
    const cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
    const bucket = buckets[sectorOf(Math.atan2(cz, cx), count, offset)]!;
    for (const name of names) {
      const attr = g.getAttribute(name);
      const target = bucket[name]!;
      for (let v = t; v < t + 3; v++)
        for (let c = 0; c < attr.itemSize; c++) target.push(attr.getComponent(v, c));
    }
  }
  if (g !== geometry) g.dispose();
  return buckets.map((bucket) => {
    const piece = new BufferGeometry();
    for (const name of names) {
      piece.setAttribute(
        name,
        new BufferAttribute(new Float32Array(bucket[name]!), geometry.getAttribute(name).itemSize),
      );
    }
    return piece;
  });
}

/** Сдвигает геометрию так, чтобы pivot оказался в начале координат; возвращает pivot. */
export function recenter(geometry: BufferGeometry, pivot?: Vector3): Vector3 {
  const p = pivot?.clone() ?? new Vector3();
  if (!pivot) {
    geometry.computeBoundingBox();
    geometry.boundingBox!.getCenter(p);
  }
  geometry.translate(-p.x, -p.y, -p.z);
  geometry.computeBoundingSphere();
  return p;
}
