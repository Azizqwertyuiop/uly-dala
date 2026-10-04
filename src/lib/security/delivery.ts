/*
 * Доставка статики (шаг 20; CLAUDE.md, раздел 12): кэш и MIME.
 * Общие значения для next.config.ts (локально, e2e, запасной путь) и deploy/Caddyfile (production).
 * Без импортов с алиасами: файл читает next.config.ts.
 *
 * - Ассеты с хешем содержимого в имени (scripts/hash-assets.mjs) и /_next/static —
 *   «навсегда» (immutable): новое содержимое = новое имя, CDN и браузер не перепроверяют.
 * - Ассеты без хеша (decoders/, docs/) — каждый раз проверяются (ETag → 304).
 * - MIME: в стандартных таблицах нет .ktx2, .glb, сплатов — задаём явно.
 */

export const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";
export const CACHE_REVALIDATE = "public, max-age=0, must-revalidate";

/** Расширение → Content-Type для ассетов 3D, видео и звука. */
export const ASSET_MIME: Record<string, string> = {
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  ktx2: "image/ktx2",
  splat: "application/octet-stream",
  spz: "application/octet-stream",
  ply: "application/octet-stream",
  wasm: "application/wasm",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4a: "audio/mp4",
};

/** Путь с хешем: …/name.<10 hex>.ext */
export const HASHED_SOURCE = "/assets/:base(.+)\\.:hash([0-9a-f]{10})\\.:ext([a-z0-9]+)";

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };

export function deliveryHeaders(): Rule[] {
  return [
    { source: "/assets/:path*", headers: [{ key: "Cache-Control", value: CACHE_REVALIDATE }] },
    // Позже — сильнее: у хешированных путей immutable перекрывает правило выше.
    { source: HASHED_SOURCE, headers: [{ key: "Cache-Control", value: CACHE_IMMUTABLE }] },
    ...Object.entries(ASSET_MIME).map(([ext, type]) => ({
      source: `/assets/:file(.+\\.${ext})`,
      headers: [{ key: "Content-Type", value: type }],
    })),
  ];
}

/** Хешированное имя → файл в public/ (на сервере то же делает Caddy из общего хранилища). */
export function deliveryRewrites() {
  return [{ source: HASHED_SOURCE, destination: "/assets/:base.:ext" }];
}
