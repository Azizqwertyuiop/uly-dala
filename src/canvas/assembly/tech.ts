import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  ShaderMaterial,
  type BufferGeometry,
  type Material,
} from "three";

/*
 * Своя техника внутри юрты (глава 2): LED-экран, два световых прибора, звук.
 * «Своя техника и свет показаны как часть монтажа»: техника заносится вместе со стенами
 * (этап «Кереге» = свет, звук, LED), а включается в финале, в столпе света.
 * Процедурная заглушка: TODO(assets) — модели оборудования от художника (docs/assets.md).
 * Детали расставлены так, чтобы их было видно из дверного проёма (+Z).
 */

export type TechPiece = {
  object: Group;
  rest: [number, number, number];
  from: [number, number, number];
};

const dark = () => new MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.6, metalness: 0.1 });

export function createTech() {
  const uniforms = { uOn: { value: 0 }, uTime: { value: 0 } };
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const track = <G extends BufferGeometry, M extends Material>(g: G, m: M) => {
    geometries.push(g);
    materials.push(m);
    return new Mesh(g, m);
  };

  // LED-экран у дальней стены: рассвет над горизонтом — «мир, который мы ставим».
  const screen = new Group();
  screen.name = "tech_led";
  const frameMat = dark();
  screen.add(track(new BoxGeometry(2.5, 1.45, 0.08), frameMat));
  const panel = track(
    new PlaneGeometry(2.4, 1.35),
    new ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOn;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          // Пиксельная сетка LED и медленный рассвет над линией горизонта.
          vec2 cell = fract(vUv * vec2(192.0, 108.0));
          float led = smoothstep(0.0, 0.2, cell.x) * (1.0 - smoothstep(0.8, 1.0, cell.x))
                    * smoothstep(0.0, 0.2, cell.y) * (1.0 - smoothstep(0.8, 1.0, cell.y));
          float h = 0.38 + 0.02 * sin(uTime * 0.2);
          vec3 sky = mix(vec3(0.03, 0.04, 0.08), vec3(0.9, 0.52, 0.24), exp(-abs(vUv.y - h) * 9.0));
          vec3 ground = vec3(0.02, 0.018, 0.014);
          vec3 col = vUv.y > h ? sky : ground;
          col += vec3(1.0, 0.8, 0.6) * exp(-abs(vUv.y - h) * 120.0) * 0.8;
          // Выключенный экран — тёмное стекло, не «дыра».
          vec3 off = vec3(0.012, 0.013, 0.016) * (0.6 + 0.4 * led);
          gl_FragColor = vec4(off + col * (0.35 + 0.65 * led) * uOn * 1.2, 1.0);
        }
      `,
    }),
  );
  panel.position.z = 0.045;
  screen.add(panel);
  const legMat = dark();
  for (const x of [-0.9, 0.9]) {
    const leg = track(new BoxGeometry(0.06, 0.55, 0.06), legMat);
    leg.position.set(x, -0.95, 0);
    screen.add(leg);
  }

  // Световые приборы на стойках: голова смотрит в центр, линза загорается в финале.
  const fixture = (side: 1 | -1) => {
    const g = new Group();
    g.name = side < 0 ? "tech_light_left" : "tech_light_right";
    const standMat = dark();
    const stand = track(new CylinderGeometry(0.02, 0.02, 1.7, 8), standMat);
    stand.position.y = 0.85;
    g.add(stand);
    const base = track(new CylinderGeometry(0.28, 0.3, 0.04, 16), standMat);
    base.position.y = 0.02;
    g.add(base);
    const head = new Group();
    head.position.y = 1.75;
    head.rotation.set(-0.35, side * 0.7, 0);
    head.add(track(new BoxGeometry(0.22, 0.22, 0.3), dark()));
    const lens = track(
      new CircleGeometry(0.08, 24),
      new ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform float uOn;
          void main() { gl_FragColor = vec4(vec3(1.0, 0.9, 0.75) * (0.05 + 3.0 * uOn), 1.0); }
        `,
      }),
    );
    lens.position.z = -0.151;
    lens.rotation.y = Math.PI;
    head.add(lens);
    g.add(head);
    return g;
  };

  // Звук: две колонки по бокам экрана.
  const speaker = (side: 1 | -1) => {
    const g = new Group();
    g.name = side < 0 ? "tech_speaker_left" : "tech_speaker_right";
    const box = track(new BoxGeometry(0.42, 1.1, 0.36), dark());
    box.position.y = 0.55;
    g.add(box);
    return g;
  };

  const group = new Group();
  group.name = "tech";
  // rest — место внутри юрты; from — откуда заносят (через дверной проём, снаружи).
  const pieces: TechPiece[] = [
    { object: screen, rest: [0, 1.25, -2.35], from: [0, 1.25, 7] },
    { object: fixture(-1), rest: [-1.75, 0, -1.1], from: [-2, 0, 8] },
    { object: fixture(1), rest: [1.75, 0, -1.1], from: [2, 0, 8] },
    { object: speaker(-1), rest: [-1.65, 0, -2.05], from: [-1, 0, 9] },
    { object: speaker(1), rest: [1.65, 0, -2.05], from: [1, 0, 9] },
  ];
  for (const p of pieces) {
    p.object.position.set(...p.rest);
    group.add(p.object);
  }

  return {
    group,
    pieces,
    uniforms,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
