import { describe, it, expect } from 'vitest';
import { raycastVoxels } from './dda';

describe('raycastVoxels (Amanatides & Woo)', () => {
  // A single solid block at (5,0,0).
  const isSolid = (x: number, y: number, z: number) => x === 5 && y === 0 && z === 0;

  it('hits a block along +X and reports the adjacent place cell + normal', () => {
    const hit = raycastVoxels({ x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 10, isSolid);
    expect(hit.hit).toBe(true);
    expect(hit.block).toEqual({ x: 5, y: 0, z: 0 });
    expect(hit.place).toEqual({ x: 4, y: 0, z: 0 });
    expect(hit.normal).toEqual({ x: -1, y: 0, z: 0 });
  });

  it('misses when nothing is in range', () => {
    const hit = raycastVoxels({ x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 3, isSolid);
    expect(hit.hit).toBe(false);
  });

  it('misses when the ray points away from the block', () => {
    const hit = raycastVoxels({ x: 0.5, y: 0.5, z: 0.5 }, { x: -1, y: 0, z: 0 }, 10, isSolid);
    expect(hit.hit).toBe(false);
  });
});
