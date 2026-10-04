# Runbook

Эксплуатация сайта ULY DALA: как запустить, поменять содержимое, выложить, откатить и где смотреть
аналитику, ошибки и заявки. Устройство выкладки и первая настройка сервера — `docs/deploy.md`.

Любое изменение идёт одним путём: **ветка → pull request → превью → зелёный CI → мёрж в main →
автоматическая выкладка**. Напрямую в main не пушится (защита ветки).

## Запуск локально

Нужен Node.js 24 (`.nvmrc`).

```bash
npm ci
```

```bash
npm run dev
```

Сайт — http://localhost:3000/ru. Переменные — скопировать `.env.example` в `.env.local` (без него всё
работает: заявки пишутся в `.data/leads.sqlite`, уведомления не отправляются).

Production-сборка, как на сервере:

```bash
npm run build
```

```bash
PORT=3200 HOSTNAME=localhost npm run start
```

Все проверки, как в CI (≈ 10 мин):

```bash
npm run check
```

## Добавить кейс

1. Кадр-обложка (1600×1000, JPEG/WebP, ≤ 300 КБ) → `public/assets/cases/<slug>.jpg`.
   Разрешение клиента на публикацию — до добавления (CLAUDE.md, раздел 17).
2. В `src/content/cases/index.ts` добавить объект в массив `cases`: `slug` (латиница, через дефис),
   `format` (один из шести), `cover: { src: assetUrl("/assets/cases/<slug>.jpg"), width, height }`,
   `placeholder: false`, тексты `ru` и `en` (title, summary, task, solution, result, coverAlt).
   `kk` — только от копирайтера (TODO(kk-copywriter)); без него показывается русский.
3. В `e2e/pages.ts` добавить slug в `caseSlugs` (страница попадёт в проверки доступности и SEO).
4. `npm run assets:hash` → PR. Страница `/<язык>/cases/<slug>`, карта сайта, hreflang и JSON-LD
   появятся сами. Цифры — только подтверждённые (TODO(client-data)).

## Заменить ассет (модель, видео, звук, картинку)

Имена файлов — контракт с кодом: новый файл кладётся **под тем же именем**.

- **Модели** (`.glb`): исходник → `assets-src/models/<имя>.glb`, затем `npm run assets`
  (сжатие, KTX2, варианты high/medium). Требования к моделям — `docs/assets.md`.
- **Видео, звук, картинки, сплаты**: заменить файл в `public/assets/…`.
- Затем обязательно:

```bash
npm run assets:hash
```

Хеш в имени изменится — браузеры и CDN получат новый файл сразу, старый кэш не мешает.
CI проверит бюджеты: глава «Рассвет» ≤ 2,5 МБ, остальные ≤ 4 МБ (`src/canvas/assets.test.ts`,
`e2e/budgets.spec.ts`). Превышение — CI красный, мёрж невозможен: облегчить файл.

## Обновить тексты

- Все тексты интерфейса и глав — `src/content/messages/ru.ts` (базовый), `en.ts` (черновик,
  TODO(en-review)), `kk.ts` (только копирайтер-носитель, машинный перевод запрещён).
  Ключи в `en.ts` — те же и в том же порядке, что в `ru.ts` (проверяет тест).
- Форматы — `messages.*.formats`, кейсы — `src/content/cases/index.ts`, контакты —
  переменные `NEXT_PUBLIC_WHATSAPP_PHONE`, `NEXT_PUBLIC_PHONE` (GitHub → Environments → production).
- Типографика (кавычки, неразрывные пробелы) — автоматически, `src/lib/typography.ts`.
  Крупные заголовки переносятся вручную — проверить на превью в трёх ширинах (телефон, планшет, десктоп).
- Подробнее — `docs/content.md`.

## Выкладка и откат

- **Выкладка** — сама после мёржа в main (Actions → Deploy). Вручную: Actions → Deploy → Run workflow.
- **Откат** — Actions → **Rollback** → Run workflow (пусто — на предыдущий релиз, доли секунды).
  Или по SSH: `ssh uly-dala@<IP> /srv/uly-dala/bin/rollback.sh` (`--list` — список релизов).
- **Какой релиз работает:** `https://<домен>/api/health` → `release` (первые 12 символов коммита).
- Журнал выкладок на сервере: `/srv/uly-dala/deploys.log`.

## Где смотреть

### Заявки

- **Менеджерам** приходят в Telegram и на почту сразу после отправки.
- **База** — на сервере в РК: `/var/lib/uly-dala/leads.sqlite` (копии — `/var/backups/uly-dala/`):

```bash
ssh uly-dala@<IP> sqlite3 /var/lib/uly-dala/leads.sqlite "select created_at, source, name, phone from leads order by created_at desc limit 20"
```

- Попытки уведомлений — таблица `notifications`, алерты — `alerts`.
- Если в `alerts` есть `notify-all-failed` или `notify-not-configured` — менеджеры заявку не получили:
  найти её по `lead_id` в `leads`, передать вручную, проверить токены Telegram / SMTP
  в `/etc/uly-dala/production.env`, затем без простоя: `/srv/uly-dala/bin/restart.sh`.
- Порядок обработки (CLAUDE.md, раздел 9): валидация → honeypot → лимит по IP → запись в базу →
  ответ → уведомления в фоне (3 попытки) → алерт. Код — `src/server/leads/`.
- Персональные данные не выносить с сервера; выгрузки — только по решению заказчика.

### Аналитика

Строки `"scope":"analytics"` в журнале сервера — события без персональных данных
(список — `docs/analytics.md`):

```bash
ssh uly-dala@<IP> "journalctl -u 'uly-dala@*' --since today -o cat | grep '\"scope\":\"analytics\"'"
```

Для отчётов — подключить сборщик журналов (Grafana Loki, Yandex Cloud Logging и т. п.) к journald —
TODO(client-data): выбор системы. В браузере: `window.__events`, с `?debug` — в консоли.

### Ошибки

- Журнал сервера: строки `"level":"error"` — `"scope":"frontend"` (браузер; `tag: webgl` — потеря
  контекста, сбой шейдера), `"server"`, `"csp"`, `"leads"`:

```bash
ssh uly-dala@<IP> "journalctl -u 'uly-dala@*' -p err --since '1 hour ago' -o cat"
```

- Sentry — если задан `SENTRY_DSN` в `/etc/uly-dala/production.env`.
- Журнал Caddy (без IP и query): `/var/log/caddy/uly-dala.log`. Подробнее — `docs/security.md`.

## Если что-то сломалось

| Симптом                                     | Что делать                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Сайт не открывается / ошибки после выкладки | Откат (Actions → Rollback), затем разбираться в PR                                                         |
| Сертификат HTTPS                            | `sudo journalctl -u caddy --since today` — обычно DNS не указывает на сервер                               |
| Не приходят заявки менеджерам               | таблица `alerts` (выше), токены в `production.env`                                                         |
| Закончилось место                           | `df -h`; старые релизы чистятся сами (последние 5), копии базы — 30 дней                                   |
| Выкладка упала на «/api/health»             | релиз не переключён, сайт работает на прежнем; смотреть журнал слота: `journalctl -u uly-dala@3002 -n 100` |
