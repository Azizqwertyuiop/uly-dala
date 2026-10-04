import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/*
 * Доставка (шаг 20, docs/deploy.md): ассеты с хешем содержимого в имени — кэш навсегда, правильный
 * MIME; файлы без хеша — с проверкой; страницы ссылаются на хешированные адреса; /api/health.
 * Проверяется сам релиз (.next/standalone), как на сервере.
 */

test("страница ссылается на ассеты с хешем; они отдаются immutable с верным MIME", async ({
  page,
  request,
}) => {
  await page.goto("/ru/fazenda");
  const src = await page.locator('img[src*="/assets/placeholders/"]').first().getAttribute("src");
  expect(src).toMatch(/^\/assets\/placeholders\/fazenda\.[0-9a-f]{10}\.svg$/);
  const img = await request.get(src!);
  expect(img.status()).toBe(200);
  expect(img.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");
});

test("MIME и кэш: модель, сплат, видео, звук, декодер, PDF", async ({ request, page }) => {
  await page.goto("/ru");
  const hashes = JSON.parse(readFileSync("src/lib/assets/hashes.json", "utf8")) as Record<
    string,
    string
  >;
  const hashed = (path: string) => {
    const dot = path.lastIndexOf(".");
    return `${path.slice(0, dot)}.${hashes[path]}${path.slice(dot)}`;
  };
  for (const [path, type] of [
    ["/assets/models/yurt.high.glb", "model/gltf-binary"],
    ["/assets/splats/fazenda.splat", "application/octet-stream"],
    ["/assets/video/fazenda-flyover.medium.mp4", "video/mp4"],
    ["/assets/video/horse-test.high.webm", "video/webm"],
    ["/assets/audio/wind.m4a", "audio/mp4"],
  ] as const) {
    const r = await request.head(hashed(path));
    expect(r.status(), path).toBe(200);
    expect(r.headers()["content-type"], path).toBe(type);
    expect(r.headers()["cache-control"], path).toContain("immutable");
  }
  for (const [path, type] of [
    ["/assets/decoders/basis/basis_transcoder.wasm", "application/wasm"],
    ["/assets/docs/uly-dala-presentation.pdf", "application/pdf"],
  ] as const) {
    const r = await request.head(path);
    expect(r.headers()["content-type"], path).toContain(type);
    expect(r.headers()["cache-control"], path).toContain("must-revalidate");
  }
  // Сборка Next.js — тоже с хешем и навсегда.
  const chunk = await page.locator('script[src^="/_next/static/"]').first().getAttribute("src");
  expect((await request.head(chunk!)).headers()["cache-control"]).toContain("immutable");
});

test("/api/health: релиз и база в порядке, без кэша", async ({ request }) => {
  const r = await request.get("/api/health");
  expect(r.status()).toBe(200);
  expect(r.headers()["cache-control"]).toBe("no-store");
  expect(await r.json()).toMatchObject({ status: "ok", release: expect.any(String) });
});
