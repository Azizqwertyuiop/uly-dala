import { BoxGeometry, BufferGeometry, Group, Mesh, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { describe, expect, it } from "vitest";
import { bakeGeometry, recenter, sectorOf, splitByAngle } from "./split";

/** Жерди по кругу, слитые в один меш, — как уықи в модели. */
function ring(count: number, radius = 3): BufferGeometry {
  const parts = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return new BoxGeometry(0.04, 1, 0.04).translate(
      Math.cos(a) * radius,
      0.5,
      Math.sin(a) * radius,
    );
  });
  return mergeGeometries(parts)!;
}

describe("детали юрты из слитого меша", () => {
  it("сектор угла: начало — offset, по кругу", () => {
    expect(sectorOf(0, 4, 0)).toBe(0);
    expect(sectorOf(Math.PI / 2 + 0.01, 4, 0)).toBe(1);
    expect(sectorOf(-0.01, 4, 0)).toBe(3);
    expect(sectorOf(Math.PI / 2, 4, Math.PI / 2)).toBe(0);
  });

  it("48 жердей → 48 деталей, в каждой ровно одна жердь (12 треугольников)", () => {
    const pieces = splitByAngle(ring(48), 48, -Math.PI / 48);
    expect(pieces).toHaveLength(48);
    for (const piece of pieces) expect(piece.getAttribute("position").count).toBe(36);
    // Деталь i лежит на своём углу.
    const c = new Vector3();
    pieces[12]!.computeBoundingBox();
    pieces[12]!.boundingBox!.getCenter(c);
    expect(Math.atan2(c.z, c.x)).toBeCloseTo(Math.PI / 2, 2);
  });

  it("ни один треугольник не теряется", () => {
    const whole = ring(72).toNonIndexed().getAttribute("position").count;
    const pieces = splitByAngle(ring(72), 4, Math.PI / 2);
    expect(pieces.reduce((n, p) => n + p.getAttribute("position").count, 0)).toBe(whole);
  });

  it("трансформация узла запекается в геометрию", () => {
    const root = new Group();
    const mesh = new Mesh(new BoxGeometry(1, 1, 1));
    mesh.position.set(0, 2, 0);
    mesh.scale.setScalar(2);
    root.add(mesh);
    const baked = bakeGeometry(mesh, root);
    baked.computeBoundingBox();
    expect(baked.boundingBox!.min.y).toBeCloseTo(1);
    expect(baked.boundingBox!.max.y).toBeCloseTo(3);
  });

  it("recenter переносит опорную точку в начало координат", () => {
    const g = new BoxGeometry(1, 1, 1).translate(5, 1, 0);
    const pivot = recenter(g);
    expect(pivot.x).toBeCloseTo(5);
    g.computeBoundingBox();
    expect(g.boundingBox!.min.x).toBeCloseTo(-0.5);
  });
});
