# SEO (CLAUDE.md, раздел 11)

## Что есть

- **Метаданные** (`src/lib/seo/metadata.ts`) на всех страницах и трёх языках: title, description,
  canonical, hreflang (kk, ru, en, x-default → ru), Open Graph и Twitter (`summary_large_image`).
- **OG-изображения** — ключевые кадры сцен, 1200×630 JPEG (`public/og/`, `npm run assets:og`
  при запущенном сайте на :3200): главная — рассвет, форматы — свои площадки «Дня», фазенда — облёт,
  кейсы — площадка их формата, политика — финал.
- **JSON-LD** (`src/lib/seo/jsonld.ts`, типы `schema-dts` — проверка словаря schema.org при сборке):
  главная — Organization, LocalBusiness, Place; фазенда — Place; кейсы — CreativeWork;
  форматы — FAQPage (вопросы и ответы — видимым текстом на странице).
- **sitemap.xml** — все индексируемые страницы × 3 языка, у каждой hreflang; **robots.txt** —
  открыт, закрыты только служебные страницы; формы заявок — `noindex` (не закрыты от обхода).
- **Корень `/`** — без перенаправления: показывает русскую версию, canonical — `/ru`.
  Язык браузера предлагает плашка (`LanguageSuggest`), закрытие запоминается.
- **Без JS** весь текст главной — в HTML (`e2e/seo.spec.ts`, запрос без браузера, как curl).

## Запросы — в видимом тексте

| Запрос                                | ru — где                                  | en — где                    |
| ------------------------------------- | ----------------------------------------- | --------------------------- |
| ивент-агентство Алматы / event agency | главная: заголовок страницы, подзаголовок | главная                     |
| организация конференций               | /services/conference: title, подзаголовок | «Conference organization»   |
| кудалык                               | /services/kudalyk: title, текст, FAQ      | «Kudalyk in Almaty»         |
| площадка для свадьбы под Алматы       | /services/wedding: title, подзаголовок    | «Wedding venue near Almaty» |
| тимбилдинг                            | /services/team-building                   | «Team building near Almaty» |

**Казахский:** запросы на казахском пишет копирайтер-носитель вместе с текстами
(TODO(kk-copywriter); машинный перевод запрещён). Пока `/kk` показывает русский текст и объявляет
`lang="ru"`; hreflang `kk` уже стоит — станет точным, когда появятся тексты.

## Перед запуском

- `NEXT_PUBLIC_SITE_URL` — боевой домен (TODO(client-data)): от него canonical, hreflang, sitemap, OG.
- Подтвердить адрес и координаты фазенды, телефон — они сами появятся в LocalBusiness и Place.
- Страница «О нас» (раздел 11) — когда будут тексты (TODO(client-copy)).
- Проверить разметку в Google Rich Results Test и Яндекс.Вебмастере на боевом домене.
