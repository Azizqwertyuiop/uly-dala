import { describe, expect, it } from "vitest";
import { defaultLocale, isLocale, locales } from "./i18n";

describe("i18n", () => {
  it("поддерживает казахский, русский и английский", () => {
    expect(locales).toEqual(["kk", "ru", "en"]);
  });

  it("русский — язык по умолчанию", () => {
    expect(defaultLocale).toBe("ru");
  });

  it("распознаёт только поддерживаемые языки", () => {
    expect(isLocale("kk")).toBe(true);
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("kz")).toBe(false);
    expect(isLocale("RU")).toBe(false);
    expect(isLocale("")).toBe(false);
  });
});
