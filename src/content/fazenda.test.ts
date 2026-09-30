import { describe, expect, it } from "vitest";
import { MAX_REVIEWS, pickReviews, type Review } from "./clients";
import { mapLinks } from "./fazenda";

describe("фазенда и архив", () => {
  it("ссылки на 2GIS и Google Maps — из координат; без точки ссылок нет", () => {
    expect(mapLinks(null)).toBeNull();
    const links = mapLinks({ lat: 43.1, lng: 76.5 })!;
    expect(links.twoGis).toBe("https://2gis.kz/almaty/geo/76.500000%2C43.100000");
    expect(links.google).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=43.100000%2C76.500000",
    );
  });

  it("отзывов — не больше трёх, язык — с запасным ru", () => {
    const review = (n: number): Review => ({
      quote: { ru: `Отзыв ${n}`, en: `Review ${n}` },
      author: `Автор ${n}`,
      role: { ru: "HR", en: "HR" },
    });
    const picked = pickReviews([1, 2, 3, 4].map(review), "kk");
    expect(picked).toHaveLength(MAX_REVIEWS);
    expect(picked[0]!.quote).toBe("Отзыв 1");
    expect(pickReviews([review(1)], "en")[0]!.quote).toBe("Review 1");
  });
});
