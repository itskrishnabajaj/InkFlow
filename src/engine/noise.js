// Self-contained 2D simplex noise + a tiny seeded PRNG and hash.
// Based on the classic public-domain Stefan Gustavson / Jonas Wagner implementation.
// No external dependencies so the game runs from static files with no build step.

// --- Seeded PRNG (mulberry32): deterministic numbers from a single seed ---
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deterministic hash for "should a tree spawn here" style decisions.
// Returns a float in [0, 1) from integer coords + seed.
export function hash2(x, y, seed) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 362437;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const GRAD2 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [1, 0], [-1, 0],
  [0, 1], [0, -1], [0, 1], [0, -1],
];

export class SimplexNoise {
  constructor(seed = 0) {
    const rand = mulberry32(seed);
    // Build a shuffled permutation table.
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  // 2D simplex noise in roughly [-1, 1].
  noise2D(xin, yin) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const perm = this.perm;
    const permMod12 = this.permMod12;

    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;

    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi0 = permMod12[ii + perm[jj]];
      t0 *= t0;
      n0 = t0 * t0 * (GRAD2[gi0][0] * x0 + GRAD2[gi0][1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi1 = permMod12[ii + i1 + perm[jj + j1]];
      t1 *= t1;
      n1 = t1 * t1 * (GRAD2[gi1][0] * x1 + GRAD2[gi1][1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi2 = permMod12[ii + 1 + perm[jj + 1]];
      t2 *= t2;
      n2 = t2 * t2 * (GRAD2[gi2][0] * x2 + GRAD2[gi2][1] * y2);
    }
    return 70 * (n0 + n1 + n2);
  }

  // Fractal Brownian motion: layered noise for natural-looking terrain.
  // Returns a value in roughly [-1, 1].
  fbm2D(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amplitude = 1;
    let frequency = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amplitude * this.noise2D(x * frequency, y * frequency);
      norm += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return sum / norm;
  }
}
