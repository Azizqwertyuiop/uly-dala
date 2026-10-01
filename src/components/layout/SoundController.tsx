"use client";

import { useEffect } from "react";
import type { ChapterId } from "@/components/sections/chapters";
import { input } from "@/motion/input";
import { progress } from "@/motion/progress";
import { ticker } from "@/motion/ticker";
import { whenIdle } from "@/lib/idle";
import { BRIEF_SENT_EVENT, soundBus } from "@/lib/sound/bus";
import type { SoundEngine, SoundSnapshot } from "@/lib/sound/engine";
import { gustLevel } from "@/lib/sound/mix";
import { useUiStore } from "@/store/ui";

/*
 * Звук сайта (CLAUDE.md, раздел 8): по умолчанию выключен, без действия пользователя не играет.
 * Движок (Web Audio) создаётся синхронно в обработчике нажатия «Звук» — подписка на стор
 * срабатывает внутри того же клика; код движка и файлы грузятся только после этого.
 * Кадр: глава (кроссфейд) и порывы ветра (сцена степи или курсор).
 * Отправка брифа (событие uly:brief-sent) — мягкий порыв.
 */

const debug: { snapshot: SoundSnapshot | null } = { snapshot: null };

export function SoundController() {
  useEffect(() => {
    (window as unknown as { __sound: typeof debug }).__sound = debug;
    let engine: SoundEngine | null = null;
    let offFrame: (() => void) | null = null;
    // Модуль движка — небольшой; загружается заранее только в простое, без файлов и без звука.
    let EngineClass: typeof SoundEngine | null = null;
    let ready: Promise<unknown> | null = null;
    const loadEngine = () =>
      (ready ??= import("@/lib/sound/engine").then((m) => (EngineClass = m.SoundEngine)));
    const offIdle = whenIdle(() => void loadEngine(), 4000);

    const start = () => {
      if (!EngineClass) return false;
      engine ??= new EngineClass();
      debug.snapshot = engine.snapshot;
      engine.setEnabled(true);
      offFrame ??= ticker.add("render", (dt, time) => {
        const chapter = (progress.chapterId as ChapterId | null) ?? null;
        engine!.update(chapter, gustLevel(soundBus, time, input.active ? input.speed : 0), dt);
      });
      return true;
    };
    const stop = () => {
      offFrame?.();
      offFrame = null;
      engine?.setEnabled(false);
    };

    const offStore = useUiStore.subscribe((state, prev) => {
      if (state.soundEnabled === prev.soundEnabled) return;
      if (!state.soundEnabled) return stop();
      // Внутри клика: AudioContext создаётся в том же действии пользователя.
      if (!start()) void loadEngine().then(start);
    });

    const onSent = () => engine?.playGust();
    window.addEventListener(BRIEF_SENT_EVENT, onSent);
    return () => {
      offIdle();
      offStore();
      stop();
      engine?.dispose();
      window.removeEventListener(BRIEF_SENT_EVENT, onSent);
    };
  }, []);

  return null;
}
