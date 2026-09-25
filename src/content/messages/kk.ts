import type { Messages } from "./ru";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

/*
 * TODO(kk-copywriter): казахские тексты пишет копирайтер-носитель. Машинный перевод запрещён
 * (CLAUDE.md, разделы 0 и 15).
 *
 * Пока здесь пусто — все ключи берутся из ru.ts, и на /kk показывается русский текст.
 * Копирайтер добавляет ключи с той же структурой, что в ru.ts; недостающие остаются русскими.
 */
const kk: DeepPartial<Messages> = {};

export default kk;
