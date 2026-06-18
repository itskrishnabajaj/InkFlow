import { describe, it, expect } from 'vitest';
import { WorldClock, DAY_SECONDS, DAYS_PER_SEASON, SEASONS_PER_YEAR } from './clock';

describe('WorldClock', () => {
  it('advances time of day across a full cycle', () => {
    const c = new WorldClock();
    c.advance(DAY_SECONDS * 0.5);
    expect(c.timeOfDay).toBeCloseTo(0.5, 5);
    expect(c.day).toBe(0);
  });

  it('reports day boundaries crossed', () => {
    const c = new WorldClock();
    expect(c.advance(DAY_SECONDS * 0.9)).toBe(0);
    expect(c.advance(DAY_SECONDS * 0.2)).toBe(1); // crossed into day 1
    expect(c.day).toBe(1);
  });

  it('computes season and year', () => {
    const c = new WorldClock();
    c.advance(DAY_SECONDS * DAYS_PER_SEASON); // exactly one season
    expect(c.season).toBe(1);
    c.advance(DAY_SECONDS * DAYS_PER_SEASON * (SEASONS_PER_YEAR - 1));
    expect(c.year).toBe(1);
    expect(c.season).toBe(0);
  });

  it('timeScale pauses and scales', () => {
    const c = new WorldClock();
    c.timeScale = 0;
    c.advance(DAY_SECONDS);
    expect(c.gameSeconds).toBe(0);
    c.timeScale = 2;
    c.advance(10);
    expect(c.gameSeconds).toBe(20);
  });

  it('serializes and loads', () => {
    const c = new WorldClock();
    c.advance(1234);
    const data = c.serialize();
    const c2 = new WorldClock();
    c2.load(data);
    expect(c2.gameSeconds).toBe(1234);
  });
});
