import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import { ASSET_MIME, CACHE_IMMUTABLE, deliveryHeaders, deliveryRewrites } from "./delivery";

describe("доставка статики", () => {
  it("хешированные ассеты — immutable, остальные /assets — с проверкой", () => {
    const rules = deliveryHeaders();
    const hashed = rules.find((r) => r.source.includes("[0-9a-f]{10}"));
    expect(hashed?.headers).toEqual([{ key: "Cache-Control", value: CACHE_IMMUTABLE }]);
    expect(rules[0]!.headers[0]!.value).toContain("must-revalidate");
    // Хешированное правило — после общего: перекрывает его.
    expect(rules.indexOf(hashed!)).toBeGreaterThan(0);
    expect(deliveryRewrites()[0]!.destination).toBe("/assets/:base.:ext");
  });

  it("MIME для 3D, сплатов, видео и звука", () => {
    expect(ASSET_MIME).toMatchObject({
      glb: "model/gltf-binary",
      ktx2: "image/ktx2",
      splat: "application/octet-stream",
      wasm: "application/wasm",
      mp4: "video/mp4",
      webm: "video/webm",
      m4a: "audio/mp4",
    });
  });
});

describe("robots.txt превью", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("превью закрыто от поиска целиком, production — открыт", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_ENV", "preview");
    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
    vi.stubEnv("NEXT_PUBLIC_SITE_ENV", "");
    expect(robots().rules).toMatchObject({ allow: "/" });
  });
});
