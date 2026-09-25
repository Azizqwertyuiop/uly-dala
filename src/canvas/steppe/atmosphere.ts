import { Vector2, Vector3, type IUniform, type Texture } from "three";

/*
 * Общие юниформы атмосферы степи: один объект значений на все материалы (небо, горы, рельеф, трава,
 * туман). Меняем значение здесь — меняется везде в одном кадре.
 */
export type Atmosphere = {
  uSunDir: IUniform<Vector3>;
  uSunElevation: IUniform<number>;
  uSkyReveal: IUniform<number>;
  uDawnBoost: IUniform<number>;
  uGroundFog: IUniform<number>;
  uHaze: IUniform<number>;
  uTime: IUniform<number>;
  tWind: IUniform<Texture | null>;
  uWindOrigin: IUniform<Vector2>;
  uWindSize: IUniform<number>;
};

export function createAtmosphere(): Atmosphere {
  return {
    uSunDir: { value: new Vector3(0.3, -0.017, -1).normalize() },
    uSunElevation: { value: -1 },
    uSkyReveal: { value: 1 },
    uDawnBoost: { value: 1 },
    uGroundFog: { value: 1 },
    uHaze: { value: 0.00022 },
    uTime: { value: 0 },
    tWind: { value: null },
    uWindOrigin: { value: new Vector2(-48, -48) },
    uWindSize: { value: 96 },
  };
}

/** Направление на солнце: азимут — на коня (солнце за ним), высота — в градусах. */
export function sunDirection(
  towardX: number,
  towardZ: number,
  elevationDeg: number,
  out = new Vector3(),
) {
  const e = (elevationDeg * Math.PI) / 180;
  const len = Math.hypot(towardX, towardZ) || 1;
  return out.set((towardX / len) * Math.cos(e), Math.sin(e), (towardZ / len) * Math.cos(e));
}
