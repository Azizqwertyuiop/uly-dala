import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Отключает правила оформления, которые конфликтуют с Prettier. Должен идти последним.
  prettier,
  {
    // Граф сцены three.js мутабелен по природе (R3F: объекты создаются один раз и меняются
    // в каждом кадре). Правило React Compiler про неизменяемость здесь неприменимо.
    files: ["src/canvas/**/*.tsx"],
    rules: { "react-hooks/immutability": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
    // Сторонний транскодер KTX2 (копия из three/examples, см. scripts/optimize-assets.mjs).
    "public/assets/decoders/**",
  ]),
]);

export default eslintConfig;
