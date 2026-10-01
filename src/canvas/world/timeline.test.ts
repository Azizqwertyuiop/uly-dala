import { describe, expect, it } from "vitest";
import { ZONES } from "../../../scripts/lib/fazenda-zones.mjs";
import {
  FLYOVER_SECONDS as VIDEO_SECONDS,
  FLYOVER_ZONES as VIDEO_ZONES,
} from "../../../scripts/lib/flyover-frames.mjs";
import {
  FLYOVER_SECONDS,
  FLYOVER_ZONES,
  flyoverPosition,
  flyoverTime,
  LIGHT_END,
  WORLD_ZONES,
  worldLight,
  ZONE_POSITIONS,
  ZONES_END,
  zoneAt,
} from "./timeline";

describe("таймлайн фазенды", () => {
  it("зоны и время облёта совпадают с заглушками сплатов и видео", () => {
    expect(ZONE_POSITIONS).toEqual(ZONES);
    expect(FLYOVER_SECONDS).toBe(VIDEO_SECONDS);
    expect([...FLYOVER_ZONES]).toEqual(VIDEO_ZONES);
  });

  it("«свет» — в начале дорожки, дальше кадр целиком", () => {
    expect(worldLight(0)).toBe(0);
    expect(worldLight(LIGHT_END / 2)).toBeCloseTo(0.5);
    expect(worldLight(LIGHT_END)).toBe(1);
    expect(worldLight(0.9)).toBe(1);
  });

  it("облёт непрерывен, не убывает и проходит все зоны", () => {
    let prev = -Infinity;
    const visited = new Set<number>();
    for (let i = 0; i <= 2000; i++) {
      const s = flyoverPosition(i / 2000);
      expect(s).toBeGreaterThanOrEqual(prev - 1e-9);
      if (prev > -Infinity) expect(s - prev).toBeLessThan(0.02);
      prev = s;
      visited.add(zoneAt(s));
    }
    expect([...visited]).toEqual(WORLD_ZONES.map((_, i) => i));
  });

  it("на остановке камера почти стоит, между зонами — едет", () => {
    const span = (ZONES_END - LIGHT_END) / WORLD_ZONES.length;
    for (let k = 0; k < WORLD_ZONES.length; k++) {
      const mid = LIGHT_END + span * (k + 0.5);
      expect(Math.abs(flyoverPosition(mid) - k)).toBeLessThan(0.01);
      const hold = flyoverPosition(mid + span * 0.25) - flyoverPosition(mid - span * 0.25);
      expect(hold).toBeLessThan(0.2);
    }
    const between =
      flyoverPosition(LIGHT_END + span * 1.1) - flyoverPosition(LIGHT_END + span * 0.9);
    expect(between).toBeGreaterThan(0.3);
  });

  it("время видео: зона k — FLYOVER_ZONES[k], в пределах файла", () => {
    WORLD_ZONES.forEach((_, k) => expect(flyoverTime(k)).toBeCloseTo(FLYOVER_ZONES[k]!));
    expect(flyoverTime(-1)).toBe(0);
    expect(flyoverTime(10)).toBeLessThan(FLYOVER_SECONDS);
  });
});
