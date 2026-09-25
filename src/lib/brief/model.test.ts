import { describe, expect, it } from "vitest";
import { formatPhoneMask, normalizePhone } from "./model";

describe("телефон", () => {
  it("нормализует номера РК", () => {
    expect(normalizePhone("+7 701 123 45 67")).toBe("+77011234567");
    expect(normalizePhone("8 (701) 123-45-67")).toBe("+77011234567");
    expect(normalizePhone("7011234567")).toBe("+77011234567");
    expect(normalizePhone("77011234567")).toBe("+77011234567");
    expect(normalizePhone("+7 (701) 123-45-6")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("+1 202 555 0100 00")).toBeNull();
  });

  it("маска +7 при вводе", () => {
    expect(formatPhoneMask("")).toBe("");
    expect(formatPhoneMask("+")).toBe("+7 ");
    expect(formatPhoneMask("+7 ")).toBe("+7 ");
    expect(formatPhoneMask("+7 7")).toBe("+7 (7");
    expect(formatPhoneMask("7")).toBe("+7 (7");
    expect(formatPhoneMask("701")).toBe("+7 (701)");
    expect(formatPhoneMask("7011")).toBe("+7 (701) 1");
    expect(formatPhoneMask("87011234567")).toBe("+7 (701) 123-45-67");
    expect(formatPhoneMask("+7 (701) 123-45-6799")).toBe("+7 (701) 123-45-67");
  });
});
