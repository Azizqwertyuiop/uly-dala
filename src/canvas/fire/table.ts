import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { menu, menuSets, type Dish, type MenuSet } from "@/content/menu";
import { pathFraction } from "../assembly/timeline";
import { createKit, type Kit } from "../day/kit";
import { HEARTH } from "./camera";

/*
 * Дастархан «Огня» как архитектурный план (вид сверху): войлочный ковёр, стол, блюда сета,
 * тонкие кольца-«разметка» вокруг блюд — проявляются, когда вид становится ортогональным.
 * Смена сета — блюда уносят и ставят «как руками» (по дуге, settle), по времени, не по скроллу.
 * Наведение/фокус на блюде: подъём на 1% высоты, контровой +30%, кольцо — в тон огня.
 * TODO(assets): модели посуды и блюд от художника (docs/assets.md).
 */

/** Верх скатерти (м). */
export const TABLE_TOP = 0.41;
/** Длительность выноса/подачи блюда, с; сдвиг между блюдами. */
const SERVE = 0.7;
const STAGGER = 0.08;

type DishView = {
  dish: Dish;
  group: Group;
  ring: MeshBasicMaterial;
  glow: MeshStandardMaterial[];
  hover: number;
};

function buildDish(kit: Kit, dish: Dish, mats: ReturnType<typeof materials>): DishView {
  const group = new Group();
  group.name = `dish_${dish.id}`;
  const food = kit.mat(dish.food, { roughness: 0.75 });
  const glow: MeshStandardMaterial[] = [food];
  const r = dish.r;
  const add = (mesh: Mesh) => (group.add(mesh), mesh);
  switch (dish.kind) {
    case "cup": {
      add(
        new Mesh(
          kit.lathe(
            [
              [0, 0],
              [r * 0.6, 0],
              [r * 0.8, r * 0.3],
              [r * 0.85, r * 0.7],
              [r * 0.78, r * 0.7],
              [0, r * 0.2],
            ],
            24,
          ),
          mats.porcelain,
        ),
      );
      add(
        new Mesh(kit.geometry(new SphereGeometry(r * 0.76, 20, 8).scale(1, 0.05, 1)), food),
      ).position.y = r * 0.6;
      break;
    }
    case "bowl":
    case "fruit": {
      add(
        new Mesh(
          kit.lathe(
            [
              [0, 0],
              [r * 0.5, 0],
              [r * 0.85, r * 0.25],
              [r, r * 0.45],
              [r * 0.94, r * 0.46],
              [r * 0.8, r * 0.28],
              [0, r * 0.08],
            ],
            28,
          ),
          mats.porcelain,
        ),
      );
      if (dish.kind === "fruit") {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const m = add(new Mesh(kit.geometry(new SphereGeometry(r * 0.26, 14, 10)), food));
          m.position.set(Math.cos(a) * r * 0.45, r * 0.42, Math.sin(a) * r * 0.45);
        }
      } else {
        add(
          new Mesh(kit.geometry(new SphereGeometry(r * 0.82, 24, 10).scale(1, 0.35, 1)), food),
        ).position.y = r * 0.36;
      }
      break;
    }
    case "plate":
    case "platter": {
      const sx = dish.kind === "platter" ? 1.25 : 1;
      const plate = add(
        new Mesh(
          kit.lathe(
            [
              [0, 0],
              [r * 0.8, 0],
              [r, r * 0.08],
              [r * 0.96, r * 0.1],
              [0, r * 0.03],
            ],
            32,
          ),
          mats.porcelain,
        ),
      );
      plate.scale.x = sx;
      for (let i = 0; i < (dish.kind === "platter" ? 5 : 2); i++) {
        const m = add(
          new Mesh(kit.geometry(new SphereGeometry(r * 0.34, 16, 10).scale(1.2, 0.45, 1)), food),
        );
        m.position.set(((i % 3) - 1) * r * 0.42 * sx, r * 0.1, (Math.floor(i / 3) - 0.3) * r * 0.5);
      }
      break;
    }
    case "board": {
      add(new Mesh(kit.geometry(new BoxGeometry(r * 2.1, 0.025, r * 1.2)), mats.wood)).position.y =
        0.0125;
      for (let i = 0; i < 6; i++) {
        const m = add(
          new Mesh(kit.geometry(new SphereGeometry(r * 0.2, 12, 8).scale(1.3, 0.7, 1)), food),
        );
        m.position.set(((i % 3) - 1) * r * 0.6, 0.04, (Math.floor(i / 3) - 0.5) * r * 0.55);
      }
      break;
    }
    case "pot":
    case "jug": {
      const body = dish.kind === "pot" ? mats.copper : mats.porcelain;
      add(
        new Mesh(
          kit.lathe(
            [
              [0, 0],
              [r * 0.7, 0],
              [r, r * 0.6],
              [r * 0.9, r * 1.4],
              [r * 0.5, r * 1.9],
              [r * 0.55, r * 2.0],
              [0, r * 2.0],
            ],
            28,
          ),
          body,
        ),
      );
      if (body !== mats.copper) glow.push(body as MeshStandardMaterial);
      break;
    }
  }
  // Кольцо-«разметка» плана вокруг блюда.
  const ringMat = kit.material(
    new MeshBasicMaterial({
      color: new Color(0.93, 0.9, 0.85),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  const ring = new Mesh(
    kit.geometry(new RingGeometry(r * 1.28, r * 1.28 + 0.01, 48).rotateX(-Math.PI / 2)),
    ringMat,
  );
  ring.position.y = 0.004;
  group.add(ring);
  return { dish, group, ring: ringMat, glow, hover: 0 };
}

function materials(kit: Kit, env: Texture | null) {
  return {
    porcelain: kit.mat(0xf7f5ef, { roughness: 0.2, env }),
    wood: kit.mat(0x6b4a33, { roughness: 0.6 }),
    copper: kit.mat(0xb87333, { roughness: 0.3, metalness: 1, env }),
  };
}

const EMBER = new Color(0.88, 0.38, 0.16);
const KUMYS = new Color(0.93, 0.9, 0.85);

export function createTable(dastarkhan: GLTF, env: Texture | null) {
  const kit = createKit();
  const group = kit.group(undefined, "fire_table");
  const mats = materials(kit, env);

  // Войлочный ковёр под столом и очагом — чистый «лист» для плана.
  kit.mesh(
    new PlaneGeometry(7.4, 3.9).rotateX(-Math.PI / 2),
    kit.mat(0x221d1a, { roughness: 1 }),
    group,
    [0.7, 0.006, -0.1],
  );
  // Дастархан: стол и ткань (половины сомкнуты).
  const model = dastarkhan.scene.clone(true);
  group.add(model);
  // Кольцо плана вокруг очага.
  const hearthRing = kit.material(
    new MeshBasicMaterial({ color: KUMYS, transparent: true, opacity: 0, depthWrite: false }),
  );
  kit.mesh(new RingGeometry(0.62, 0.632, 64).rotateX(-Math.PI / 2), hearthRing, group, [
    HEARTH[0],
    0.012,
    HEARTH[2],
  ]);

  const sets = Object.fromEntries(
    menuSets.map((set) => {
      const views = menu[set].map((dish) => {
        const view = buildDish(kit, dish, mats);
        view.group.position.set(dish.x, TABLE_TOP, dish.z);
        view.group.visible = false;
        group.add(view.group);
        return view;
      });
      return [set, views];
    }),
  ) as Record<MenuSet, DishView[]>;

  let shown: MenuSet | null = null;
  let leaving: { set: MenuSet; t: number } | null = null;
  let arriving: { set: MenuSet; t: number } | null = null;
  const world = new Vector3();

  /** Положение блюда при подаче/выносе: u = 0 — «в руках» вне стола, 1 — на месте. */
  const place = (view: DishView, u: number) => {
    const f = pathFraction(u);
    const k = 1 - f;
    // «Руки» приходят с ближнего края стола (+Z) и сверху.
    view.group.position.set(
      view.dish.x,
      TABLE_TOP + k * 0.45 + Math.sin(Math.PI * f) * 0.12,
      view.dish.z + k * 0.9,
    );
    view.group.visible = u > 0;
  };

  return {
    group,
    sets,
    /** Сет на столе: мгновенно (первый кадр, reduced motion) или «как руками». */
    show(set: MenuSet, instant: boolean) {
      if (set === shown) return;
      if (instant || shown === null) {
        if (shown) sets[shown].forEach((v) => (v.group.visible = false));
        sets[set].forEach((v) => place(v, 1));
        shown = set;
        leaving = arriving = null;
        return;
      }
      leaving = { set: shown, t: 0 };
      arriving = { set, t: 0 };
      shown = set;
    },
    update(dt: number, ortho: number, hover: string | null, reduced: boolean) {
      const step = (s: { set: MenuSet; t: number } | null, out: boolean) => {
        if (!s) return false;
        s.t += dt;
        let done = true;
        sets[s.set].forEach((v, i) => {
          const u = Math.min(1, Math.max(0, (s.t - i * STAGGER - (out ? 0 : SERVE * 0.5)) / SERVE));
          place(v, out ? 1 - u : u);
          if (u < 1) done = false;
        });
        return done;
      };
      if (step(leaving, true)) leaving = null;
      if (step(arriving, false)) arriving = null;

      // Разметка плана проявляется вместе с видом сверху; блюдо под курсором — в тон огня.
      hearthRing.opacity = ortho * 0.3;
      if (shown) {
        for (const v of sets[shown]) {
          const target = hover === v.dish.id ? 1 : 0;
          v.hover += (target - v.hover) * (reduced ? 1 : 1 - Math.exp(-dt / 0.1));
          v.ring.opacity = ortho * (0.3 + 0.55 * v.hover);
          v.ring.color.copy(KUMYS).lerp(EMBER, v.hover);
          for (const m of v.glow) m.emissive.copy(EMBER).multiplyScalar(0.3 * v.hover);
          // Подъём на 1% высоты (для блюда — 1 см), если блюдо уже стоит.
          if (!arriving && !leaving) v.group.position.y = TABLE_TOP + 0.01 * v.hover;
        }
      }
    },
    /** Центр блюда в мире (для подписи и области наведения). */
    dishWorld(view: DishView, out: Vector3) {
      return view.group.getWorldPosition(out);
    },
    current: () => (shown ? sets[shown] : []),
    world,
    dispose: kit.dispose,
    parent: (o: Object3D) => o.add(group),
  };
}

export type FireTable = ReturnType<typeof createTable>;
