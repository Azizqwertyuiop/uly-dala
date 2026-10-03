/*
 * Заголовки безопасности (CLAUDE.md, раздел 14). Подключаются в next.config.ts ко всем адресам.
 *
 * CSP — всё своё ('self'), сторонних источников у сайта нет. Исключения и почему:
 * - script-src 'unsafe-inline': статичные страницы (SSG) несут встроенные скрипты Next.js
 *   (данные RSC) и наши скрипты в <head> до первой отрисовки. Nonce требует рендера на каждый
 *   запрос — это отключило бы статическую отдачу (и LCP). Пользовательского HTML на сайте нет.
 * - 'wasm-unsafe-eval': WebAssembly декодеров — Basis (KTX2), meshopt, Spark (сплаты фазенды).
 * - worker-src blob: data:: воркеры KTX2/meshopt создаются из blob:, воркер Spark — из data:.
 * - media-src/img-src/connect-src blob: data:: видео и текстуры из памяти, встроенные данные моделей.
 * - style-src 'unsafe-inline': стили React (style={…}) и next/font.
 * В разработке (next dev) дополнительно 'unsafe-eval' и ws: — их требует горячая перезагрузка.
 */

// Тот же адрес, что в src/lib/analytics/events.ts (проверяется тестом). Без импорта:
// файл читает next.config.ts, там нет алиасов путей.
export const CSP_REPORT_ENDPOINT = "/api/csp";

export type SecurityOptions = { dev: boolean; https: boolean };

export function contentSecurityPolicy({ dev, https }: SecurityOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      "'wasm-unsafe-eval'",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "media-src": ["'self'", "blob:", "data:"],
    "connect-src": ["'self'", "blob:", "data:", ...(dev ? ["ws:"] : [])],
    "worker-src": ["'self'", "blob:", "data:"],
    // Старые Safari берут воркеры из child-src.
    "child-src": ["'self'", "blob:", "data:"],
    "manifest-src": ["'self'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "report-uri": [CSP_REPORT_ENDPOINT],
    "report-to": ["csp"],
  };
  const list = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (https) list.push("upgrade-insecure-requests");
  return list.join("; ");
}

/** Воркер KTX2 (scripts/ktx2-worker.mjs) — единственное место, где разрешён eval. */
export const KTX2_WORKER_PATH = "/assets/decoders/basis/ktx2-worker.js";

/*
 * CSP самого воркера: у воркера, загруженного по адресу, своя политика из его ответа.
 * Ему нужны только eval (embind транскодера) и WebAssembly; сеть и всё остальное — запрещены
 * (wasm приходит сообщением от страницы).
 */
export const KTX2_WORKER_CSP =
  "default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; frame-ancestors 'none'";

export function securityHeaders(opts: SecurityOptions): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(opts) },
    { key: "Reporting-Endpoints", value: `csp="${CSP_REPORT_ENDPOINT}"` },
    // HSTS действует только по https. includeSubDomains/preload — после решения о домене заказчика
    // (затронут все его поддомены). TODO(client-data): домен.
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: [
        "camera=()",
        "microphone=()",
        "geolocation=()",
        "payment=()",
        "usb=()",
        "serial=()",
        "hid=()",
        "bluetooth=()",
        "accelerometer=()",
        "gyroscope=()",
        "magnetometer=()",
        "browsing-topics=()",
      ].join(", "),
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // Для старых браузеров без frame-ancestors.
    { key: "X-Frame-Options", value: "DENY" },
  ];
}
