import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BUDGETS } from "@/canvas/budgets";
import { unhashedPath } from "@/lib/assets/url";
import { clipTime, CLIP_FPS, fallbackClips } from "./fallbackClips";

const file = (url: string) => join(process.cwd(), "public", unhashedPath(url));

describe("видео-секвенции fallback", () => {
  it("файлы на месте (широкий кадр и портрет), каждый — в бюджете главы", () => {
    for (const clip of Object.values(fallbackClips)) {
      for (const s of [...clip!.sources, ...clip!.portrait]) {
        expect(existsSync(file(s.src)), s.src).toBe(true);
        expect(statSync(file(s.src)).size).toBeLessThan(BUDGETS.chapter / 2);
      }
    }
  });

  it("«Рассвет»: сначала интро по времени (волна), потом скролл главы", () => {
    const dawn = fallbackClips.dawn!;
    expect(clipTime(dawn, 0, 1)).toBeCloseTo(1);
    expect(clipTime(dawn, 0, null)).toBeCloseTo(dawn.intro);
    expect(clipTime(dawn, 1, null)).toBeCloseTo(dawn.duration - 1 / CLIP_FPS);
    // Интро закончилось — дальше только скролл.
    expect(clipTime(dawn, 0.5, dawn.intro + 1)).toBeGreaterThan(dawn.intro);
  });

  it("остальные главы — только скролл, время в пределах клипа", () => {
    const fire = fallbackClips.fire!;
    expect(clipTime(fire, -1, null)).toBe(0);
    expect(clipTime(fire, 2, null)).toBeLessThan(fire.duration);
    expect(clipTime(fire, 0.5, null)).toBeCloseTo((fire.duration - 1 / CLIP_FPS) / 2);
  });
});
