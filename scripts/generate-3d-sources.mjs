/*
 * Процедурные исходники 3D с ФИНАЛЬНЫМИ именами узлов (CLAUDE.md, раздел 0):
 * настоящие модели художника заменят эти файлы в assets-src/ без изменений кода.
 * Требования к моделям — docs/assets.md. 1 единица = 1 метр, Y вверх, взгляд камеры — по −Z.
 *
 * Запуск: node scripts/generate-3d-sources.mjs → assets-src/models/*.glb, assets-src/textures/*,
 *         public/assets/noise/blue-noise-64.png
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { Document, NodeIO } from "@gltf-transform/core";
import { blueNoise } from "./lib/blue-noise.mjs";
import { encodePng } from "./lib/png.mjs";

const ROOT = new URL("../", import.meta.url);
const MODELS = new URL("assets-src/models/", ROOT);
const TEXTURES = new URL("assets-src/textures/", ROOT);
const NOISE = new URL("public/assets/noise/", ROOT);
for (const dir of [MODELS, TEXTURES, NOISE]) mkdirSync(dir, { recursive: true });

// ---------- Геометрия ----------

/** Сборщик меша: позиции, нормали, UV, индексы. */
class MeshBuilder {
  positions = [];
  normals = [];
  uvs = [];
  indices = [];
  quad(
    a,
    b,
    c,
    d,
    n,
    uv = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
  ) {
    const base = this.positions.length / 3;
    for (const [i, p] of [a, b, c, d].entries()) {
      this.positions.push(...p);
      this.normals.push(...n);
      this.uvs.push(...uv[i]);
    }
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  /** Коробка с центром c и размерами s, повёрнутая на yaw вокруг Y. */
  box(c, s, yaw = 0, pitch = 0) {
    const [hx, hy, hz] = s.map((v) => v / 2);
    const rot = (p) => {
      // pitch — вокруг X, затем yaw — вокруг Y
      let [x, y, z] = p;
      const cp = Math.cos(pitch),
        sp = Math.sin(pitch);
      [y, z] = [y * cp - z * sp, y * sp + z * cp];
      const cy = Math.cos(yaw),
        sy = Math.sin(yaw);
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      return [x, y, z];
    };
    const v = (x, y, z) => rot([x, y, z]).map((val, i) => val + c[i]);
    const n = (x, y, z) => rot([x, y, z]);
    this.quad(v(-hx, -hy, hz), v(hx, -hy, hz), v(hx, hy, hz), v(-hx, hy, hz), n(0, 0, 1));
    this.quad(v(hx, -hy, -hz), v(-hx, -hy, -hz), v(-hx, hy, -hz), v(hx, hy, -hz), n(0, 0, -1));
    this.quad(v(-hx, hy, hz), v(hx, hy, hz), v(hx, hy, -hz), v(-hx, hy, -hz), n(0, 1, 0));
    this.quad(v(-hx, -hy, -hz), v(hx, -hy, -hz), v(hx, -hy, hz), v(-hx, -hy, hz), n(0, -1, 0));
    this.quad(v(hx, -hy, hz), v(hx, -hy, -hz), v(hx, hy, -hz), v(hx, hy, hz), n(1, 0, 0));
    this.quad(v(-hx, -hy, -hz), v(-hx, -hy, hz), v(-hx, hy, hz), v(-hx, hy, -hz), n(-1, 0, 0));
    return this;
  }
  /** Поверхность вращения: профиль [радиус, высота][], развёртка UV по окружности и профилю. */
  lathe(profile, segments = 48) {
    const base = this.positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const cos = Math.cos(a),
        sin = Math.sin(a);
      for (const [j, [r, y]] of profile.entries()) {
        this.positions.push(r * cos, y, r * sin);
        // нормаль — по наклону профиля
        const [r0, y0] = profile[Math.max(0, j - 1)];
        const [r1, y1] = profile[Math.min(profile.length - 1, j + 1)];
        const dr = r1 - r0,
          dy = y1 - y0;
        const len = Math.hypot(dr, dy) || 1;
        const nr = dy / len,
          ny = -dr / len;
        this.normals.push(nr * cos, ny, nr * sin);
        this.uvs.push(i / segments, j / (profile.length - 1));
      }
    }
    const rows = profile.length;
    for (let i = 0; i < segments; i++)
      for (let j = 0; j < rows - 1; j++) {
        const a = base + i * rows + j,
          b = a + rows;
        this.indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    return this;
  }
}

function addMesh(doc, buffer, name, builder, material) {
  const acc = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setAttribute("POSITION", acc("VEC3", new Float32Array(builder.positions)))
    .setAttribute("NORMAL", acc("VEC3", new Float32Array(builder.normals)))
    .setAttribute("TEXCOORD_0", acc("VEC2", new Float32Array(builder.uvs)))
    .setIndices(acc("SCALAR", new Uint32Array(builder.indices)))
    .setMaterial(material);
  return doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim));
}

// ---------- Текстуры ----------

function feltTextures(size = 512) {
  const color = new Uint8Array(size * size * 4);
  const normal = new Uint8Array(size * size * 4);
  const height = new Float32Array(size * size);
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  // Шум войлока: сумма нескольких октав сглаженного шума.
  for (let oct = 0, amp = 0.5, cell = 64; oct < 5; oct++, amp /= 2, cell /= 2) {
    const grid = size / cell + 1;
    const g = Array.from({ length: grid * grid }, rand);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const gx = x / cell,
          gy = y / cell;
        const x0 = Math.floor(gx),
          y0 = Math.floor(gy);
        const fx = gx - x0,
          fy = gy - y0;
        const s = (t) => t * t * (3 - 2 * t);
        const v = (i, j) => g[((y0 + j) % (grid - 1)) * grid + ((x0 + i) % (grid - 1))];
        const top = v(0, 0) + (v(1, 0) - v(0, 0)) * s(fx);
        const bot = v(0, 1) + (v(1, 1) - v(0, 1)) * s(fx);
        height[y * size + x] += (top + (bot - top) * s(fy)) * amp;
      }
  }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const h = height[i];
      // Цвет войлока --felt с лёгкой вариацией.
      color.set([237 - h * 40, 230 - h * 42, 218 - h * 46, 255], i * 4);
      const hx = height[y * size + ((x + 1) % size)] - h;
      const hy = height[((y + 1) % size) * size + x] - h;
      const nx = -hx * 6,
        ny = -hy * 6,
        nz = 1;
      const len = Math.hypot(nx, ny, nz);
      normal.set(
        [
          ((nx / len) * 0.5 + 0.5) * 255,
          ((ny / len) * 0.5 + 0.5) * 255,
          ((nz / len) * 0.5 + 0.5) * 255,
          255,
        ],
        i * 4,
      );
    }
  return { color: encodePng(size, size, color), normal: encodePng(size, size, normal) };
}

function ledTexture(w = 512, h = 256) {
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const t = x / w;
      // Спокойная «картинка» на экране: тёплый рассвет по горизонтали, сетка пикселей LED.
      const led = x % 4 < 3 && y % 4 < 3 ? 1 : 0.35;
      px.set([(40 + 180 * t) * led, (40 + 90 * t) * led, (70 - 30 * t) * led, 255], i);
    }
  return encodePng(w, h, px);
}

// ---------- Модели ----------

async function write(name, doc) {
  const io = new NodeIO();
  writeFileSync(new URL(`${name}.glb`, MODELS), await io.writeBinary(doc));
  console.log(`  assets-src/models/${name}.glb`);
}

async function yurt() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene("yurt");
  const root = doc.createNode("yurt");
  scene.addChild(root);

  const wood = doc
    .createMaterial("wood")
    .setBaseColorFactor([0.24, 0.14, 0.08, 1])
    .setRoughnessFactor(0.7);
  const felt = feltTextures();
  writeFileSync(new URL("kiiz_basecolor.png", TEXTURES), felt.color);
  writeFileSync(new URL("kiiz_normal.png", TEXTURES), felt.normal);
  const kiizMat = doc
    .createMaterial("kiiz")
    .setBaseColorTexture(
      doc
        .createTexture("kiiz_basecolor")
        .setImage(felt.color)
        .setMimeType("image/png")
        .setURI("kiiz_basecolor.png"),
    )
    .setNormalTexture(
      doc
        .createTexture("kiiz_normal")
        .setImage(felt.normal)
        .setMimeType("image/png")
        .setURI("kiiz_normal.png"),
    )
    .setRoughnessFactor(1);
  const doorMat = doc
    .createMaterial("esik")
    .setBaseColorFactor([0.42, 0.29, 0.2, 1])
    .setRoughnessFactor(0.6);

  const R = 3,
    WALL = 1.6,
    CROWN_Y = 3.1,
    CROWN_R = 0.6;

  // Кереге — решётчатые стены: косые рейки по кругу.
  const kerege = new MeshBuilder();
  const lattice = 72;
  for (let i = 0; i < lattice; i++) {
    const a = (i / lattice) * Math.PI * 2;
    const c = [Math.cos(a) * R, WALL / 2, Math.sin(a) * R];
    for (const tilt of [0.6, -0.6])
      kerege
        .box(c, [0.03, WALL * 1.15, 0.02], -a + Math.PI / 2, 0)
        .box(c, [0.03, WALL * 1.15, 0.02], -a + Math.PI / 2 + tilt * 0.001, tilt);
  }
  root.addChild(addMesh(doc, buffer, "kerege", kerege, wood));

  // Уықи — купольные жерди от стены к венцу.
  const uyki = new MeshBuilder();
  const poles = 48;
  for (let i = 0; i < poles; i++) {
    const a = (i / poles) * Math.PI * 2;
    const from = [Math.cos(a) * R, WALL, Math.sin(a) * R];
    const to = [Math.cos(a) * CROWN_R, CROWN_Y, Math.sin(a) * CROWN_R];
    const mid = from.map((v, k) => (v + to[k]) / 2);
    const len = Math.hypot(...from.map((v, k) => v - to[k]));
    const pitch = Math.atan2(R - CROWN_R, CROWN_Y - WALL);
    uyki.box(mid, [0.035, len, 0.035], -a + Math.PI / 2, -pitch);
  }
  root.addChild(addMesh(doc, buffer, "uyki", uyki, wood));

  // Шаңырақ — венец купола: кольцо.
  const shanyrak = new MeshBuilder().lathe(
    [
      [CROWN_R, CROWN_Y - 0.06],
      [CROWN_R + 0.08, CROWN_Y],
      [CROWN_R, CROWN_Y + 0.06],
      [CROWN_R - 0.08, CROWN_Y],
      [CROWN_R, CROWN_Y - 0.06],
    ],
    48,
  );
  root.addChild(addMesh(doc, buffer, "shanyrak", shanyrak, wood));

  // Кийиз — войлок поверх каркаса (стены и купол, с отверстием под шаңырақ).
  const kiiz = new MeshBuilder().lathe(
    [
      [R + 0.05, 0],
      [R + 0.05, WALL + 0.02],
      [CROWN_R + 0.1, CROWN_Y + 0.02],
    ],
    64,
  );
  root.addChild(addMesh(doc, buffer, "kiiz", kiiz, kiizMat));

  // Есік — дверь.
  const esik = new MeshBuilder().box([0, 0.8, R + 0.1], [0.9, 1.6, 0.08]);
  root.addChild(addMesh(doc, buffer, "esik", esik, doorMat));

  await write("yurt", doc);
}

async function dastarkhan() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene("dastarkhan");
  const root = doc.createNode("dastarkhan");
  scene.addChild(root);
  const cloth = doc
    .createMaterial("dastarkhan_cloth")
    .setBaseColorFactor([0.93, 0.9, 0.85, 1])
    .setRoughnessFactor(0.9);
  const wood = doc.createMaterial("dastarkhan_table").setBaseColorFactor([0.42, 0.29, 0.2, 1]);
  // Две половины дастархана — смыкаются в главе «День» (кудалык).
  root.addChild(
    addMesh(
      doc,
      buffer,
      "dastarkhan_left",
      new MeshBuilder().box([-1, 0.36, 0], [2, 0.04, 1.2]),
      cloth,
    ),
  );
  root.addChild(
    addMesh(
      doc,
      buffer,
      "dastarkhan_right",
      new MeshBuilder().box([1, 0.36, 0], [2, 0.04, 1.2]),
      cloth,
    ),
  );
  root.addChild(
    addMesh(
      doc,
      buffer,
      "dastarkhan_table",
      new MeshBuilder().box([0, 0.17, 0], [4.1, 0.34, 1.3]),
      wood,
    ),
  );
  await write("dastarkhan", doc);
}

async function ledWall() {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene("led_wall");
  const root = doc.createNode("led_wall");
  scene.addChild(root);
  const image = ledTexture();
  writeFileSync(new URL("led_screen_emissive.png", TEXTURES), image);
  const frame = doc.createMaterial("led_frame").setBaseColorFactor([0.05, 0.05, 0.06, 1]);
  const screen = doc
    .createMaterial("led_screen")
    .setBaseColorFactor([0, 0, 0, 1])
    .setEmissiveFactor([1, 1, 1])
    .setEmissiveTexture(
      doc
        .createTexture("led_screen_emissive")
        .setImage(image)
        .setMimeType("image/png")
        .setURI("led_screen_emissive.png"),
    );
  root.addChild(
    addMesh(
      doc,
      buffer,
      "led_frame",
      new MeshBuilder().box([0, 1.8, -0.06], [5.2, 3.0, 0.1]),
      frame,
    ),
  );
  const s = new MeshBuilder();
  s.quad([-2.5, 0.4, 0], [2.5, 0.4, 0], [2.5, 3.2, 0], [-2.5, 3.2, 0], [0, 0, 1]);
  root.addChild(addMesh(doc, buffer, "led_screen", s, screen));
  await write("led_wall", doc);
}

async function horse() {
  // Плоскость видеотекстуры коня: UV 0…1, пропорции кадра 16:9, низ плоскости — земля.
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene("horse");
  const root = doc.createNode("horse");
  scene.addChild(root);
  const mat = doc.createMaterial("horse_video");
  const plane = new MeshBuilder();
  const w = 4.8,
    h = 2.7;
  plane.quad([-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, h, 0], [-w / 2, h, 0], [0, 0, 1]);
  root.addChild(addMesh(doc, buffer, "horse_plane", plane, mat));
  await write("horse", doc);
}

console.log("Исходники 3D:");
await yurt();
await dastarkhan();
await ledWall();
await horse();

const noise = blueNoise(64);
writeFileSync(new URL("blue-noise-64.png", NOISE), encodePng(64, 64, noise, 1));
console.log("  public/assets/noise/blue-noise-64.png");
