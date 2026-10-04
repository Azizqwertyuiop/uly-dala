import hashes from "./hashes.json";

/*
 * Адрес ассета с хешем содержимого в имени (scripts/hash-assets.mjs):
 * /assets/models/yurt.high.glb → /assets/models/yurt.high.12c9289157.glb.
 * Такой адрес кэшируется навсегда (Cache-Control: immutable): заменили файл — изменилось имя.
 * Сервер отдаёт файл по хешированному имени (next.config.ts — rewrite, на сервере — Caddy).
 * Файлы без хеша (decoders/, docs/) возвращаются как есть.
 */

const table = hashes as Record<string, string>;

/** Хеш в имени: последний сегмент «.<10 hex>» перед расширением. */
export const HASHED_ASSET = /^(\/assets\/.+)\.([0-9a-f]{10})(\.[a-z0-9]+)$/;

export function assetUrl(path: string): string {
  const hash = table[path];
  if (!hash) return path;
  const dot = path.lastIndexOf(".");
  return `${path.slice(0, dot)}.${hash}${path.slice(dot)}`;
}

/** Обратно: хешированный адрес → путь файла в public/ (для тестов и бюджетов). */
export function unhashedPath(url: string): string {
  const m = HASHED_ASSET.exec(url);
  return m ? `${m[1]}${m[3]}` : url;
}
