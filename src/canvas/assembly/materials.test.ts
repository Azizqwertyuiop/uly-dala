import { MeshStandardMaterial, Texture } from "three";
import { describe, expect, it } from "vitest";
import { applyStageLightmap, lightmapForStage, LIGHTMAP_SLOTS } from "./materials";

describe("лайтмапы по этапам (слоты)", () => {
  it("четыре слота — по этапу сборки", () => {
    expect(LIGHTMAP_SLOTS).toEqual(["kerege", "uyki", "shanyrak", "kiiz"]);
  });

  it("нет карт — нет лайтмапы (юрта на динамическом свете)", () => {
    expect(lightmapForStage([], 2)).toBeNull();
    const m = new MeshStandardMaterial();
    applyStageLightmap([m], [], 3);
    expect(m.lightMap).toBeNull();
  });

  it("у этапа нет своей карты — берётся последняя из прошлых", () => {
    const a = new Texture();
    const c = new Texture();
    expect(lightmapForStage([a, null, c, null], 1)).toBe(a);
    expect(lightmapForStage([a, null, c, null], 3)).toBe(c);
  });

  it("шейдер пересобирается, только когда карта появилась или пропала", () => {
    const a = new Texture();
    const b = new Texture();
    const m = new MeshStandardMaterial();
    const v0 = m.version;
    applyStageLightmap([m], [a, b], 0);
    expect(m.lightMap).toBe(a);
    const v1 = m.version;
    expect(v1).toBeGreaterThan(v0);
    applyStageLightmap([m], [a, b], 1);
    expect(m.lightMap).toBe(b);
    expect(m.version).toBe(v1);
  });
});
