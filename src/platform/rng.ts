/**
 * Deterministic pseudo-random number generation.
 *
 * The whole simulation must be reproducible from a single world seed (principle #4),
 * and future multiplayer needs identical streams across clients. We therefore derive
 * independent, named sub-streams from the world seed so that, e.g., terrain generation
 * and NPC decisions never consume from the same sequence and desync each other.
 *
 * `mulberry32` is salvaged from the original prototype's noise module.
 */

/** Fast 32-bit PRNG. Returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a 32-bit unsigned integer (FNV-1a). */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic 2D coordinate hash → float in [0, 1). Salvaged from the prototype. */
export function hash2(x: number, y: number, seed: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 362437;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A named random stream with convenience helpers. */
export class RandomStream {
  private next: () => number;

  constructor(public readonly seed: number) {
    this.next = mulberry32(seed);
  }

  /** Float in [0, 1). */
  float(): number {
    return this.next();
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Integer in [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** True with the given probability. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }
}

/**
 * Owns the world seed and hands out independent named streams. Derive one stream
 * per subsystem (e.g. `streams.stream('terrain')`, `streams.stream('npc.spawn')`).
 */
export class SeedSource {
  constructor(public readonly worldSeed: number) {}

  /** Derive a deterministic sub-seed for a named stream. */
  subSeed(name: string): number {
    return (this.worldSeed ^ hashString(name)) >>> 0;
  }

  stream(name: string): RandomStream {
    return new RandomStream(this.subSeed(name));
  }
}
