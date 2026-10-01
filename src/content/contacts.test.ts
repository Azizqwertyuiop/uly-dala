import { describe, expect, it } from "vitest";
import { formatPhone, telHref, whatsappHref } from "./contacts";

describe("контакты — ссылки для телефонов и встроенных браузеров", () => {
  it("tel: — международный формат без пробелов", () => {
    expect(telHref("7 (701) 000-00-00")).toBe("tel:+77010000000");
  });

  it("wa.me — только цифры", () => {
    expect(whatsappHref("+7 701 000 00 00")).toBe("https://wa.me/77010000000");
  });

  it("номер для показа — с неразрывными пробелами", () => {
    expect(formatPhone("77010000000")).toBe("+7 701 000 00 00");
  });
});
