/*
 * Минимальная запись WebM с VP9 + альфой (одна видеодорожка).
 * Альфа VP9 в WebM — отдельный VP9-поток (канал альфы как яркость) в BlockAdditions
 * (BlockAddID = 1), у дорожки AlphaMode = 1. Так её читают Chrome и Firefox.
 */

const ID = {
  EBML: 0x1a45dfa3,
  EBMLVersion: 0x4286,
  EBMLReadVersion: 0x42f7,
  EBMLMaxIDLength: 0x42f2,
  EBMLMaxSizeLength: 0x42f3,
  DocType: 0x4282,
  DocTypeVersion: 0x4287,
  DocTypeReadVersion: 0x4285,
  Segment: 0x18538067,
  Info: 0x1549a966,
  TimecodeScale: 0x2ad7b1,
  Duration: 0x4489,
  MuxingApp: 0x4d80,
  WritingApp: 0x5741,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  TrackNumber: 0xd7,
  TrackUID: 0x73c5,
  TrackType: 0x83,
  CodecID: 0x86,
  Video: 0xe0,
  PixelWidth: 0xb0,
  PixelHeight: 0xba,
  AlphaMode: 0x53c0,
  DefaultDuration: 0x23e383,
  Cluster: 0x1f43b675,
  Timecode: 0xe7,
  BlockGroup: 0xa0,
  Block: 0xa1,
  ReferenceBlock: 0xfb,
  BlockAdditions: 0x75a1,
  BlockMore: 0xa6,
  BlockAddID: 0xee,
  BlockAdditional: 0xa5,
};

const idBytes = (id) => {
  const out = [];
  for (let v = id; v > 0; v = Math.floor(v / 256)) out.unshift(v & 0xff);
  return Buffer.from(out);
};

function sizeBytes(n) {
  for (let len = 1; len <= 8; len++) {
    if (n < 2 ** (7 * len) - 1) {
      const b = Buffer.alloc(len);
      let v = n;
      for (let i = len - 1; i >= 0; i--) {
        b[i] = v & 0xff;
        v = Math.floor(v / 256);
      }
      b[0] |= 1 << (8 - len);
      return b;
    }
  }
  throw new Error("EBML: слишком большой элемент");
}

const el = (id, data) => Buffer.concat([idBytes(id), sizeBytes(data.length), data]);
const master = (id, children) => el(id, Buffer.concat(children));
const uint = (id, value) => {
  const out = [];
  for (let v = value; v > 0 || out.length === 0; v = Math.floor(v / 256)) out.unshift(v & 0xff);
  return el(id, Buffer.from(out));
};
const float = (id, value) => {
  const b = Buffer.alloc(8);
  b.writeDoubleBE(value);
  return el(id, b);
};
const str = (id, value) => el(id, Buffer.from(value, "utf8"));

/**
 * frames: [{ timestampUs, key, color: Uint8Array, alpha: Uint8Array }]
 * Возвращает Buffer готового .webm.
 */
export function writeVp9AlphaWebm({ width, height, fps, frames }) {
  const header = master(ID.EBML, [
    uint(ID.EBMLVersion, 1),
    uint(ID.EBMLReadVersion, 1),
    uint(ID.EBMLMaxIDLength, 4),
    uint(ID.EBMLMaxSizeLength, 8),
    str(ID.DocType, "webm"),
    uint(ID.DocTypeVersion, 4),
    uint(ID.DocTypeReadVersion, 2),
  ]);
  const durationMs = frames.length ? frames.at(-1).timestampUs / 1000 + 1000 / fps : 0;
  const info = master(ID.Info, [
    uint(ID.TimecodeScale, 1_000_000),
    float(ID.Duration, durationMs),
    str(ID.MuxingApp, "uly-dala webm-alpha"),
    str(ID.WritingApp, "uly-dala make-test-video"),
  ]);
  const tracks = master(ID.Tracks, [
    master(ID.TrackEntry, [
      uint(ID.TrackNumber, 1),
      uint(ID.TrackUID, 1),
      uint(ID.TrackType, 1),
      str(ID.CodecID, "V_VP9"),
      uint(ID.DefaultDuration, Math.round(1e9 / fps)),
      master(ID.Video, [
        uint(ID.PixelWidth, width),
        uint(ID.PixelHeight, height),
        uint(ID.AlphaMode, 1),
      ]),
    ]),
  ]);

  // Кластер на каждый ключевой кадр.
  const clusters = [];
  let current = null;
  let lastTimecode = 0;
  for (const frame of frames) {
    const ms = Math.round(frame.timestampUs / 1000);
    if (frame.key || !current) {
      if (current) clusters.push(master(ID.Cluster, current.children));
      current = { start: ms, children: [uint(ID.Timecode, ms)] };
    }
    const rel = ms - current.start;
    const prelude = Buffer.alloc(4);
    prelude[0] = 0x81; // номер дорожки 1
    prelude.writeInt16BE(rel, 1);
    prelude[3] = 0;
    const group = [el(ID.Block, Buffer.concat([prelude, Buffer.from(frame.color)]))];
    if (!frame.key) {
      // Ссылка на предыдущий кадр (относительный таймкод) — признак межкадрового блока.
      const ref = lastTimecode - ms;
      const b = Buffer.alloc(2);
      b.writeInt16BE(ref);
      group.push(el(ID.ReferenceBlock, b));
    }
    group.push(
      master(ID.BlockAdditions, [
        master(ID.BlockMore, [
          uint(ID.BlockAddID, 1),
          el(ID.BlockAdditional, Buffer.from(frame.alpha)),
        ]),
      ]),
    );
    current.children.push(master(ID.BlockGroup, group));
    lastTimecode = ms;
  }
  if (current) clusters.push(master(ID.Cluster, current.children));

  return Buffer.concat([header, master(ID.Segment, [info, tracks, ...clusters])]);
}
