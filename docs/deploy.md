# Выкладка: production, превью, откат (шаг 20; CLAUDE.md, разделы 12, 14)

## Решение

**Сайт и база заявок — на своём сервере в Казахстане** (решение заказчика, 4 октября 2026;
CLAUDE.md, раздел 7 — «Vercel или по решению»). Причины:

- закон РК «О персональных данных и их защите» — заявки (имя, телефон) хранятся на территории РК;
- домен `.kz` по правилам регистратора должен указывать на сервер в Казахстане;
- посетители в Казахстане: задержка до сервера в Алматы ~50 мс против ~125 мс до Европы (замер ниже).

TODO(legal): юрист подтверждает, что сервер у выбранного провайдера в РК удовлетворяет закону
(и нужна ли вторая площадка для резервных копий).

## Как устроено

```
GitHub ──(push в main, CI зелёный)──► Actions: сборка релиза ──SSH──► сервер в РК
                                                                    │
  посетитель ──HTTPS──► Caddy ─┬─ /_next/static, /assets/*.<хеш>.* → /srv/uly-dala/cdn (immutable)
                               └─ всё остальное → слот 3001 или 3002 (node server.js)
                                                   └─ база заявок /var/lib/uly-dala/leads.sqlite
```

- **Релиз** — папка `.next/standalone` после `npm run build` (сервер Next.js без node_modules,
  статика, `cdn/`, файл `RELEASE` с id коммита). На сервере — `releases/<id>/`, хранятся последние 5.
- **Два слота (blue/green).** Новый релиз запускается в свободном слоте, проверяется
  `/api/health`, затем Caddy мягко переключается на него. Прежний релиз продолжает работать во втором
  слоте — **откат на него — доли секунды**. Не прошёл проверку — трафик не переключается.
- **Статика** с хешем содержимого в имени (`yurt.high.12c9289157.glb`, `scripts/hash-assets.mjs`)
  и сборка Next.js — `Cache-Control: public, max-age=31536000, immutable`. Новое содержимое —
  новое имя. Хранилище `cdn/` общее для всех релизов и не чистится при выкладке: страница,
  открытая до выкладки, догружает свои файлы и после неё. Неверный хеш — 404.
- **Без хеша** (`/assets/decoders/`, `/assets/docs/`): `max-age=0, must-revalidate` (проверка по ETag).
- **MIME:** `.glb` model/gltf-binary, `.ktx2` image/ktx2, `.splat/.spz/.ply` application/octet-stream,
  `.wasm` application/wasm, `.mp4` video/mp4, `.webm` video/webm, `.mov` video/quicktime,
  `.m4a` audio/mp4 (`src/lib/security/delivery.ts` и `deploy/caddy/Caddyfile`).
- **HTTPS** — Caddy сам получает и продлевает сертификаты Let's Encrypt.

| Файл                             | Что                                                      |
| -------------------------------- | -------------------------------------------------------- |
| `deploy/setup-server.sh`         | подготовка сервера (один раз)                            |
| `deploy/caddy/Caddyfile`         | HTTPS, статика, кэш, MIME, превью, журнал без IP         |
| `deploy/systemd/`                | сервис слота, сервис превью, ежедневная копия базы       |
| `deploy/bin/release.sh`          | выкладка релиза                                          |
| `deploy/bin/rollback.sh`         | откат                                                    |
| `deploy/bin/preview.sh`          | превью для PR                                            |
| `deploy/bin/restart.sh`          | перезапуск без простоя (после правки переменных сервера) |
| `deploy/bin/backup.sh`           | резервная копия базы заявок                              |
| `deploy/env/*.env.example`       | шаблоны переменных сервера                               |
| `.github/workflows/ci.yml`       | проверки; мёрж только при зелёном                        |
| `.github/workflows/deploy.yml`   | выкладка после зелёного CI на main, автооткат            |
| `.github/workflows/preview.yml`  | превью на каждый PR                                      |
| `.github/workflows/rollback.yml` | откат кнопкой                                            |
| `scripts/verify-rollback.mjs`    | проверка выкладки и отката (в CI на каждый PR)           |
| `scripts/measure-network.mjs`    | замер TTFB и загрузки на мобильном 4G                    |

## Окружения и переменные

| Окружение      | Адрес                             | База заявок                       | Уведомления      | Поиск           |
| -------------- | --------------------------------- | --------------------------------- | ---------------- | --------------- |
| production     | `https://<домен>`                 | `/var/lib/uly-dala/leads.sqlite`  | Telegram + email | открыт          |
| превью (PR)    | `https://pr-<N>.preview.<домен>`  | своя у каждого PR, удаляется с PR | нет (mock)       | закрыт + пароль |
| локально / e2e | `http://localhost:3000` / `:3100` | `.data/*.sqlite`                  | mock             | —               |

- **Сборочные (публичные)** `NEXT_PUBLIC_*` вшиваются в сборку → GitHub → Settings →
  Environments → `production` → Variables: `NEXT_PUBLIC_SITE_URL` (`https://<домен>`),
  `NEXT_PUBLIC_WHATSAPP_PHONE`, `NEXT_PUBLIC_PHONE`. Для превью — переменная репозитория
  `PREVIEW_DOMAIN` (`preview.<домен>`); `NEXT_PUBLIC_SITE_ENV=preview` ставит preview.yml.
- **Серверные (секреты)** — только на сервере: `/etc/uly-dala/production.env` (токены Telegram, SMTP,
  соль, Sentry), `/etc/uly-dala/preview.env`, `/etc/uly-dala/deploy.env` (домен, пароль превью).
  Шаблоны — `deploy/env/`. В репозиторий и в GitHub токены сайта не попадают.
- **Доступ GitHub → сервер** — секреты репозитория: `DEPLOY_HOST` (IP), `DEPLOY_USER` (`uly-dala`),
  `DEPLOY_SSH_KEY` (закрытый ключ), `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan <IP>`).

## Запуск с нуля — по шагам

**1. Что купить / завести** (делает заказчик или вы):

- VPS в Казахстане: Ubuntu 24.04, 2 vCPU, 4 ГБ RAM, 40 ГБ SSD (два слота + превью + копии базы).
  Провайдеры с дата-центрами в РК — например PS Cloud (ps.kz), Hoster.kz, QazCloud.
  Попросить у провайдера снимки диска (snapshot) — это ещё одна копия базы.
- Домен (`.kz` — у аккредитованного регистратора; сервер обязан быть в РК — он и будет).
- GitHub: приватный репозиторий (есть).

**2. Сервер** (один раз, с вашего компьютера):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/uly-dala-deploy -N "" -C "github-actions"
```

```bash
scp -r deploy root@<IP>:/root/uly-dala-deploy
```

```bash
ssh root@<IP> "bash /root/uly-dala-deploy/setup-server.sh '$(cat ~/.ssh/uly-dala-deploy.pub)'"
```

Затем на сервере заполнить `/etc/uly-dala/deploy.env` и `/etc/uly-dala/production.env`
(шаблоны внутри), пароль превью: `caddy hash-password` → `PREVIEW_PASSWORD_HASH`. Проверить конфиг
Caddy и запустить:

```bash
ssh root@<IP> "set -a; . /etc/uly-dala/deploy.env; caddy validate --config /etc/caddy/Caddyfile && systemctl restart caddy"
```

**3. DNS** у регистратора: A-записи `<домен>`, `www.<домен>` и `*.preview.<домен>` → IP сервера.
Через несколько минут Caddy сам выпустит сертификаты.

**4. GitHub** → Settings:

- Secrets and variables → Actions → секреты `DEPLOY_HOST`, `DEPLOY_USER` (= `uly-dala`),
  `DEPLOY_SSH_KEY` (содержимое `~/.ssh/uly-dala-deploy`), `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan <IP>`);
  переменная `PREVIEW_DOMAIN`.
- Environments → `production` → переменные `NEXT_PUBLIC_*` (см. выше).
- **Branches → Add branch ruleset для `main`:** Require a pull request before merging;
  Require status checks to pass — `check` и `audit`; Block force pushes. **Так мёрж возможен
  только при зелёном CI**, в т.ч. при нарушении бюджета ассетов (CI красный — кнопка Merge неактивна).

**5. Первая выкладка:** push в `main` → CI → Deploy (или Actions → Deploy → Run workflow).
Проверка: `https://<домен>/api/health` показывает id релиза.

## Откат (цель — меньше минуты)

Любой из способов:

1. **GitHub → Actions → Rollback → Run workflow** (пусто — предыдущий релиз; или id из `--list`).
2. По SSH: `ssh uly-dala@<IP> /srv/uly-dala/bin/rollback.sh` (или `rollback.sh <id>`, `rollback.sh --list`).
3. Автоматически: если после выкладки `https://<домен>` не отдаёт новый релиз или текст главной,
   deploy.yml сам откатывает.

Откат не трогает базу заявок (схема только дополняется) и статику (`cdn/` хранит файлы всех релизов).

### Проверка отката (4 октября 2026, `npm run verify:rollback`; в CI — на каждый PR)

Те же `release.sh`/`rollback.sh` на настоящем релизе; вместо systemd — локальный запуск, вместо
Caddy — прокси по тому же файлу upstream. Запросы к сайту — каждые 50 мс всё время проверки.

| Шаг                                   | Время     | Неуспешных запросов |
| ------------------------------------- | --------- | ------------------- |
| выкладка A (первая)                   | 2,4 с     | —                   |
| выкладка B                            | 1,7 с     | 0                   |
| **откат на прежний (тёплый слот)**    | **0,1 с** | 0                   |
| выкладка C                            | 2,0 с     | 0                   |
| **откат на B по id (холодный старт)** | **1,1 с** | 0                   |
| сломанный релиз → отклонён, сайт на B | 27 с      | 0                   |

Всего 593 запроса к работающему сайту — ни одного неуспешного. На сервере к этому добавляется
перезагрузка Caddy (мягкая, доли секунды) и SSH из GitHub Actions (~10–20 с на запуск задачи).

**После первой настоящей выкладки — повторить на сервере:** выложить два релиза, `rollback.sh`,
открыть сайт, убедиться в id релиза в `/api/health`; записать время сюда.

## Резервные копии базы заявок

`uly-dala-backup.timer` — каждый день в 03:30 (Алматы): `sqlite3 .backup` → проверка целостности →
`/var/backups/uly-dala/leads-*.sqlite.gz`, хранятся 30 дней, права только у `uly-dala`.
Восстановление: остановить слоты, `gunzip` копию поверх `/var/lib/uly-dala/leads.sqlite`, запустить.
TODO(legal): копия на второй площадке в РК (объектное хранилище провайдера) — по решению юриста.

## Сеть из Алматы и CDN

**Замер 4 октября 2026** — компьютер в Алматы, мобильный интернет; время TCP-соединения (≈ RTT):

| Куда                                | RTT      |
| ----------------------------------- | -------- |
| хостинг в Алматы (ps.kz, hoster.kz) | 45–60 мс |
| CDN Gcore (узел в Алматы)           | ~60 мс   |
| Европа (Hetzner, Германия)          | ~125 мс  |

**Телефон на эмуляции 4G** (CPU ×4, 390×844 @3x; локальный релиз — задержка сервера в замер
не входит, её добавит сеть из таблицы выше), `scripts/measure-network.mjs`:

| Уровень / сеть                       | FCP    | LCP        | ассеты первой сцены |
| ------------------------------------ | ------ | ---------- | ------------------- |
| medium (обычный телефон), 4G         | 0,53 с | 0,53 с     | 2,9 с, 1,8 МБ       |
| medium, Slow 4G (1,6 Мбит/с, 150 мс) | 0,88 с | 0,88 с     | 6,8 с               |
| fallback (слабый телефон), 4G        | 0,51 с | 1,23 с     | 2,6 с, 2,1 МБ       |
| fallback, Slow 4G                    | 0,88 с | **3,89 с** | 4,0 с               |

- Порог LCP ≤ 2,5 с выполнен везде, кроме слабых телефонов на медленном 4G: там LCP — первый кадр
  видео-заставки. Вынесено в отдельную задачу.
- **Вывод про CDN:** сервер в Алматы — уже «рядом» (~50 мс); CDN ради задержки не нужен.
  Если понадобится разгрузить канал сервера или защита от DDoS — **Gcore** (есть узел в Алматы)
  перед доменом целиком: заголовки кэша уже готовы (immutable для хешированных файлов, страницы и
  API без долгого кэша). Внимание: через CDN пойдут и формы заявок — нужен юрист (TLS-терминация у
  иностранной компании). Альтернатива без этого вопроса — CDN только для статики.

**Повторить на production** (с телефона в режиме модема или компьютера в Алматы):

```bash
node scripts/measure-network.mjs https://<домен> --runs 5
```

## Превью для PR

preview.yml на каждый PR из этого репозитория: сборка с `NEXT_PUBLIC_SITE_ENV=preview` →
`https://pr-<N>.preview.<домен>` (логин `PREVIEW_USER`, пароль — у команды), ссылка — комментарием
в PR. Закрыли PR — превью и его база удаляются. robots.txt превью запрещает всё,
плюс `X-Robots-Tag: noindex`.
