import { createHash } from "node:crypto";

/*
 * Ограничение частоты для телеметрии: в памяти процесса, по хэшу IP (IP не хранится).
 * Защищает журнал от заливки; при нескольких экземплярах сервера лимит — на каждый.
 */

export function createLimiter(opts: { max: number; windowMs: number; salt: string }) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (ip: string, now = Date.now()): boolean => {
    const key = createHash("sha256").update(`${opts.salt}:${ip}`).digest("base64url").slice(0, 16);
    const entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
      hits.set(key, { count: 1, reset: now + opts.windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= opts.max;
  };
}
