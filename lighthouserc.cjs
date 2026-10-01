/*
 * Lighthouse CI (CLAUDE.md, раздел 12) — на каждый PR (.github/workflows/ci.yml).
 * Мобильный профиль Lighthouse: эмуляция телефона, медленный 4G, CPU ×4 — настоящим замедлением
 * (throttlingMethod: devtools). Модель Lantern на локальном сервере завышает LCP в 3–4 раза:
 * наблюдаемый LCP = FCP ≈ 0,1 с, «смоделированный» — 3,7 с (всё, что успело скачаться до первой
 * отрисовки на быстром localhost, модель считает её условием).
 * Пороги (ошибка): LCP ≤ 2,5 с, CLS ≤ 0,05, вес первой загрузки ≤ 3 МБ; доступность ≥ 0,95,
 * SEO = 1, лучшие практики = 1. TBT > 200 мс — предупреждение: в окно TBT попадает запуск 3D
 * в простое после load; порог раздела 12 — INP ≤ 200 мс, его держит e2e/perf.spec.ts
 * (нажатия во время запуска 3D на CPU ×4 — 80–112 мс).
 * Отчёты — локально (.lighthouseci/), наружу ничего не отправляется.
 * Chrome — тот же, что у Playwright (CHROME_PATH задаёт CI или scripts/lhci.mjs).
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start -- --port 3300",
      startServerReadyPattern: "Ready",
      url: [
        "http://localhost:3300/ru",
        "http://localhost:3300/ru/fazenda",
        "http://localhost:3300/ru/cases/kudalyk-two-families",
        "http://localhost:3300/ru/services/conference",
        "http://localhost:3300/en/services/wedding",
        "http://localhost:3300/kk/services/kudalyk",
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: "--headless=new --no-sandbox",
        throttlingMethod: "devtools",
        // 3D догружается в простое после load — в лабораторный замер первой загрузки не входит.
        skipAudits: ["bf-cache"],
      },
    },
    assert: {
      assertions: {
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:seo": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 1 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.05 }],
        "total-blocking-time": ["warn", { maxNumericValue: 200 }],
        "total-byte-weight": ["error", { maxNumericValue: 3 * 1024 * 1024 }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
