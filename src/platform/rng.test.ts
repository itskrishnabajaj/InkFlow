import { describe, it, expect } from 'vitest';
import { mulberry32, hash2, SeedSource, RandomStream } from './rng';

describe('rng', () => {
  it('mulberry32 is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('produces floats in [0,1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('hash2 is in [0,1) and stable', () => {
    expect(hash2(3, 4, 99)).toBe(hash2(3, 4, 99));
    for (let i = 0; i < 500; i++) {
      const v = hash2(i, i * 3, 1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('SeedSource derives independent, reproducible streams', () => {
    const s1 = new SeedSource(42);
    const s2 = new SeedSource(42);
    expect(s1.subSeed('terrain')).toBe(s2.subSeed('terrain'));
    expect(s1.subSeed('terrain')).not.toBe(s1.subSeed('npc.spawn'));

    const t1 = s1.stream('terrain');
    const t2 = s2.stream('terrain');
    for (let i = 0; i < 50; i++) expect(t1.float()).toBe(t2.float());
  });

  it('RandomStream helpers stay in range', () => {
    const r = new RandomStream(1);
    for (let i = 0; i < 200; i++) {
      expect(r.int(2, 5)).toBeGreaterThanOrEqual(2);
      expect(r.int(2, 5)).toBeLessThanOrEqual(5);
      const v = r.range(-3, 3);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(3);
    }
  });
});
