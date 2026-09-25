import { brotliDecompressSync } from "node:zlib";

/*
 * Минимальный разбор WOFF2: достаём таблицу cmap и возвращаем множество кодов символов,
 * для которых в шрифте есть глиф. Спецификация: https://www.w3.org/TR/WOFF2/
 * cmap в WOFF2 никогда не трансформируется, поэтому её можно читать как есть.
 */

const KNOWN_TAGS = [
  "cmap",
  "head",
  "hhea",
  "hmtx",
  "maxp",
  "name",
  "OS/2",
  "post",
  "cvt ",
  "fpgm",
  "glyf",
  "loca",
  "prep",
  "CFF ",
  "VORG",
  "EBDT",
  "EBLC",
  "gasp",
  "hdmx",
  "kern",
  "LTSH",
  "PCLT",
  "VDMX",
  "vhea",
  "vmtx",
  "BASE",
  "GDEF",
  "GPOS",
  "GSUB",
  "EBSC",
  "JSTF",
  "MATH",
  "CBDT",
  "CBLC",
  "COLR",
  "CPAL",
  "SVG ",
  "sbix",
  "acnt",
  "avar",
  "bdat",
  "bloc",
  "bsln",
  "cvar",
  "fdsc",
  "feat",
  "fmtx",
  "fvar",
  "gvar",
  "hsty",
  "just",
  "lcar",
  "mort",
  "morx",
  "opbd",
  "prop",
  "trak",
  "Zapf",
  "Silf",
  "Glat",
  "Gloc",
  "Feat",
  "Sill",
];

function readBase128(view: DataView, offset: number): [value: number, next: number] {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = view.getUint8(offset + i);
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return [value, offset + i + 1];
  }
  throw new Error("WOFF2: некорректный UIntBase128");
}

function extractCmap(woff2: Uint8Array): DataView {
  const view = new DataView(woff2.buffer, woff2.byteOffset, woff2.byteLength);
  if (view.getUint32(0) !== 0x774f4632) throw new Error("Это не WOFF2");
  const numTables = view.getUint16(12);
  const compressedSize = view.getUint32(20);

  let offset = 48;
  let tableOffset = 0;
  let cmap: { offset: number; length: number } | undefined;

  for (let i = 0; i < numTables; i++) {
    const flags = view.getUint8(offset++);
    const tagIndex = flags & 0x3f;
    const transform = flags >> 6;
    let tag = KNOWN_TAGS[tagIndex];
    if (tagIndex === 63) {
      tag = String.fromCharCode(...woff2.subarray(offset, offset + 4));
      offset += 4;
    }
    let origLength: number;
    [origLength, offset] = readBase128(view, offset);
    let length = origLength;
    const transformed = tag === "glyf" || tag === "loca" ? transform === 0 : transform !== 0;
    if (transformed) [length, offset] = readBase128(view, offset);

    if (tag === "cmap") cmap = { offset: tableOffset, length };
    tableOffset += length;
  }
  if (!cmap) throw new Error("WOFF2: нет таблицы cmap");

  const tables = brotliDecompressSync(woff2.subarray(offset, offset + compressedSize));
  return new DataView(tables.buffer, tables.byteOffset + cmap.offset, cmap.length);
}

export function woff2Codepoints(woff2: Uint8Array): Set<number> {
  const cmap = extractCmap(woff2);
  const codepoints = new Set<number>();
  const numSubtables = cmap.getUint16(2);

  for (let i = 0; i < numSubtables; i++) {
    const platform = cmap.getUint16(4 + i * 8);
    const encoding = cmap.getUint16(6 + i * 8);
    const sub = cmap.getUint32(8 + i * 8);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;

    const format = cmap.getUint16(sub);
    if (format === 4) {
      const segX2 = cmap.getUint16(sub + 6);
      const ends = sub + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const rangeOffsets = deltas + segX2;
      for (let s = 0; s < segX2; s += 2) {
        const end = cmap.getUint16(ends + s);
        const start = cmap.getUint16(starts + s);
        const delta = cmap.getInt16(deltas + s);
        const rangeOffset = cmap.getUint16(rangeOffsets + s);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let glyph: number;
          if (rangeOffset === 0) {
            glyph = (c + delta) & 0xffff;
          } else {
            const at = rangeOffsets + s + rangeOffset + (c - start) * 2;
            glyph = cmap.getUint16(at);
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph !== 0) codepoints.add(c);
        }
      }
    } else if (format === 12) {
      const groups = cmap.getUint32(sub + 12);
      for (let g = 0; g < groups; g++) {
        const base = sub + 16 + g * 12;
        const start = cmap.getUint32(base);
        const end = cmap.getUint32(base + 4);
        const startGlyph = cmap.getUint32(base + 8);
        for (let c = start; c <= end; c++) if (startGlyph + (c - start) !== 0) codepoints.add(c);
      }
    }
  }
  return codepoints;
}

/** Разбор CSS unicode-range: "U+0460-052F, U+1C80-1C8A, U+20B4" → проверка вхождения. */
export function inUnicodeRange(range: string, codepoint: number): boolean {
  if (!range.trim()) return true;
  return range.split(",").some((part) => {
    const [from, to] = part.trim().replace(/^U\+/i, "").split("-");
    if (!from) return false;
    if (from.includes("?")) {
      const lo = parseInt(from.replace(/\?/g, "0"), 16);
      const hi = parseInt(from.replace(/\?/g, "F"), 16);
      return codepoint >= lo && codepoint <= hi;
    }
    const lo = parseInt(from, 16);
    const hi = to ? parseInt(to, 16) : lo;
    return codepoint >= lo && codepoint <= hi;
  });
}
