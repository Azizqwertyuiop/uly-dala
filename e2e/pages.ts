/** Все страницы сайта — для e2e и проверки доступности. */
export const locales = ["kk", "ru", "en"] as const;

export const chapterIds = ["dawn", "assembly", "day", "fire", "world", "return"] as const;

export const formatSlugs = [
  "conference",
  "coffee-break",
  "team-building",
  "kudalyk",
  "wedding",
  "private-party",
] as const;

export const caseSlugs = [
  "conference-in-the-steppe",
  "kudalyk-two-families",
  "evening-wedding",
] as const;

export const innerPaths = [
  ...formatSlugs.map((slug) => `/services/${slug}`),
  "/fazenda",
  ...caseSlugs.map((slug) => `/cases/${slug}`),
  "/privacy",
];

export const allPaths = (locale: string) => [
  `/${locale}`,
  ...innerPaths.map((p) => `/${locale}${p}`),
];
