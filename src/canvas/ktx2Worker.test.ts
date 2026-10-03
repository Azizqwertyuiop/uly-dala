import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error — скрипт сборки ассетов на JS без типов.
import { KTX2_WORKER_FILE, ktx2WorkerSource } from "../../scripts/ktx2-worker.mjs";

describe("воркер KTX2 файлом (CSP)", () => {
  it("совпадает с тем, что собирает KTX2Loader текущей версии three", () => {
    // Не совпал — обновился three: запустить `node scripts/ktx2-worker.mjs`.
    expect(readFileSync(KTX2_WORKER_FILE, "utf8")).toBe(ktx2WorkerSource());
  });
});
