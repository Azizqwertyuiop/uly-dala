import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type Texture,
} from "three";
import { NOISE_GLSL } from "../steppe/glsl";
import { createKit } from "../day/kit";
import { HEARTH, KAZAN_RADIUS, KAZAN_Y } from "./camera";

/*
 * Очаг «Огня» (CLAUDE.md, раздел 2): угли (эмиссия + шум), дым (частицы), казан на подставке,
 * капля на горячем металле, свечение перехода «вечерний свет стягивается в уголь».
 * Движение — от огня, тепла и воздуха (закон «Причина»); ничего не мигает чаще 3 раз/с.
 * TODO(assets): модели казана и очага от художника, flipbook дыма (docs/assets.md).
 */

const EMBER = "vec3(1.0, 0.32, 0.07)";

export function createHearth(env: Texture | null, tier: "high" | "medium") {
  const kit = createKit();
  const group = kit.group(undefined, "fire_hearth");
  group.position.set(...HEARTH);
  const uniforms = { uTime: { value: 0 }, uHeat: { value: 1 } };

  // --- Камни очага.
  const stone = kit.mat(0x2b2926, { roughness: 0.9 });
  const stones = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return {
      position: [Math.cos(a) * 0.4, 0.04, Math.sin(a) * 0.4] as [number, number, number],
      rotationY: a * 3.1,
      scale: 0.8 + ((i * 37) % 10) / 20,
    };
  });
  kit.instances(new IcosahedronGeometry(0.075, 1).scale(1, 0.7, 1), stone, group, stones);

  // --- Угли: эмиссия по шуму, медленное «дыхание» жара.
  const coalMaterial = kit.material(
    new ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vP;
        varying vec3 vN;
        void main() {
          vec4 local = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            local = instanceMatrix * local;
          #endif
          vec4 w = modelMatrix * local;
          vP = w.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uHeat;
        varying vec3 vP;
        varying vec3 vN;
        ${NOISE_GLSL}
        void main() {
          float n = fbm(vP.xz * 16.0 + vec2(uTime * 0.11, -uTime * 0.07));
          float heat = smoothstep(0.38, 0.78, n + 0.2 * vN.y) * uHeat;
          vec3 ash = vec3(0.012, 0.01, 0.009);
          vec3 col = mix(ash, ${EMBER} * 0.9, heat);
          col = mix(col, vec3(1.0, 0.5, 0.18) * 1.8, smoothstep(0.8, 0.97, n) * uHeat);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  let seed = 3;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const coals = Array.from({ length: tier === "high" ? 34 : 22 }, () => {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.28;
    return {
      position: [Math.cos(a) * r, 0.03 + rand() * 0.03, Math.sin(a) * r] as [
        number,
        number,
        number,
      ],
      rotationY: rand() * 6.28,
      scale: 0.6 + rand() * 0.9,
    };
  });
  kit.instances(new IcosahedronGeometry(0.05, 0), coalMaterial, group, coals);

  // --- Казан на подставке: тёмный чугун, отражает огонь и немного env.
  const iron = kit.mat(0x1f1e21, { roughness: 0.42, metalness: 0.85, env, side: DoubleSide });
  iron.envMapIntensity = 0.6;
  const kazanProfile: [number, number][] = [
    [0, 0.02],
    [0.16, 0],
    [0.25, 0.05],
    [KAZAN_RADIUS, 0.15],
    [KAZAN_RADIUS - 0.01, 0.26],
    [KAZAN_RADIUS + 0.02, 0.28],
    [KAZAN_RADIUS + 0.01, 0.3],
    [KAZAN_RADIUS - 0.02, 0.29],
  ];
  const kazan = new Mesh(kit.lathe(kazanProfile, 48), iron);
  kazan.position.y = KAZAN_Y - 0.06;
  group.add(kazan);
  // Внутри — бульон: тёмно-золотой, с бликом огня.
  const broth = kit.mat(0x6b4a22, { roughness: 0.18, env, emissive: 0x2a1204 });
  broth.envMapIntensity = 0.5;
  kit.mesh(new CircleGeometry(KAZAN_RADIUS - 0.025, 40).rotateX(-Math.PI / 2), broth, group, [
    0,
    KAZAN_Y + 0.17,
    0,
  ]);
  kit.mesh(new TorusGeometry(0.29, 0.012, 8, 40).rotateX(Math.PI / 2), iron, group, [
    0,
    KAZAN_Y - 0.02,
    0,
  ]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    kit.mesh(new CylinderGeometry(0.012, 0.012, KAZAN_Y, 6), iron, group, [
      Math.cos(a) * 0.29,
      KAZAN_Y / 2 - 0.02,
      Math.sin(a) * 0.29,
    ]);
  }

  // --- Дым: частицы от углей вверх, расплываются и тают; ветер сносит.
  const smokeCount = tier === "high" ? 160 : 90;
  const smokeSeeds = new Float32Array(smokeCount * 4);
  for (let i = 0; i < smokeCount; i++) smokeSeeds.set([rand(), rand(), rand(), rand()], i * 4);
  const smokeGeometry = kit.geometry(new BufferGeometry());
  smokeGeometry.setAttribute("position", new BufferAttribute(new Float32Array(smokeCount * 3), 3));
  smokeGeometry.setAttribute("aSeed", new BufferAttribute(smokeSeeds, 4));
  const smoke = new Points(
    smokeGeometry,
    kit.material(
      new ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          attribute vec4 aSeed;
          uniform float uTime;
          varying float vA;
          void main() {
            float life = fract(aSeed.x + uTime * (0.07 + 0.05 * aSeed.y));
            float spread = 0.08 + life * 0.55;
            vec3 p = vec3((aSeed.z - 0.5) * spread, 0.35 + life * 2.4, (aSeed.w - 0.5) * spread);
            p.x += sin(uTime * 0.35 + aSeed.w * 6.0) * 0.12 * life + life * life * 0.5;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (90.0 + 420.0 * life) / -mv.z;
            vA = smoothstep(0.0, 0.15, life) * (1.0 - life) * 0.07;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = (1.0 - smoothstep(0.0, 0.5, d)) * vA;
            gl_FragColor = vec4(vec3(0.34, 0.31, 0.29), a);
          }
        `,
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  smoke.frustumCulled = false;
  group.add(smoke);

  // --- Капля на горячем металле: стекает по стенке казана и испаряется облачком пара.
  const water = kit.mat(0xb8c4cc, { roughness: 0.03, env, transparent: true, opacity: 0.75 });
  const drop = kit.mesh(new SphereGeometry(0.006, 16, 12).scale(1, 1.3, 1), water, group);
  const DROP_ANGLE = 3.05; // к камере макро
  const puffCount = 18;
  const puffGeometry = kit.geometry(new BufferGeometry());
  const puffSeeds = new Float32Array(puffCount * 3);
  for (let i = 0; i < puffCount; i++) puffSeeds.set([rand(), rand(), rand()], i * 3);
  puffGeometry.setAttribute("position", new BufferAttribute(new Float32Array(puffCount * 3), 3));
  puffGeometry.setAttribute("aSeed", new BufferAttribute(puffSeeds, 3));
  const puffUniforms = { uPuff: { value: 0 }, uOrigin: { value: new Vector3() } };
  const puff = new Points(
    puffGeometry,
    kit.material(
      new ShaderMaterial({
        uniforms: puffUniforms,
        vertexShader: /* glsl */ `
          attribute vec3 aSeed;
          uniform float uPuff;
          uniform vec3 uOrigin;
          varying float vA;
          void main() {
            vec3 p = uOrigin + vec3(aSeed.x - 0.5, 0.2 + aSeed.y, aSeed.z - 0.5) * 0.06 * (0.3 + uPuff * 2.0);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = (6.0 + 22.0 * uPuff) / -mv.z;
            vA = sin(uPuff * 3.1416) * 0.5;
          }
        `,
        fragmentShader: /* glsl */ `
          varying float vA;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            gl_FragColor = vec4(vec3(0.92), (1.0 - smoothstep(0.0, 0.5, d)) * vA);
          }
        `,
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  puff.frustumCulled = false;
  group.add(puff);

  // --- Свечение перехода: сфера света у углей, от «весь кадр» до угля.
  const glowUniforms = { uRadius: { value: 14 }, uGlow: { value: 1 } };
  const glow = new Mesh(
    kit.geometry(new PlaneGeometry(2, 2)),
    kit.material(
      new ShaderMaterial({
        uniforms: glowUniforms,
        vertexShader: /* glsl */ `
          uniform float uRadius;
          varying vec2 vP;
          void main() {
            vP = position.xy;
            // Всегда лицом к камере: смещение в пространстве камеры.
            vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            mv.xy += position.xy * uRadius;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uGlow;
          varying vec2 vP;
          void main() {
            float r = length(vP);
            float a = exp(-r * r * 3.2) * (1.0 - smoothstep(0.85, 1.0, r));
            gl_FragColor = vec4(vec3(1.0, 0.5, 0.22) * a * uGlow, 1.0);
          }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: AdditiveBlending,
      }),
    ),
  );
  glow.position.y = 0.08;
  glow.renderOrder = 20;
  glow.frustumCulled = false;
  group.add(glow);

  const dropPosition = (u: number, out: Vector3) => {
    // По профилю казана: от кромки вниз по стенке.
    const y = KAZAN_Y - 0.06 + 0.29 - u * 0.17;
    const r = KAZAN_RADIUS + 0.012 - Math.max(0, u - 0.7) * 0.02;
    return out.set(Math.cos(DROP_ANGLE) * r, y, Math.sin(DROP_ANGLE) * r);
  };

  return {
    group,
    update(time: number, glowRadius: number, glowAmount: number, reduced: boolean) {
      uniforms.uTime.value = time;
      glowUniforms.uRadius.value = glowRadius;
      glowUniforms.uGlow.value = glowAmount;
      glow.visible = glowAmount > 0.001;
      // Капля: 4,5 с — стекает с ускорением, на горячем испаряется (пар).
      const cycle = reduced ? 0.3 : (time % 4.5) / 4.5;
      const slide = Math.min(1, cycle / 0.62);
      dropPosition(slide * slide, drop.position);
      const shrink = 1 - Math.min(1, Math.max(0, (cycle - 0.6) / 0.08));
      drop.scale.setScalar(Math.max(0.001, shrink));
      drop.visible = shrink > 0.01;
      const puffT = (cycle - 0.62) / 0.34;
      puff.visible = puffT > 0 && puffT < 1 && !reduced;
      puffUniforms.uPuff.value = Math.min(1, Math.max(0, puffT));
      dropPosition(1, puffUniforms.uOrigin.value);
    },
    dispose: kit.dispose,
  };
}

export type Hearth = ReturnType<typeof createHearth>;
