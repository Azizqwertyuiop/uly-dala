/*
 * Экранная типографика для строк интерфейса — CLAUDE.md, раздел 4.
 * Работает с обычным текстом (не с HTML). Повторный прогон ничего не меняет.
 *
 * - «ёлочки» (вложенные „лапки“) в ru/kk, “лапки” (вложенные ‘одиночные’) в en;
 * - тире: неразрывный пробел перед «—»; диапазоны чисел через «–»;
 * - неразрывные пробелы: после коротких слов, в числах и между числом и словом, в телефонах;
 * - многоточие «…».
 */

export type TypographyLocale = "ru" | "kk" | "en";

export const NBSP = "\u00A0";
/** Неразрывный дефис — для телефонов. */
export const NB_HYPHEN = "\u2011";

const SPACE = `[ ${NBSP}]`;

/** Трёхбуквенные предлоги и союзы, которые не должны висеть в конце строки. */
const RU_SHORT_WORDS = [
  "без",
  "для",
  "над",
  "под",
  "при",
  "про",
  "обо",
  "изо",
  "ото",
  "что",
  "как",
];
const EN_SHORT_WORDS = [
  "a",
  "an",
  "the",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "for",
  "and",
  "or",
  "but",
  "nor",
  "as",
  "if",
  "is",
  "no",
];

/** Частицы, которые прилипают к предыдущему слову. */
const RU_TRAILING_PARTICLES = ["же", "ж", "ли", "ль", "бы", "б"];

export function typograph(input: string, locale: TypographyLocale): string {
  let text = input;

  text = text.replace(/\.\.\./g, "…");
  text = phones(text);
  text = quotes(text, locale);
  text = dashes(text);
  text = numbers(text);
  text = shortWords(text, locale);

  return text;
}

/** +7 701 123 45 67, +7 (701) 123-45-67 → без переносов внутри номера. */
function phones(text: string): string {
  return text.replace(/\+\d{1,3}(?:[ \u00A0\-\u2011()]*\d){6,}/g, (phone) =>
    phone.replace(/[ ]/g, NBSP).replace(/-/g, NB_HYPHEN),
  );
}

function quotes(text: string, locale: TypographyLocale): string {
  const [open1, close1, open2, close2] =
    locale === "en" ? ["“", "”", "‘", "’"] : ["«", "»", "„", "“"];

  // Апостроф внутри слова: don't, О'Нил → ’
  let result = text.replace(/(\p{L})'(\p{L})/gu, "$1’$2");

  // Приводим все двойные кавычки к прямым и расставляем заново по вложенности.
  // Для ru/kk „“ — тоже «прямые» (вложенные), для en «» оставляем как есть.
  const normalized =
    locale === "en" ? result.replace(/[“”]/g, '"') : result.replace(/[«»„“”]/g, '"');
  if (!normalized.includes('"')) return result;

  let depth = 0;
  let out = "";
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i]!;
    if (char !== '"') {
      out += char;
      continue;
    }
    const prev = i === 0 ? "" : normalized[i - 1]!;
    const opens = prev === "" || /[\s\u00A0(\[{—–\-/]/.test(prev) || prev === '"';
    if (opens) {
      out += depth === 0 ? open1 : open2;
      depth++;
    } else {
      depth = Math.max(0, depth - 1);
      out += depth === 0 ? close1 : close2;
    }
  }
  result = out;

  if (locale === "en") {
    // Одиночные кавычки в en: открывающая после пробела, иначе закрывающая/апостроф.
    result = result.replace(/(^|[\s\u00A0(“])'/g, "$1‘").replace(/'/g, "’");
  }
  return result;
}

function dashes(text: string): string {
  return (
    text
      // слово - слово, слово -- слово, слово — слово, слово – слово → слово⍽— слово
      .replace(new RegExp(`(\\S)${SPACE}+(?:--|-|–|—)${SPACE}+`, "g"), `$1${NBSP}— `)
      // 5-10, 5 - 10 уже обработано выше как тире; 5-10 → 5–10
      .replace(/(\d)-(?=\d)/g, "$1–")
  );
}

function numbers(text: string): string {
  return (
    text
      // 150 000 → 150⍽000
      .replace(/(\d) (?=\d{3}(?!\d))/g, `$1${NBSP}`)
      // 150 гостей, 6+ лет, 30% скидка → число не отрывается от слова
      .replace(/(\d[+%]?) (?=\p{L})/gu, `$1${NBSP}`)
      // № 5, § 7
      .replace(/([№§]) (?=\d)/g, `$1${NBSP}`)
  );
}

function shortWords(text: string, locale: TypographyLocale): string {
  const before = `(?<=^|[\\s\\u00A0(«„“"‘—–])`;

  if (locale === "en") {
    const words = EN_SHORT_WORDS.join("|");
    return text.replace(new RegExp(`${before}(${words}) `, "giu"), `$1${NBSP}`);
  }

  // ru и kk: любые слова из 1–2 букв и трёхбуквенные предлоги (для kk список — TODO(kk-copywriter))
  // Частицы (же, ли, бы…) клеятся к предыдущему слову, а не к следующему.
  const particles = RU_TRAILING_PARTICLES.join("|");
  const words =
    locale === "ru"
      ? `(?!(?:${particles}) )(?:\\p{L}{1,2}|${RU_SHORT_WORDS.join("|")})`
      : `\\p{L}{1,2}`;
  let result = text.replace(new RegExp(`${before}(${words}) `, "giu"), `$1${NBSP}`);

  if (locale === "ru") {
    result = result.replace(
      new RegExp(` (${particles})(?=[\\s\\u00A0.,!?;:…»)]|$)`, "giu"),
      `${NBSP}$1`,
    );
  }
  return result;
}
