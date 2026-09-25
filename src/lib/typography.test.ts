import { describe, expect, it } from "vitest";
import { NB_HYPHEN, NBSP, typograph } from "./typography";

/** В ожиданиях «⍽» — неразрывный пробел, «~» — неразрывный дефис: так нагляднее. */
const n = (s: string) => s.replace(/⍽/g, NBSP).replace(/~/g, NB_HYPHEN);

describe("typograph: ru", () => {
  const ru = (s: string) => typograph(s, "ru");

  it("ставит ёлочки и вложенные лапки", () => {
    expect(ru('Площадка "Uly Dala"')).toBe("Площадка «Uly Dala»");
    expect(ru('"Проект "Юрта" готов"')).toBe("«Проект „Юрта“ готов»");
    expect(ru("“Кривые” кавычки")).toBe("«Кривые» кавычки");
  });

  it("ставит тире с неразрывным пробелом перед ним", () => {
    expect(ru("Шаңырақ - венец купола")).toBe(n("Шаңырақ⍽— венец купола"));
    expect(ru("Огонь -- это кухня")).toBe(n("Огонь⍽— это кухня"));
    expect(ru("Мир — готов")).toBe(n("Мир⍽— готов"));
  });

  it("ставит короткое тире в диапазонах чисел", () => {
    expect(ru("50-150 гостей")).toBe(n("50–150⍽гостей"));
  });

  it("не отрывает короткие слова и предлоги", () => {
    expect(ru("Мы ставим мир в степи и снимаем его")).toBe(
      n("Мы⍽ставим мир в⍽степи и⍽снимаем его"),
    );
    expect(ru("Кухня для гостей без спешки")).toBe(n("Кухня для⍽гостей без⍽спешки"));
    expect(ru("и в поле")).toBe(n("и⍽в⍽поле"));
  });

  it("приклеивает частицы к предыдущему слову", () => {
    expect(ru("Когда же начнём?")).toBe(n("Когда⍽же начнём?"));
    expect(ru("Было бы славно")).toBe(n("Было⍽бы славно"));
  });

  it("не разрывает числа и число со словом", () => {
    expect(ru("Вместимость 150 000 человек")).toBe(n("Вместимость 150⍽000⍽человек"));
    expect(ru("6+ лет опыта")).toBe(n("6+⍽лет опыта"));
    expect(ru("Раздел № 5")).toBe(n("Раздел №⍽5"));
  });

  it("не разрывает телефоны", () => {
    expect(ru("Звоните +7 701 123 45 67")).toBe(n("Звоните +7⍽701⍽123⍽45⍽67"));
    expect(ru("+7 (701) 123-45-67")).toBe(n("+7⍽(701)⍽123~45~67"));
  });

  it("заменяет три точки на многоточие", () => {
    expect(ru("Рассвет...")).toBe("Рассвет…");
  });

  it("строка доказательств из CLAUDE.md", () => {
    expect(ru("6+ лет · своя фазенда · своя техника · штатный шеф")).toBe(
      n("6+⍽лет · своя фазенда · своя техника · штатный шеф"),
    );
  });
});

describe("typograph: kk", () => {
  const kk = (s: string) => typograph(s, "kk");

  it("ставит ёлочки и тире, как в ru", () => {
    expect(kk('"Шаңырақ" - венец')).toBe(n("«Шаңырақ»⍽— венец"));
  });

  it("не разрывает телефоны и числа", () => {
    expect(kk("+7 701 123 45 67, 150 000")).toBe(n("+7⍽701⍽123⍽45⍽67, 150⍽000"));
  });
});

describe("typograph: en", () => {
  const en = (s: string) => typograph(s, "en");

  it("ставит английские кавычки и апострофы", () => {
    expect(en('The "Great Steppe"')).toBe(n("The⍽“Great Steppe”"));
    expect(en(`"We don't say 'never'"`)).toBe("“We don’t say ‘never’”");
  });

  it("не отрывает артикли и предлоги", () => {
    expect(en("A world in the steppe")).toBe(n("A⍽world in⍽the⍽steppe"));
  });

  it("ставит тире и числа", () => {
    expect(en("Fire - our own chef")).toBe(n("Fire⍽— our own chef"));
    expect(en("150 guests")).toBe(n("150⍽guests"));
  });
});

describe("typograph: повторный прогон", () => {
  const samples = [
    'Мы ставим мир. И снимаем его, не оставив следа - "навсегда"...',
    "+7 (701) 123-45-67, 50-150 гостей, 6+ лет",
    '"Проект "Юрта" готов" и в поле',
  ];

  for (const locale of ["ru", "kk", "en"] as const) {
    it(`ничего не меняет повторно (${locale})`, () => {
      for (const sample of samples) {
        const once = typograph(sample, locale);
        expect(typograph(once, locale)).toBe(once);
      }
    });
  }
});
