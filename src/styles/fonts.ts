import { Cormorant, Source_Sans_3 } from "next/font/google";

/*
 * Шрифты (CLAUDE.md, раздел 4). Оба — переменные: один файл на подмножество символов
 * покрывает все насыщенности. Казахские ә ғ қ ң ө ү һ лежат в подмножестве cyrillic-ext,
 * ұ і — в cyrillic; покрытие проверяет e2e/fonts.spec.ts по самим файлам шрифтов.
 *
 * `subsets` в next/font управляет только предзагрузкой — @font-face объявляются для всех
 * подмножеств, браузер докачивает нужные по unicode-range.
 * Резервный шрифт с size-adjust / ascent-override / descent-override next/font генерирует
 * сам (adjustFontFallback включён по умолчанию). Опцию `fallback` НЕ задавать: с ней Turbopack
 * молча перестаёт генерировать подогнанный резервный шрифт. Системные шрифты дописаны
 * после var(--font-*) в tokens.css.
 */

/** Заголовки: острая контрастная антиква. Предзагружается одно начертание — прямое, кириллица. */
export const headingFont = Cormorant({
  subsets: ["cyrillic"],
  style: "normal",
  display: "swap",
  preload: true,
  variable: "--font-heading",
});

/** Курсив заголовков — отдельным семейством, чтобы не попасть в предзагрузку. */
export const headingItalicFont = Cormorant({
  subsets: ["cyrillic"],
  style: "italic",
  display: "swap",
  preload: false,
  variable: "--font-heading-italic",
});

/** Текст: спокойный гуманистический гротеск. */
export const bodyFont = Source_Sans_3({
  subsets: ["cyrillic"],
  style: ["normal", "italic"],
  display: "swap",
  preload: false,
  variable: "--font-body",
});

export const fontVariables = [headingFont, headingItalicFont, bodyFont]
  .map((font) => font.variable)
  .join(" ");

/** Для страницы проверки шрифтов: какие начертания существуют. */
export const fontSpecimens = {
  heading: { name: "Cormorant", weights: [300, 400, 500, 600, 700] },
  body: { name: "Source Sans 3", weights: [200, 300, 400, 500, 600, 700, 800, 900] },
} as const;
