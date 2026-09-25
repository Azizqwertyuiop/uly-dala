# Runbook

Эксплуатация сайта: деплой, откат, мониторинг, что делать при сбоях.
Будет заполнено на шаге «Деплой».

## Заявки

Порядок обработки (CLAUDE.md, раздел 9): валидация → honeypot → лимит по IP → запись в базу →
ответ пользователю → уведомления в фоне (Telegram + email, по 3 попытки) → алерт, если не доставлено.

- Код: `src/server/leads/`. Настройки — только через переменные окружения, список в `.env.example`.
- Локально заявки лежат в `.data/leads.sqlite` (в git не попадает). Посмотреть:
  `sqlite3 .data/leads.sqlite "select created_at, source, name, phone from leads order by created_at desc limit 20"`.
- Попытки уведомлений — таблица `notifications`, алерты — таблица `alerts`.
- Если в `alerts` есть `notify-all-failed` или `notify-not-configured` — менеджеры заявку не получили:
  найти её по `lead_id` в `leads` и передать вручную, затем проверить токены Telegram / SMTP.
- **До запуска:** выбрать хранилище по решению юриста (TODO(legal)) — SQLite-файл не подходит
  для хостинга без постоянного диска (например, Vercel).
