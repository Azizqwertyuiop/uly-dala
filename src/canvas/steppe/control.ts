/*
 * Свет степи в главах после «Сборки»: сцена «Дня» задаёт время суток и завесу,
 * степь (DawnScene) применяет. active = false — степь живёт по рассвету и утру.
 */
export const steppeOverride = {
  active: false,
  sunElevation: 48,
  /** 0 — полдень, 1 — тёплые сумерки. */
  dusk: 0,
  /** 0 — вечер, 1 — ночь. */
  night: 0,
  groundFog: 0,
  exposure: 1,
  /** Направление на солнце по земле (x, z): вечером — перед камерой «Дня», контровой свет. */
  sunX: 1,
  sunZ: -0.35,
  /** Поляны под площадками (мир: x, z, радиус; 0 — поляны нет; < 0 — травы нет совсем). */
  clearings: [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ] as [number, number, number][],
};

/*
 * «Снова рассвет» (и хвост «Этот мир существует»): та же степь рассвета, но из ночи —
 * звёзды, предрассветная тьма, круг примятой травы перед камерой. Главнее steppeOverride.
 */
export const steppeReturn = {
  active: false,
  sunElevation: -7,
  groundFog: 0.35,
  exposure: 0.8,
  predawn: 1,
  stars: 1,
  /** Круг примятой травы: x, z, радиус; pressed — 1 лежит, 0 поднялась. */
  circle: [0, 0, 3.2] as [number, number, number],
  pressed: 1,
};
