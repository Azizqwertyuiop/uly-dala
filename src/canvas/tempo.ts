import type { ChapterTempoId } from "@/motion/tokens";

/*
 * Темп внутри главы (раздел 5): сцена может временно задать свой темп — кудалык в «Дне»
 * (×1.6, сглаживание камеры 0,6 с). null — темп главы по умолчанию.
 */
export const sceneTempo = { id: null as ChapterTempoId | null };
