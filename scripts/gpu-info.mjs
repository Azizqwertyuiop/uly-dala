/*
 * Какой видеоадаптер получает WebGL в headless Chromium (диагностика CI, .github/workflows/ci.yml).
 * «SwiftShader» / «llvmpipe» — без видеокарты (3D на процессоре); иначе — аппаратный.
 */
import { chromium } from "@playwright/test";

// Аргументы запуска — как в тестах (playwright.config.ts, E2E_GPU): node scripts/gpu-info.mjs --use-angle=metal
const browser = await chromium.launch({ args: process.argv.slice(2) });
const page = await browser.newPage();
const info = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl2");
  if (!gl) return { webgl2: false };
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  return {
    webgl2: true,
    vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
  };
});
await browser.close();
const software = /swiftshader|llvmpipe|software/i.test(String(info.renderer));
console.log(JSON.stringify(info));
console.log(software ? "WebGL: программный (без видеокарты)" : "WebGL: аппаратный");
