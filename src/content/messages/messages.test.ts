import { describe, expect, it } from "vitest";
import { getMessages } from ".";
import ru from "./ru";

describe("messages", () => {
  it("kk без перевода показывает русский текст", () => {
    expect(getMessages("kk").hero.title).toBe(ru.hero.title);
  });

  it("en содержит все ключи ru", () => {
    const keys = (tree: object, prefix = ""): string[] =>
      Object.entries(tree).flatMap(([k, v]) =>
        typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
      );
    expect(keys(getMessages("en"))).toEqual(keys(ru));
  });
});
