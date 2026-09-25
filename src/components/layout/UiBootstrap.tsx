"use client";

import { useEffect } from "react";
import { useUiStore } from "@/store/ui";

/** Поднимает состояние интерфейса в браузере: режим из localStorage / prefers-reduced-motion. */
export function UiBootstrap() {
  useEffect(() => useUiStore.getState().hydrate(), []);
  return null;
}
