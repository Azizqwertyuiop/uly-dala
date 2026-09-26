import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Object3D,
  type Texture,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { FormatSlug } from "@/content/formats";
import { pathFraction } from "../assembly/timeline";
import { createKit, type Kit, type Setup } from "./kit";

/*
 * Шесть площадок «Дня» (CLAUDE.md, раздел 2). Процедурные заглушки с финальной компоновкой:
 * камера смотрит с −X на +X, правая часть кадра — +Z (слева — текст главы).
 * TODO(assets): модели художника (шатёр, мебель, посуда, медь), VAT ткани кудалыка, руки
 * (кудалык — «только руки и предметы»: пока предметы ставятся «как руками», по дуге, без рук).
 * Людей в кадре нет нигде.
 */

export type SetupContext = {
  env: Texture | null;
  led: GLTF;
  dastarkhan: GLTF;
  tier: "high" | "medium";
};

const FELT = 0xede6da;
const WHITE_CLOTH = 0xf4f1ea;
const WOOD = 0x6b4a33;
const DARK = 0x2a2c31;
const WARM_LIGHT = new Color(1, 0.72, 0.4);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const x = clamp01((v - a) / (b - a));
  return x * x * (3 - 2 * x);
};

/** Пар / частицы, поднимающиеся из точек-источников (чашки, медь). Движение — от тепла и ветра. */
function steam(kit: Kit, parent: Object3D, sources: [number, number, number][], perSource: number) {
  const count = sources.length * perSource;
  const seeds = new Float32Array(count * 4);
  const origin = new Float32Array(count * 3);
  let seed = 11;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < count; i++) {
    seeds.set([rand(), rand(), rand(), rand()], i * 4);
    origin.set(sources[Math.floor(i / perSource)]!, i * 3);
  }
  const g = kit.geometry(new BufferGeometry());
  g.setAttribute("position", new BufferAttribute(origin, 3));
  g.setAttribute("aSeed", new BufferAttribute(seeds, 4));
  const uniforms = { uTime: { value: 0 }, uAmount: { value: 1 } };
  const points = new Points(
    g,
    kit.material(
      new ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          attribute vec4 aSeed;
          uniform float uTime;
          varying float vA;
          void main() {
            float life = fract(aSeed.x + uTime * (0.18 + 0.1 * aSeed.y));
            vec3 p = position;
            // Поднимается и расплывается, ветер сносит вбок.
            p.y += life * 0.45;
            p.x += (aSeed.z - 0.5) * 0.08 * life + sin(uTime * 0.9 + aSeed.w * 6.0) * 0.03 * life;
            p.z += (aSeed.w - 0.5) * 0.08 * life + life * life * 0.06;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (18.0 + 40.0 * life) / -mv.z;
            vA = sin(life * 3.1416) * 0.22;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uAmount;
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = (1.0 - smoothstep(0.0, 0.5, d)) * vA * uAmount;
            gl_FragColor = vec4(vec3(0.96), a);
          }
        `,
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  points.frustumCulled = false;
  parent.add(points);
  return uniforms;
}

/** Экран LED в шатре: заглушка «слайда» — горизонт с рассветом и заголовок. Контент — код (docs). */
function ledScreenMaterial(kit: Kit) {
  const uniforms = { uTime: { value: 0 } };
  const material = kit.material(
    new ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;
        float box(vec2 p, vec2 a, vec2 b) {
          return step(a.x, p.x) * step(p.x, b.x) * step(a.y, p.y) * step(p.y, b.y);
        }
        void main() {
          vec2 cell = fract(vUv * vec2(240.0, 135.0));
          float led = smoothstep(0.0, 0.25, cell.x) * (1.0 - smoothstep(0.75, 1.0, cell.x))
                    * smoothstep(0.0, 0.25, cell.y) * (1.0 - smoothstep(0.75, 1.0, cell.y));
          float h = 0.34;
          vec3 col = mix(vec3(0.02, 0.025, 0.05), vec3(0.06, 0.07, 0.12), vUv.y);
          col += vec3(0.9, 0.5, 0.22) * exp(-abs(vUv.y - h) * 14.0) * (0.7 + 0.1 * sin(uTime * 0.3));
          col += vec3(1.0, 0.8, 0.6) * exp(-abs(vUv.y - h) * 160.0);
          // Заголовок и строки — светлые плашки (текст слайда — TODO(client-data)).
          col = mix(col, vec3(0.93, 0.9, 0.85), box(vUv, vec2(0.08, 0.66), vec2(0.52, 0.76)));
          for (int i = 0; i < 3; i++) {
            float y = 0.58 - float(i) * 0.05;
            col = mix(col, vec3(0.55), box(vUv, vec2(0.08, y), vec2(0.4 - float(i) * 0.06, y + 0.018)));
          }
          gl_FragColor = vec4(col * (0.45 + 0.55 * led) * 1.4, 1.0);
        }
      `,
    }),
  );
  return { material, uniforms };
}

// ---------------------------------------------------------------------------
// Конференция: LED-стена в шатре (не монолит в поле), env map
// ---------------------------------------------------------------------------

function conference(ctx: SetupContext): Setup {
  const kit = createKit();
  const group = kit.group(undefined, "day_conference");
  const fabric = kit.mat(0xf2efe8, { roughness: 0.95, side: DoubleSide });
  const chrome = kit.mat(0xc8ccd2, { roughness: 0.25, metalness: 1, env: ctx.env });
  const X0 = -1.2;
  const X1 = 4.2;
  const Z0 = -2.4;
  const Z1 = 3.6;
  const H = 2.8;
  // Стойки по углам и роспуск крыши.
  for (const [x, z] of [
    [X0, Z0],
    [X0, Z1],
    [X1, Z0],
    [X1, Z1],
  ] as const) {
    kit.mesh(new CylinderGeometry(0.04, 0.04, H, 10), chrome, group, [x, H / 2, z]);
  }
  const cx = (X0 + X1) / 2;
  const cz = (Z0 + Z1) / 2;
  const roof = kit.mesh(
    new ConeGeometry(Math.hypot(X1 - X0, Z1 - Z0) / 2, 1.3, 4, 1, true),
    fabric,
    group,
    [cx, H + 0.65, cz],
    [0, Math.PI / 4, 0],
  );
  roof.scale.set((X1 - X0) / (Z1 - Z0), 1, 1);
  // Стенки: задняя и боковые; перед открыт к камере.
  kit.mesh(new PlaneGeometry(Z1 - Z0, H), fabric, group, [X1, H / 2, cz], [0, -Math.PI / 2, 0]);
  kit.mesh(new PlaneGeometry(X1 - X0, H), fabric, group, [cx, H / 2, Z0]);
  kit.mesh(new PlaneGeometry(X1 - X0, H), fabric, group, [cx, H / 2, Z1]);

  // LED-стена у задней стенки, экран — к камере.
  const led = ctx.led.scene.clone(true);
  led.scale.setScalar(0.72);
  led.position.set(X1 - 0.25, 0, cz);
  led.rotation.y = -Math.PI / 2;
  const screen = ledScreenMaterial(kit);
  led.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    if (m.name === "led_screen") m.material = screen.material;
    else if (m.name === "led_frame")
      m.material = kit.mat(0x121316, { roughness: 0.4, metalness: 0.6, env: ctx.env });
  });
  group.add(led);

  // Ряды стульев лицом к экрану (+X); спинка — со стороны камеры.
  const seats: { position: [number, number, number] }[] = [];
  const backs: { position: [number, number, number] }[] = [];
  for (const x of [0.4, 1.3, 2.2]) {
    for (let z = Z0 + 0.9; z <= Z1 - 0.8; z += 0.85) {
      seats.push({ position: [x, 0.46, z] });
      backs.push({ position: [x - 0.21, 0.72, z] });
    }
  }
  const seatMat = kit.mat(DARK, { roughness: 0.6 });
  kit.instances(new BoxGeometry(0.44, 0.05, 0.44), seatMat, group, seats);
  kit.instances(new BoxGeometry(0.04, 0.5, 0.44), seatMat, group, backs);
  kit.instances(
    new CylinderGeometry(0.015, 0.015, 0.46, 6),
    chrome,
    group,
    seats.map((s) => ({
      position: [s.position[0], 0.23, s.position[2]] as [number, number, number],
    })),
  );
  // Трибуна.
  kit.mesh(new BoxGeometry(0.45, 1.1, 0.6), kit.mat(WOOD, { roughness: 0.55 }), group, [
    X1 - 1.4,
    0.55,
    Z1 - 1.3,
  ]);

  return {
    group,
    update(_local, time) {
      screen.uniforms.uTime.value = time;
    },
    dispose: kit.dispose,
  };
}

// ---------------------------------------------------------------------------
// Кофе-брейк: фарфор, медь, пар (частицы — дешевле видео)
// ---------------------------------------------------------------------------

function coffeeBreak(ctx: SetupContext): Setup {
  const kit = createKit();
  const group = kit.group(undefined, "day_coffee_break");
  const cloth = kit.mat(WHITE_CLOTH, { roughness: 0.9 });
  const porcelain = kit.mat(0xfbfaf6, { roughness: 0.16, env: ctx.env });
  const copper = kit.mat(0xb87333, { roughness: 0.28, metalness: 1, env: ctx.env });
  const TX = 0.6;
  const Z0 = -0.6;
  const Z1 = 2.2;
  const TOP = 0.92;
  // Стол под скатертью.
  kit.mesh(new BoxGeometry(0.85, 0.04, Z1 - Z0), cloth, group, [TX, TOP, (Z0 + Z1) / 2]);
  kit.mesh(new BoxGeometry(0.87, 0.3, Z1 - Z0 + 0.02), cloth, group, [
    TX,
    TOP - 0.15,
    (Z0 + Z1) / 2,
  ]);
  const woodMat = kit.mat(WOOD, { roughness: 0.6 });
  for (const z of [Z0 + 0.1, Z1 - 0.1]) {
    for (const x of [TX - 0.35, TX + 0.35]) {
      kit.mesh(new BoxGeometry(0.05, TOP - 0.3, 0.05), woodMat, group, [x, (TOP - 0.3) / 2, z]);
    }
  }
  // Чашки с блюдцами — инстансы.
  const cup = kit.lathe([
    [0.0, 0],
    [0.032, 0],
    [0.04, 0.02],
    [0.045, 0.075],
    [0.041, 0.075],
    [0.036, 0.022],
    [0.0, 0.008],
  ]);
  const saucer = kit.lathe([
    [0, 0],
    [0.07, 0.004],
    [0.078, 0.014],
    [0.074, 0.016],
    [0, 0.006],
  ]);
  const cups: { position: [number, number, number] }[] = [];
  for (let i = 0; i < 10; i++) {
    const z = Z0 + 0.35 + (i % 5) * 0.28 + (i >= 5 ? 1.35 : 0);
    const x = TX + (i % 2 ? 0.16 : -0.14);
    if (z > Z1 - 0.2) continue;
    cups.push({ position: [x, TOP + 0.02, z] });
  }
  kit.instances(saucer, porcelain, group, cups);
  kit.instances(
    cup,
    porcelain,
    group,
    cups.map((c) => ({
      position: [c.position[0], c.position[1] + 0.012, c.position[2]] as [number, number, number],
    })),
  );
  // Медь: два кофейника-самовара (без этнографии — чистая форма).
  const urn = kit.lathe([
    [0, 0],
    [0.09, 0],
    [0.1, 0.03],
    [0.14, 0.14],
    [0.13, 0.3],
    [0.08, 0.36],
    [0.05, 0.4],
    [0.06, 0.42],
    [0, 0.43],
  ]);
  const urns: [number, number, number][] = [
    [TX, TOP + 0.02, Z0 + 1.2],
    [TX, TOP + 0.02, Z1 - 0.3],
  ];
  for (const p of urns) kit.mesh(urn, copper, group, p);
  // Пар — над чашками и из меди.
  const sources: [number, number, number][] = [
    ...cups
      .slice(0, 6)
      .map((c) => [c.position[0], c.position[1] + 0.09, c.position[2]] as [number, number, number]),
    ...urns.map((p) => [p[0], p[1] + 0.45, p[2]] as [number, number, number]),
  ];
  const vapour = steam(kit, group, sources, ctx.tier === "high" ? 14 : 8);

  return {
    group,
    update(_local, time) {
      vapour.uTime.value = time;
    },
    dispose: kit.dispose,
  };
}

// ---------------------------------------------------------------------------
// Тимбилдинг: открытая степь (степь главы 1), размеченное поле, ленты на ветру
// ---------------------------------------------------------------------------

function teamBuilding(): Setup {
  const kit = createKit();
  const group = kit.group(undefined, "day_team_building");
  const rope = kit.mat(FELT, { roughness: 0.9 });
  const stake = kit.mat(WOOD, { roughness: 0.7 });
  const X0 = -0.4;
  const X1 = 5.2;
  const Z0 = -1.6;
  const Z1 = 3.8;
  // Поле, размеченное верёвкой по траве.
  kit.mesh(new BoxGeometry(X1 - X0, 0.025, 0.025), rope, group, [(X0 + X1) / 2, 0.06, Z0]);
  kit.mesh(new BoxGeometry(X1 - X0, 0.025, 0.025), rope, group, [(X0 + X1) / 2, 0.06, Z1]);
  kit.mesh(new BoxGeometry(0.025, 0.025, Z1 - Z0), rope, group, [X0, 0.06, (Z0 + Z1) / 2]);
  kit.mesh(new BoxGeometry(0.025, 0.025, Z1 - Z0), rope, group, [X1, 0.06, (Z0 + Z1) / 2]);
  // Колышки с лентами: ленты движет ветер (закон «Причина»); одна — акцент ember.
  const stakes: [number, number][] = [
    [X0, Z0],
    [X0, Z1],
    [X1, Z0],
    [X1, Z1],
    [(X0 + X1) / 2, Z0],
    [(X0 + X1) / 2, Z1],
    [X0, (Z0 + Z1) / 2],
    [X1, (Z0 + Z1) / 2],
  ];
  const ribbonUniforms = { uTime: { value: 0 } };
  const ribbonGeometry = new PlaneGeometry(0.06, 0.7, 1, 12).translate(0, -0.35, 0);
  const ribbonMaterial = (color: Color) =>
    kit.material(
      new ShaderMaterial({
        uniforms: { ...ribbonUniforms, uColor: { value: color } },
        vertexShader: /* glsl */ `
          uniform float uTime;
          varying float vShade;
          void main() {
            vec3 p = position;
            float t = -p.y / 0.7; // 0 у колышка, 1 на конце
            vec4 w = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float phase = w.x * 0.7 + w.z * 0.5;
            // Лента отлетает по ветру и полощется.
            p.z += t * (0.28 + 0.06 * sin(uTime * 1.3 + phase));
            p.y += t * t * 0.18;
            p.x += sin(uTime * 3.1 + t * 6.0 + phase) * 0.035 * t;
            vShade = 0.75 + 0.25 * sin(uTime * 3.1 + t * 6.0 + phase);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vShade;
          void main() { gl_FragColor = vec4(uColor * vShade, 1.0); }
        `,
        side: DoubleSide,
      }),
    );
  const plain = ribbonMaterial(new Color(0.8, 0.77, 0.7));
  const accent = ribbonMaterial(new Color(0.88, 0.38, 0.16));
  kit.geometry(ribbonGeometry);
  stakes.forEach(([x, z], i) => {
    kit.mesh(new CylinderGeometry(0.025, 0.03, 1.2, 8), stake, group, [x, 0.6, z]);
    const ribbon = new Mesh(ribbonGeometry, i === 5 ? accent : plain);
    ribbon.position.set(x, 1.18, z);
    group.add(ribbon);
  });

  return {
    group,
    update(_local, time) {
      ribbonUniforms.uTime.value = time;
    },
    dispose: kit.dispose,
  };
}

// ---------------------------------------------------------------------------
// Кудалык: белая ткань, две половины дастархана смыкаются; только руки и предметы
// ---------------------------------------------------------------------------

function kudalyk(ctx: SetupContext): Setup {
  const kit = createKit();
  const group = kit.group(undefined, "day_kudalyk");
  const model = ctx.dastarkhan.scene.clone(true);
  // Стол поперёк кадра: половины смыкаются по горизонтали кадра (вдоль Z).
  model.rotation.y = Math.PI / 2;
  model.position.set(0.3, 0, 0.9);
  group.add(model);
  model.traverse((o) => {
    // TODO(assets): VAT ткани от художника; пока половины ткани — заглушка ниже.
    if (o.name === "dastarkhan_left" || o.name === "dastarkhan_right") o.visible = false;
  });

  // Заглушка VAT: две половины белой ткани с волной у свободного края; волна стихает при смыкании.
  const clothUniforms = { uTime: { value: 0 }, uOpen: { value: 1 } };
  const clothMaterial = kit.material(
    new MeshStandardMaterial({ color: WHITE_CLOTH, roughness: 0.92, side: DoubleSide }),
  );
  clothMaterial.customProgramCacheKey = () => "kudalyk-cloth";
  clothMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, clothUniforms);
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "uniform float uTime;\nuniform float uOpen;\nvoid main() {")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        // uv.x = 1 — свободный край (к другой половине): там ткань приподнята и полощется.
        float edge = uv.x * uv.x;
        transformed.z += edge * uOpen * (0.05 + 0.025 * sin(uv.y * 9.0 + uTime * 1.2));
        transformed.z += edge * (1.0 - uOpen) * 0.004 * sin(uv.y * 14.0 + uTime * 0.6);`,
      );
  };
  // Половина ткани: 2,05 м вдоль стола (uv.x → к центру), 1,3 м поперёк.
  const clothGeometry = kit.geometry(new PlaneGeometry(2.05, 1.3, 24, 16));
  const TOP = 0.39;
  const leftCloth = new Mesh(clothGeometry, clothMaterial);
  const rightCloth = new Mesh(clothGeometry, clothMaterial);
  for (const [cloth, side] of [
    [leftCloth, 1],
    [rightCloth, -1],
  ] as const) {
    cloth.rotation.x = -Math.PI / 2;
    // Свободный край (uv.x = 1) — к центру стола.
    cloth.rotation.z = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(cloth);
  }

  // Предметы сервировки — ставятся «как руками» после смыкания (по дуге, settle).
  const porcelain = kit.mat(0xfbfaf6, { roughness: 0.18, env: ctx.env });
  const bowl = kit.lathe([
    [0, 0],
    [0.05, 0],
    [0.09, 0.03],
    [0.11, 0.06],
    [0.105, 0.062],
    [0.085, 0.034],
    [0, 0.012],
  ]);
  const teapot = kit.lathe([
    [0, 0],
    [0.07, 0],
    [0.1, 0.05],
    [0.095, 0.11],
    [0.05, 0.14],
    [0.02, 0.16],
    [0.03, 0.17],
    [0, 0.175],
  ]);
  const objects = [
    { geo: bowl, rest: new Vector3(0.3, TOP, 0.35) },
    { geo: bowl, rest: new Vector3(0.45, TOP, 1.5) },
    { geo: teapot, rest: new Vector3(0.2, TOP, 0.95) },
    { geo: bowl, rest: new Vector3(0.1, TOP, 1.75) },
    { geo: bowl, rest: new Vector3(0.5, TOP, 0.0) },
  ].map((o, i) => {
    const mesh = kit.mesh(o.geo, porcelain, group);
    // «Руки» приходят со стороны камеры (снизу кадра).
    return {
      mesh,
      rest: o.rest,
      from: new Vector3(-0.9, 0.35, (i - 2) * 0.1),
      start: 0.42 + i * 0.06,
    };
  });

  const GAP = 0.55;
  return {
    group,
    update(local, time) {
      // Половины смыкаются медленно (темп кудалыка ×1.6 задаёт сцена через сглаживание local).
      const close = smooth(0.12, 0.5, local);
      const open = 1 - close;
      clothUniforms.uOpen.value = open;
      clothUniforms.uTime.value = time;
      leftCloth.position.set(0.3, TOP + 0.004, 0.9 + 1.025 + GAP * open);
      rightCloth.position.set(0.3, TOP + 0.004, 0.9 - 1.025 - GAP * open);
      for (const o of objects) {
        const u = clamp01((local - o.start) / 0.25);
        o.mesh.visible = u > 0;
        const f = pathFraction(u);
        const k = 1 - f;
        o.mesh.position.set(
          o.rest.x + o.from.x * k,
          o.rest.y + o.from.y * k + 0.12 * Math.sin(Math.PI * f),
          o.rest.z + o.from.z * k,
        );
      }
    },
    dispose: kit.dispose,
  };
}

// ---------------------------------------------------------------------------
// Свадьба: вечерний свет, длинный стол под гирляндой тёплого света
// ---------------------------------------------------------------------------

/** Лампочки по провисающей нити между двумя точками (цепная линия). */
function garland(a: Vector3, b: Vector3, count: number, sag: number): [number, number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count;
    const p = a.clone().lerp(b, t);
    p.y -= sag * 4 * t * (1 - t);
    return [p.x, p.y, p.z] as [number, number, number];
  });
}

function wedding(): Setup {
  const kit = createKit();
  const group = kit.group(undefined, "day_wedding");
  const cloth = kit.mat(WHITE_CLOTH, { roughness: 0.9 });
  const TX = 0.9;
  const Z0 = -1.0;
  const Z1 = 2.6;
  const TOP = 0.76;
  kit.mesh(new BoxGeometry(1.0, 0.04, Z1 - Z0), cloth, group, [TX, TOP, (Z0 + Z1) / 2]);
  kit.mesh(new BoxGeometry(1.02, 0.5, Z1 - Z0 + 0.02), cloth, group, [
    TX,
    TOP - 0.25,
    (Z0 + Z1) / 2,
  ]);
  // Стулья по обе стороны.
  const chairs: { position: [number, number, number]; rotationY: number }[] = [];
  for (let z = Z0 + 0.35; z < Z1 - 0.2; z += 0.6) {
    chairs.push({ position: [TX - 0.75, 0.46, z], rotationY: 0 });
    chairs.push({ position: [TX + 0.75, 0.46, z], rotationY: Math.PI });
  }
  const chairMat = kit.mat(FELT, { roughness: 0.7 });
  kit.instances(new BoxGeometry(0.42, 0.05, 0.42), chairMat, group, chairs);
  kit.instances(
    new BoxGeometry(0.04, 0.48, 0.42).translate(-0.2, 0.25, 0),
    chairMat,
    group,
    chairs,
  );
  // Свечи вдоль стола: пламя — мягкое, без мигания (ничего не мигает чаще 3 раз/с).
  const candleMat = kit.mat(0xf6f1e4, { roughness: 0.6 });
  const flameMat = kit.mat(0xffc680, { emissive: 0xffa94d, emissiveIntensity: 3 });
  const candles: { position: [number, number, number] }[] = [];
  for (let z = Z0 + 0.3; z < Z1 - 0.2; z += 0.5) candles.push({ position: [TX, TOP + 0.1, z] });
  kit.instances(new CylinderGeometry(0.018, 0.018, 0.18, 10), candleMat, group, candles);
  kit.instances(
    new SphereGeometry(0.014, 10, 8).scale(1, 1.8, 1),
    flameMat,
    group,
    candles.map((c) => ({
      position: [c.position[0], c.position[1] + 0.12, c.position[2]] as [number, number, number],
    })),
  );
  // Гирлянда над столом.
  const poleMat = kit.mat(WOOD, { roughness: 0.6 });
  const a = new Vector3(TX, 2.5, Z0 - 0.3);
  const b = new Vector3(TX, 2.5, Z1 + 0.3);
  kit.mesh(new CylinderGeometry(0.03, 0.035, 2.5, 8), poleMat, group, [a.x, 1.25, a.z]);
  kit.mesh(new CylinderGeometry(0.03, 0.035, 2.5, 8), poleMat, group, [b.x, 1.25, b.z]);
  const bulbMat = kit.mat(0xffb870, { emissive: WARM_LIGHT, emissiveIntensity: 1.3 });
  kit.instances(
    new SphereGeometry(0.03, 10, 8),
    bulbMat,
    group,
    garland(a, b, 22, 0.45).map((position) => ({ position })),
  );

  return {
    group,
    update(_local, time) {
      // Пламя «дышит» медленно (~0,5 Гц) — не мигает.
      flameMat.emissiveIntensity = 2.6 + 0.4 * Math.sin(time * 3.1);
    },
    dispose: kit.dispose,
  };
}

// ---------------------------------------------------------------------------
// Частный праздник: небольшой стол у юрты, тёплый интимный свет
// ---------------------------------------------------------------------------

function privateParty(): Setup {
  const kit = createKit();
  const group = kit.group(undefined, "day_private_party");
  // Юрта-силуэт позади стола.
  const felt = kit.mat(0xd9d0c0, { roughness: 0.95 });
  kit.mesh(new CylinderGeometry(1.7, 1.7, 1.2, 40, 1, true), felt, group, [3.2, 0.6, 1.4]);
  kit.mesh(new ConeGeometry(1.75, 0.95, 40, 1, true), felt, group, [3.2, 1.2 + 0.475, 1.4]);
  // Низкий круглый стол и подушки.
  kit.mesh(
    new CylinderGeometry(0.62, 0.62, 0.05, 40),
    kit.mat(WOOD, { roughness: 0.5 }),
    group,
    [0.8, 0.33, 0.6],
  );
  kit.mesh(new CylinderGeometry(0.08, 0.1, 0.31, 12), kit.mat(WOOD), group, [0.8, 0.155, 0.6]);
  const cushion = kit.mat(0x8a6a52, { roughness: 0.95 });
  const cushions = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    return {
      position: [0.8 + Math.cos(a) * 1.0, 0.08, 0.6 + Math.sin(a) * 1.0] as [
        number,
        number,
        number,
      ],
      rotationY: a,
    };
  });
  kit.instances(new CylinderGeometry(0.28, 0.3, 0.14, 20), cushion, group, cushions);
  // Фонари и тёплый круг света у стола. Без точечного источника: новый свет пересобрал бы
  // шейдеры всех освещённых материалов сцены (рывок кадра) — тёплое пятно рисует диск.
  const lanternMat = kit.mat(0xffb870, { emissive: WARM_LIGHT, emissiveIntensity: 1.2 });
  for (const p of [
    [0.7, 0.44, 0.45],
    [1.6, 0.12, 1.8],
    [2.1, 0.12, -0.4],
  ] as [number, number, number][]) {
    kit.mesh(new BoxGeometry(0.1, 0.16, 0.1), lanternMat, group, p);
  }
  const glowUniforms = { uGlow: { value: 0 } };
  const pool = kit.mesh(
    new PlaneGeometry(4.4, 4.4).rotateX(-Math.PI / 2),
    kit.material(
      new ShaderMaterial({
        uniforms: glowUniforms,
        vertexShader: /* glsl */ `
          varying vec2 vP;
          void main() { vP = position.xz / 2.2; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */ `
          uniform float uGlow;
          varying vec2 vP;
          void main() {
            float r = length(vP);
            float a = (1.0 - smoothstep(0.0, 1.0, r)) * (1.0 - smoothstep(0.0, 1.0, r));
            gl_FragColor = vec4(vec3(1.0, 0.62, 0.3) * a * 0.35 * uGlow, 1.0);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    ),
    group,
    [0.8, 0.36, 0.6],
  );
  pool.renderOrder = 1;

  return {
    group,
    update(_local, time, active) {
      // Тёплый круг «дышит» медленно (живой огонь фонарей), только у активной площадки.
      glowUniforms.uGlow.value = active ? 1 + 0.08 * Math.sin(time * 1.7) : 0.6;
    },
    dispose: kit.dispose,
  };
}

export function createSetups(ctx: SetupContext): Record<FormatSlug, Setup> {
  return {
    conference: conference(ctx),
    "coffee-break": coffeeBreak(ctx),
    "team-building": teamBuilding(),
    kudalyk: kudalyk(ctx),
    wedding: wedding(),
    "private-party": privateParty(),
  };
}
