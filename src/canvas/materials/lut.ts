import { Data3DTexture, FloatType, LinearFilter, RGBAFormat, ClampToEdgeWrapping } from "three";

/*
 * Слот под единую LUT (CLAUDE.md, раздел 6: «одна LUT на всю сцену, включая фазенду и реальные кадры»).
 * По умолчанию — тождественная LUT (ничего не меняет). Колорист отдаёт файл .cube — см. docs/assets.md.
 */

function lutTexture(size: number, data: Float32Array) {
  const texture = new Data3DTexture(data, size, size, size);
  texture.format = RGBAFormat;
  texture.type = FloatType;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

export function identityLut(size = 2): Data3DTexture {
  const data = new Float32Array(size * size * size * 4);
  let i = 0;
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        data.set([r / (size - 1), g / (size - 1), b / (size - 1), 1], i);
        i += 4;
      }
  return lutTexture(size, data);
}

/** Разбор Adobe/Resolve .cube (LUT_3D_SIZE, строки «r g b», красный меняется быстрее всех). */
export function parseCubeLut(text: string): Data3DTexture {
  let size = 0;
  const values: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const sizeMatch = /^LUT_3D_SIZE\s+(\d+)/.exec(line);
    if (sizeMatch) {
      size = Number(sizeMatch[1]);
      continue;
    }
    if (/^[A-Z_]/.test(line)) continue; // TITLE, DOMAIN_MIN/MAX
    const [r, g, b] = line.split(/\s+/).map(Number);
    if ([r, g, b].every(Number.isFinite)) values.push(r!, g!, b!, 1);
  }
  if (!size || values.length !== size ** 3 * 4) throw new Error("Некорректный .cube");
  return lutTexture(size, new Float32Array(values));
}
