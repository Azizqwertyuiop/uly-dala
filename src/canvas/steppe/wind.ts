import {
  DataUtils,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Plane,
  Raycaster,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type Camera,
  type WebGLRenderer,
} from "three";

/*
 * Поле ветра (раздел 2: «курсор = ветер»): render target 128×128 вокруг камеры.
 * RG — направление × сила, B — энергия порыва. Каждый кадр: перенос по самому полю,
 * затухание exp(−dt/τ) по delta кадра (одинаково на 60 и 120 Гц) и новые порывы:
 *  - от курсора / пальца — точка на земле под курсором, направление — движение курсора;
 *  - программные — время от времени идут от горизонта к камере.
 * Читают трава (изгиб, серебро) и приземный туман (снос).
 */

export const WIND_RESOLUTION = 128;
export const WIND_SIZE = 96; // м
export const WIND_DECAY = 1.2; // с
const MAX_SPLATS = 6;

type Splat = { x: number; z: number; dx: number; dz: number; strength: number; radius: number };

function createTarget() {
  return new WebGLRenderTarget(WIND_RESOLUTION, WIND_RESOLUTION, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  });
}

export class WindField {
  readonly origin = new Vector2(-WIND_SIZE / 2, -WIND_SIZE / 2);
  private targets = [createTarget(), createTarget()];
  private index = 0;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: ShaderMaterial;
  private splats: Splat[] = [];
  private raycaster = new Raycaster();
  private ground = new Plane(new Vector3(0, 1, 0), 0);
  private hitA = new Vector3();
  private hitB = new Vector3();
  private ndc = new Vector2();
  private gustTimer = 3;
  private gust: { x: number; z: number; dx: number; dz: number; life: number } | null = null;
  /** Суммарная сила порывов, поданных за всё время (для отладки). */
  injected = 0;
  /** Сила порывов (программных и от курсора), 0…1 — сглаженная; для звука шелеста. */
  gustLevel = 0;
  private lastInjected = 0;

  constructor() {
    this.material = new ShaderMaterial({
      uniforms: {
        tPrev: { value: null },
        uShift: { value: new Vector2() },
        uDecay: { value: 1 },
        uDt: { value: 0 },
        uSplats: { value: Array.from({ length: MAX_SPLATS }, () => new Vector3()) },
        uSplatDirs: { value: Array.from({ length: MAX_SPLATS }, () => new Vector3()) },
        uCount: { value: 0 },
      },
      vertexShader:
        "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: /* glsl */ `
        uniform sampler2D tPrev;
        uniform vec2 uShift;
        uniform float uDecay;
        uniform float uDt;
        uniform vec3 uSplats[${MAX_SPLATS}];    // xy — центр (uv), z — радиус (uv)
        uniform vec3 uSplatDirs[${MAX_SPLATS}]; // xy — направление×сила, z — энергия
        uniform int uCount;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv + uShift;
          vec4 here = texture2D(tPrev, uv);
          // Перенос по полю (порыв бежит по траве).
          vec2 back = uv - here.rg * uDt * 0.012;
          vec4 prev = texture2D(tPrev, back);
          float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
          prev *= uDecay * inside;
          for (int i = 0; i < ${MAX_SPLATS}; i++) {
            if (i >= uCount) break;
            vec2 d = vUv - uSplats[i].xy;
            float g = exp(-dot(d, d) / (uSplats[i].z * uSplats[i].z));
            prev.rg += uSplatDirs[i].xy * g;
            prev.b += uSplatDirs[i].z * g;
          }
          gl_FragColor = vec4(clamp(prev.rg, -4.0, 4.0), clamp(prev.b, 0.0, 4.0), 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new Mesh(new PlaneGeometry(2, 2), this.material));
  }

  get texture() {
    return this.targets[this.index]!.texture;
  }

  /** Порыв от курсора: точка и скорость в нормализованных координатах экрана. */
  pointer(camera: Camera, x: number, y: number, vx: number, vy: number) {
    const speed = Math.hypot(vx, vy);
    if (speed < 0.05) return;
    const a = this.project(camera, x, y, this.hitA);
    const b = this.project(camera, x + vx * 0.06, y + vy * 0.06, this.hitB);
    if (!a || !b) return;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const strength = Math.min(speed * 0.9, 3);
    this.splat({
      x: a.x,
      z: a.z,
      dx: (dx / len) * strength,
      dz: (dz / len) * strength,
      strength,
      radius: 5,
    });
  }

  private project(camera: Camera, x: number, y: number, out: Vector3) {
    this.ndc.set(x, y);
    this.raycaster.setFromCamera(this.ndc, camera);
    return this.raycaster.ray.intersectPlane(this.ground, out);
  }

  splat(s: Splat) {
    if (this.splats.length >= MAX_SPLATS) this.splats.shift();
    this.splats.push(s);
    this.injected += s.strength;
  }

  /** Программные порывы: от горизонта к камере, раз в 5–9 с. */
  private gusts(dt: number, cameraX: number, cameraZ: number, forwardX: number, forwardZ: number) {
    this.gustTimer -= dt;
    if (!this.gust && this.gustTimer <= 0) {
      this.gustTimer = 5 + Math.random() * 4;
      const side = (Math.random() - 0.5) * 30;
      this.gust = {
        x: cameraX + forwardX * 70 + forwardZ * side,
        z: cameraZ + forwardZ * 70 - forwardX * side,
        dx: -forwardX,
        dz: -forwardZ,
        life: 3,
      };
    }
    if (this.gust) {
      const g = this.gust;
      g.x += g.dx * 18 * dt;
      g.z += g.dz * 18 * dt;
      g.life -= dt;
      this.splat({ x: g.x, z: g.z, dx: g.dx * 0.9, dz: g.dz * 0.9, strength: 0.25, radius: 9 });
      if (g.life <= 0) this.gust = null;
    }
  }

  update(
    renderer: WebGLRenderer,
    dt: number,
    camera: { x: number; z: number; forwardX: number; forwardZ: number },
    programmatic: boolean,
  ) {
    if (programmatic) this.gusts(dt, camera.x, camera.z, camera.forwardX, camera.forwardZ);
    // Сколько «ветра» вброшено за кадр → сила порыва (затухает, как само поле).
    if (dt > 0) {
      const rate = (this.injected - this.lastInjected) / dt;
      const target = 1 - Math.exp(-rate / 30);
      const k = 1 - Math.exp(-dt / (target > this.gustLevel ? 0.15 : WIND_DECAY));
      this.gustLevel += (target - this.gustLevel) * k;
    }
    this.lastInjected = this.injected;

    // Поле держится вокруг камеры и чуть впереди — с шагом в тексель, чтобы не дрожало.
    const texel = WIND_SIZE / WIND_RESOLUTION;
    const cx = camera.x + camera.forwardX * 30;
    const cz = camera.z + camera.forwardZ * 30;
    const ox = Math.round((cx - WIND_SIZE / 2) / texel) * texel;
    const oz = Math.round((cz - WIND_SIZE / 2) / texel) * texel;
    const u = this.material.uniforms;
    (u.uShift!.value as Vector2).set(
      (ox - this.origin.x) / WIND_SIZE,
      (oz - this.origin.y) / WIND_SIZE,
    );
    this.origin.set(ox, oz);

    u.uDecay!.value = Math.exp(-dt / WIND_DECAY);
    u.uDt!.value = dt;
    const centers = u.uSplats!.value as Vector3[];
    const dirs = u.uSplatDirs!.value as Vector3[];
    this.splats.forEach((s, i) => {
      centers[i]!.set((s.x - ox) / WIND_SIZE, (s.z - oz) / WIND_SIZE, s.radius / WIND_SIZE);
      dirs[i]!.set(s.dx, s.dz, s.strength);
    });
    u.uCount!.value = this.splats.length;
    this.splats.length = 0;

    const read = this.targets[this.index]!;
    const write = this.targets[1 - this.index]!;
    u.tPrev!.value = read.texture;
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(write);
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(previous);
    this.index = 1 - this.index;
  }

  /** Средняя энергия поля — чтение с GPU (только для отладки и тестов, не в кадре). */
  probe(renderer: WebGLRenderer): number {
    const buffer = new Uint16Array(WIND_RESOLUTION * WIND_RESOLUTION * 4);
    renderer.readRenderTargetPixels(
      this.targets[this.index]!,
      0,
      0,
      WIND_RESOLUTION,
      WIND_RESOLUTION,
      buffer,
    );
    let sum = 0;
    for (let i = 2; i < buffer.length; i += 4) sum += DataUtils.fromHalfFloat(buffer[i]!);
    return sum / (WIND_RESOLUTION * WIND_RESOLUTION);
  }

  dispose() {
    this.targets.forEach((t) => t.dispose());
    this.material.dispose();
  }
}
