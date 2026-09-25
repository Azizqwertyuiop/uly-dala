/*
 * Синий шум методом void-and-cluster (Ulichney, 1993) — для дизеринга без полос (раздел 6).
 * Детерминированный: одинаковый результат при каждом запуске.
 */
export function blueNoise(size = 64, sigma = 1.9) {
  const n = size * size;
  const kernelR = Math.ceil(sigma * 3);
  const kernel = [];
  for (let dy = -kernelR; dy <= kernelR; dy++)
    for (let dx = -kernelR; dx <= kernelR; dx++)
      kernel.push([dx, dy, Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))]);

  const energy = new Float64Array(n);
  const on = new Uint8Array(n);
  const splat = (i, sign) => {
    const x = i % size;
    const y = (i / size) | 0;
    for (const [dx, dy, w] of kernel) {
      energy[((y + dy + size) % size) * size + ((x + dx + size) % size)] += sign * w;
    }
  };

  // Детерминированный начальный узор: ~10% точек.
  let seed = 1;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const initial = Math.floor(n * 0.1);
  for (let k = 0; k < initial; k++) {
    let i;
    do i = Math.floor(rand() * n);
    while (on[i]);
    on[i] = 1;
    splat(i, 1);
  }
  const argmax = (want) => {
    let best = -1;
    let value = -Infinity;
    for (let i = 0; i < n; i++) {
      if (on[i] === want && energy[i] > value) {
        value = energy[i];
        best = i;
      }
    }
    return best;
  };
  const argmin = (want) => {
    let best = -1;
    let value = Infinity;
    for (let i = 0; i < n; i++) {
      if (on[i] === want && energy[i] < value) {
        value = energy[i];
        best = i;
      }
    }
    return best;
  };
  // Выравнивание начального узора.
  for (;;) {
    const cluster = argmax(1);
    on[cluster] = 0;
    splat(cluster, -1);
    const voidIdx = argmin(0);
    if (voidIdx === cluster) {
      on[cluster] = 1;
      splat(cluster, 1);
      break;
    }
    on[voidIdx] = 1;
    splat(voidIdx, 1);
  }

  const rank = new Int32Array(n).fill(-1);
  const snapshot = on.slice();
  const snapEnergy = energy.slice();
  // Фаза 1: ранги уже поставленных точек (убираем самые «кучные»).
  let ones = initial;
  while (ones > 0) {
    const cluster = argmax(1);
    on[cluster] = 0;
    splat(cluster, -1);
    ones--;
    rank[cluster] = ones;
  }
  on.set(snapshot);
  energy.set(snapEnergy);
  // Фаза 2 и 3: заполняем самые большие «пустоты».
  for (let r = initial; r < n; r++) {
    const voidIdx = argmin(0);
    on[voidIdx] = 1;
    splat(voidIdx, 1);
    rank[voidIdx] = r;
  }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.floor((rank[i] / n) * 256);
  return out;
}
