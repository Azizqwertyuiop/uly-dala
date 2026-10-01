import { describe, expect, it } from "vitest";
import { NBSP } from "@/lib/typography";
import { getMessages } from ".";
import ru from "./ru";

const keys = (tree: object, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );

describe("messages", () => {
  it("kk без перевода показывает русский текст", () => {
    expect(getMessages("kk").hero.title).toBe(getMessages("ru").hero.title);
  });

  it("en и kk содержат все ключи ru", () => {
    expect(keys(getMessages("en"))).toEqual(keys(ru));
    expect(keys(getMessages("kk"))).toEqual(keys(ru));
  });

  it("к строкам применяется типографика", () => {
    expect(getMessages("ru").hero.proof).toBe(
      `6+${NBSP}лет · своя фазенда · своя техника · штатный шеф`,
    );
    expect(getMessages("ru").notFound.title).toBe(`Здесь пока ничего не${NBSP}поставлено.`);
  });
});

describe("язык страницы (WCAG 3.1.1)", () => {
  it("ru и en — свои; kk — русский, пока казахский перевод неполный", async () => {
    const { contentLanguage } = await import("./index");
    expect(contentLanguage("ru")).toBe("ru");
    expect(contentLanguage("en")).toBe("en");
    // TODO(kk-copywriter): когда kk.ts покроет все строки — здесь станет "kk".
    expect(contentLanguage("kk")).toBe("ru");
  });
});
