/*
 * Образцы для страницы проверки шрифтов. Это не тексты сайта, а тестовые строки.
 * Казахские слова — только термины из CLAUDE.md (кереге, уықи, шаңырақ, кийиз, кудалык).
 */

/** Буквы казахского алфавита, которых нет в русском (CLAUDE.md, раздел 4). */
export const kazakhLetters = {
  lower: ["ә", "ғ", "қ", "ң", "ө", "ұ", "ү", "һ", "і"],
  upper: ["Ә", "Ғ", "Қ", "Ң", "Ө", "Ұ", "Ү", "Һ", "І"],
} as const;

export const kazakhWords = "Шаңырақ · Уықи · Кереге · Кийиз · ШАҢЫРАҚ · УЫҚИ";

export const russianAlphabet =
  "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ абвгдеёжзийклмнопрстуфхцчшщъыьэюя";

export const latinAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789";

export const punctuation = "«ёлочки» „лапки“ “quotes” — – … № § +7 · 150 000";
