/*
 * Команда на главной: три главных организатора (решение заказчика 12.11.2026).
 * TODO(client-data): имена, должности и фото — заказчик присылает по одному.
 * photo: null — пустая рамка с подписью «Фото скоро». Оригинал кладётся в
 * assets-src/photos/team/<key>.jpg → npm run assets:team → путь указывается здесь.
 */
import { assetUrl } from "@/lib/assets/url";

export const team = [
  { key: "one", photo: assetUrl("/assets/photos/team/one.jpg") },
  { key: "two", photo: assetUrl("/assets/photos/team/two.jpg") },
  { key: "three", photo: null },
] as const satisfies readonly { key: string; photo: string | null }[];
