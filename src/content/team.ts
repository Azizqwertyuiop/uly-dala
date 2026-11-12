/*
 * Команда на главной: три главных организатора (решение заказчика 12.11.2026).
 * TODO(client-data): имена, должности и фото — заказчик присылает по одному.
 * photo: null — пустая рамка с подписью «Фото скоро»; файл кладётся в public/assets/photos/team/
 * и указывается здесь (через assetUrl после npm run assets:hash).
 */
export const team = [
  { key: "one", photo: null },
  { key: "two", photo: null },
  { key: "three", photo: null },
] as const satisfies readonly { key: string; photo: string | null }[];
