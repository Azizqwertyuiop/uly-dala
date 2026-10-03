# Безопасность и мониторинг (CLAUDE.md, раздел 14)

## Заголовки

Задаются в `next.config.ts` (значения — `src/lib/security/headers.ts`) на все адреса.

| Заголовок                  | Значение                                                        |
| -------------------------- | --------------------------------------------------------------- |
| Content-Security-Policy    | всё своё (`'self'`), исключения ниже; отчёты — `/api/csp`       |
| Strict-Transport-Security  | `max-age=31536000` (действует только по https)                  |
| X-Content-Type-Options     | `nosniff`                                                       |
| Referrer-Policy            | `strict-origin-when-cross-origin`                               |
| Permissions-Policy         | камера, микрофон, геолокация, платежи, USB, датчики — запрещены |
| Cross-Origin-Opener-Policy | `same-origin`                                                   |
| X-Frame-Options            | `DENY` (и `frame-ancestors 'none'` в CSP)                       |

TODO(client-data): после выбора домена — решить про `includeSubDomains` и `preload` в HSTS
(они затронут все поддомены заказчика).

### Исключения в CSP и почему

- `script-src 'unsafe-inline'` — статичные страницы несут встроенные скрипты Next.js и наши скрипты
  в `<head>` (до первой отрисовки). Nonce требует рендера на каждый запрос — это убило бы статическую
  отдачу и LCP. Пользовательского HTML на сайте нет, React экранирует вывод.
- `'wasm-unsafe-eval'` — WebAssembly декодеров: Basis (KTX2), meshopt, Spark (сплаты фазенды).
- `worker-src blob: data:` — воркеры meshopt (blob:) и Spark (data:).
- `img-src`, `media-src`, `connect-src` с `blob: data:` — текстуры и видео из памяти, встроенные данные моделей.
- `style-src 'unsafe-inline'` — стили React и next/font.
- В `next dev` добавляются `'unsafe-eval'` и `ws:` (горячая перезагрузка), в production их нет.

### Воркер KTX2 — отдельный файл со своей CSP

Транскодер Basis (three.js) создаёт функции через `new Function` — это `'unsafe-eval'`.
Разрешать eval всей странице не стали. Воркер лежит файлом
`public/assets/decoders/basis/ktx2-worker.js` (генерирует `npm run assets:ktx2-worker`)
и отдаётся со своей политикой: `default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'` —
eval есть только внутри воркера, а сеть ему запрещена (wasm он получает сообщением от страницы).
**После обновления three** тест `src/canvas/ktx2Worker.test.ts` упадёт, если воркер устарел, —
перегенерировать: `npm run assets:ktx2-worker`.

### Проверено (2 октября 2026)

Прогон всех глав в Chromium с включённой CSP — 0 нарушений, 0 ошибок:
high (шейдеры всех сцен, текстуры KTX2, meshopt, сплаты Spark, видео коня), medium (видео облёта),
fallback (видео-секвенции по скроллу, телефон), звук (Web Audio), внутренние страницы, 404.
Автотест: `e2e/telemetry.spec.ts` («CSP не ломает 3D»).
**Нужно руками до запуска:** Safari (macOS и iOS) и Firefox — пройти главную до конца с открытой
консолью; нарушения CSP видны там и приходят в мониторинг (`scope: csp`).

## Мониторинг ошибок

- **Фронт:** необработанные ошибки, отказы промисов, нарушения CSP → `POST /api/m`.
  Тег `webgl`: `context_lost` (потеря контекста), `fallback` (не восстановился за 3 с),
  `shader_link` (шейдер не собрался; проверка после компиляции в простое — в продакшене
  `checkShaderErrors` выключен ради скорости). При сбое шейдера — fallback без перезагрузки.
- **Сервер:** `src/instrumentation.ts` (`onRequestError`) — ошибки рендера, Server Actions, API.
- **Заявки:** алерт «уведомления не доставлены» — в базу, лог, вебхук и Sentry.
- **Куда:** строка JSON в журнал сервера (`"scope":"frontend" | "server" | "csp" | "leads"`);
  если задан `SENTRY_DSN` — ещё и в Sentry (без SDK: один HTTP-запрос, клиентский бандл не растёт).
- Без персональных данных: из сообщений и стеков вырезаются query, email, номера; IP и cookie не пишутся.

Эмуляция в автотестах (`e2e/telemetry.spec.ts`): `WEBGL_lose_context` и «несобирающийся» шейдер →
fallback + событие `webgl` на `/api/m`.

## Аудит зависимостей

CI (`.github/workflows/ci.yml`, задача `audit`) — на каждый push, PR и раз в неделю:

- `npm audit --omit=dev --audit-level=high` — рабочие зависимости (сайт и сервер); сейчас 0 уязвимостей;
- `npm audit --audit-level=critical` — все, включая инструменты;
- `npm audit signatures` — подписи пакетов реестра.

Известное: у `@lhci/cli` (Lighthouse CI, только для проверок в CI) high-уязвимости в зависимостях
(`basic-ftp`, `tmp`, `uuid`…) без исправления от авторов. На сайт этот код не попадает.
Локально: `npm run audit:deps`.
