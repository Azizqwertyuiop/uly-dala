import { places, type Place } from "./events";

export const isOneOf = <T extends readonly string[]>(
  list: T,
  v: string | null | undefined,
): v is T[number] => v != null && (list as readonly string[]).includes(v);

/** Где элемент: явная пометка data-place, окно, раздел главной (id), хедер, футер — иначе «page». */
export function placeOf(el: Element): Place {
  const marked = el.closest<HTMLElement>("[data-place]")?.dataset.place;
  if (isOneOf(places, marked)) return marked;
  if (el.closest("dialog, [role=dialog]")) return "modal";
  const section = el.closest<HTMLElement>("main > section[id]")?.id;
  if (isOneOf(places, section)) return section;
  if (el.closest("header")) return "header";
  if (el.closest("footer")) return "footer";
  return "page";
}
