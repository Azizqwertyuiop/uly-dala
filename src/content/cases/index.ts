import type { Locale } from "@/lib/i18n";
import { typograph } from "@/lib/typography";
import type { Case, CaseText } from "./types";

export type { Case, CaseText };

/*
 * TODO(client-data): реальные кейсы, кадры, клиенты и разрешения на публикацию (CLAUDE.md, раздел 17).
 * Сейчас — три заглушки по форматам. Имена клиентов и цифры не указываются.
 */

const cover = (slug: string) => ({
  src: `/assets/placeholders/case-${slug}.svg`,
  width: 1600,
  height: 1000,
});

const pending = {
  ru: {
    task: "Описание задачи появится после согласования кейса с клиентом.",
    solution: "Описание решения появится после согласования кейса с клиентом.",
    result: "Итоги появятся после согласования кейса с клиентом.",
  },
  en: {
    task: "The brief will be published once the case is approved by the client.",
    solution: "The solution will be published once the case is approved by the client.",
    result: "Results will be published once the case is approved by the client.",
  },
};

export const cases: readonly Case[] = [
  {
    slug: "conference-in-the-steppe",
    format: "conference",
    cover: cover("conference-in-the-steppe"),
    placeholder: true,
    text: {
      ru: {
        title: "Конференция в степи",
        summary: "Деловое событие на фазенде со своей техникой и кухней.",
        coverAlt: "Шатёр на фазенде с LED-стеной, гости рассаживаются перед началом.",
        ...pending.ru,
      },
      en: {
        title: "A conference in the steppe",
        summary: "A business event at the venue with our own equipment and kitchen.",
        coverAlt: "A tent at the venue with an LED wall, guests taking their seats.",
        ...pending.en,
      },
    },
  },
  {
    slug: "kudalyk-two-families",
    format: "kudalyk",
    cover: cover("kudalyk-two-families"),
    placeholder: true,
    text: {
      ru: {
        title: "Кудалык двух семей",
        summary: "Традиционная церемония с дастарханом от штатного шефа.",
        coverAlt: "Руки раскладывают угощения на белой ткани дастархана.",
        ...pending.ru,
      },
      en: {
        title: "A kudalyk for two families",
        summary: "A traditional ceremony with a dastarkhan by our in-house chef.",
        coverAlt: "Hands laying out food on the white cloth of a dastarkhan.",
        ...pending.en,
      },
    },
  },
  {
    slug: "evening-wedding",
    format: "wedding",
    cover: cover("evening-wedding"),
    placeholder: true,
    text: {
      ru: {
        title: "Вечерняя свадьба",
        summary: "Свадьба на закате: декор, свет и банкет своими силами.",
        coverAlt: "Длинный стол в вечерней степи под гирляндами тёплого света.",
        ...pending.ru,
      },
      en: {
        title: "An evening wedding",
        summary: "A sunset wedding: decor, light and banquet, all in-house.",
        coverAlt: "A long table in the evening steppe under strings of warm lights.",
        ...pending.en,
      },
    },
  },
];

export function findCase(slug: string): Case | undefined {
  return cases.find((item) => item.slug === slug);
}

/** Текст кейса на нужном языке (kk без перевода — русский), с типографикой. */
export function caseText(item: Case, locale: Locale): CaseText {
  const text =
    (locale === "kk" ? item.text.kk : undefined) ?? (locale === "en" ? item.text.en : item.text.ru);
  return Object.fromEntries(
    Object.entries(text).map(([key, value]) => [key, typograph(value, locale)]),
  ) as unknown as CaseText;
}
