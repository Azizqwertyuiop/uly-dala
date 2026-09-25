/*
 * Русский — базовый язык (CLAUDE.md, раздел 3). Структура этого файла — эталон для kk и en.
 */
const ru = {
  meta: {
    title: "ULY DALA — ивент-агентство полного цикла в Алматы",
    description:
      "Ивент-агентство полного цикла в Алматы. Конференции, тимбилдинги, свадьбы, кудалык — на собственной площадке в степи.",
  },
  brand: {
    name: "ULY DALA",
  },
  hero: {
    title: "Мы ставим мир.",
    subtitle:
      "Ивент-агентство полного цикла в Алматы. Конференции, тимбилдинги, свадьбы, кудалык — на собственной площадке в степи.",
  },
  notFound: {
    title: "Здесь пока ничего не поставлено.",
  },
  typeTest: {
    metaTitle: "Проверка шрифтов",
    title: "Проверка шрифтов",
    intro:
      "Служебная страница. Все казахские буквы во всех начертаниях. Если буква выглядит иначе, чем соседние, — шрифт её не содержит.",
    headingFont: "Шрифт заголовков",
    bodyFont: "Шрифт текста",
    normal: "прямое",
    italic: "курсив",
    weight: "насыщенность",
  },
} as const;

type Widen<T> = { -readonly [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

export type Messages = Widen<typeof ru>;

export default ru satisfies Messages;
