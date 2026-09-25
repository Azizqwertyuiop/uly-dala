import { describe, expect, it } from "vitest";
import {
  decideQuality,
  detectInAppBrowser,
  DynamicResolution,
  FirefoxProbe,
  gpuMemoryLimitMb,
  isIOS,
  renderPixelRatio,
  RESOLUTION_MIN,
  type DeviceProfile,
} from "./capabilities";

const desktop: DeviceProfile = {
  webgl2: true,
  gpu: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)",
  memoryGb: 8,
  coarsePointer: false,
  saveData: false,
  network: "4g",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36",
  maxTouchPoints: 0,
  devicePixelRatio: 1,
  override: null,
};
const iphone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

const q = (patch: Partial<DeviceProfile>) => decideQuality({ ...desktop, ...patch });

describe("уровни качества", () => {
  it("дискретная видеокарта на десктопе — high", () => {
    expect(q({}).quality).toBe("high");
    expect(q({ gpu: "Apple M2 Pro" }).quality).toBe("high");
  });

  it("встроенная графика — medium", () => {
    expect(q({ gpu: "ANGLE (Intel, Intel(R) UHD Graphics 620)" }).quality).toBe("medium");
    expect(q({ gpu: "ANGLE (AMD, AMD Radeon(TM) Graphics)" }).quality).toBe("medium");
  });

  it("без WebGL2, программный рендер, экономия трафика, 2G, мало памяти — fallback", () => {
    expect(q({ webgl2: false }).quality).toBe("fallback");
    expect(q({ gpu: "Google SwiftShader" }).quality).toBe("fallback");
    expect(q({ saveData: true }).quality).toBe("fallback");
    expect(q({ network: "2g" }).quality).toBe("fallback");
    expect(q({ memoryGb: 2 }).quality).toBe("fallback");
  });

  it("iOS и тач — medium", () => {
    expect(q({ userAgent: iphone, coarsePointer: true, gpu: "Apple GPU" }).quality).toBe("medium");
    // iPadOS притворяется Mac, выдают точки касания.
    expect(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
  });

  it("встроенные браузеры WhatsApp / Telegram / Instagram — medium, на слабом устройстве — fallback", () => {
    expect(detectInAppBrowser(`${iphone} WhatsApp/2.24.1`)).toBe("whatsapp");
    expect(detectInAppBrowser("Mozilla/5.0 (Linux; Android 14) Telegram-Android/11.0")).toBe(
      "telegram",
    );
    expect(detectInAppBrowser(`${iphone} Instagram 320.0.0`)).toBe("instagram");
    expect(detectInAppBrowser(desktop.userAgent)).toBeNull();

    const inApp = q({
      userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/140 Instagram 320.0",
      coarsePointer: true,
    });
    expect(inApp.quality).toBe("medium");
    expect(inApp.reasons).toContain("in-app:instagram");
    expect(q({ userAgent: `${iphone} WhatsApp/2.24.1`, memoryGb: 4 }).quality).toBe("fallback");
  });

  it("?quality= переопределяет всё", () => {
    expect(q({ webgl2: false, override: "high" }).quality).toBe("high");
    expect(q({ override: "fallback" }).quality).toBe("fallback");
  });
});

describe("бюджет пикселей и DPR", () => {
  const ratio = (patch: Partial<Parameters<typeof renderPixelRatio>[0]>) =>
    renderPixelRatio({
      cssWidth: 1920,
      cssHeight: 1080,
      devicePixelRatio: 2,
      coarsePointer: false,
      quality: "high",
      scale: 1,
      ...patch,
    });

  it("high ≤ 3,5 Мп, medium ≤ 2 Мп — даже на 4K-экране", () => {
    const high = ratio({});
    expect(1920 * 1080 * high ** 2).toBeLessThanOrEqual(3.5e6 + 1);
    const medium = ratio({ quality: "medium" });
    expect(1920 * 1080 * medium ** 2).toBeLessThanOrEqual(2e6 + 1);
    const uhd = ratio({ cssWidth: 3840, cssHeight: 2160, devicePixelRatio: 1 });
    expect(3840 * 2160 * uhd ** 2).toBeLessThanOrEqual(3.5e6 + 1);
  });

  it("DPR ≤ 2 на десктопе и ≤ 1,5 на мобильных", () => {
    expect(ratio({ cssWidth: 800, cssHeight: 600, devicePixelRatio: 3 })).toBe(2);
    expect(
      ratio({
        cssWidth: 390,
        cssHeight: 844,
        devicePixelRatio: 3,
        coarsePointer: true,
        quality: "medium",
      }),
    ).toBe(1.5);
  });

  it("динамический масштаб уменьшает разрешение", () => {
    expect(ratio({ cssWidth: 800, cssHeight: 600, scale: 0.7 })).toBeCloseTo(1.4);
  });

  it("лимит памяти GPU: iOS — 300 МБ", () => {
    expect(gpuMemoryLimitMb("medium", true)).toBe(300);
    expect(gpuMemoryLimitMb("high", false)).toBeGreaterThan(300);
  });
});

describe("динамическое разрешение", () => {
  it("fps ниже цели за 60 кадров → вниз шагами по 0,1, но не ниже 0,7", () => {
    const dr = new DynamicResolution(58);
    const second = (fps: number) => {
      for (let i = 0; i < 60; i++) dr.sample(1 / fps);
    };
    second(40);
    expect(dr.scale).toBe(0.9);
    for (let i = 0; i < 10; i++) second(20);
    expect(dr.scale).toBe(RESOLUTION_MIN);
  });

  it("устойчиво выше цели с запасом — обратно вверх до 1", () => {
    const dr = new DynamicResolution(45);
    for (let i = 0; i < 60; i++) dr.sample(1 / 30);
    expect(dr.scale).toBe(0.9);
    for (let i = 0; i < 120; i++) dr.sample(1 / 60);
    expect(dr.scale).toBe(1);
  });

  it("Firefox: < 50 fps в первые 3 с → понижение", () => {
    const slow = new FirefoxProbe();
    while (!slow.sample(1 / 40));
    expect(slow.downgrade).toBe(true);
    const fast = new FirefoxProbe();
    while (!fast.sample(1 / 60));
    expect(fast.downgrade).toBe(false);
  });
});
