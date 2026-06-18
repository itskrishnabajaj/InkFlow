/**
 * Amanatides & Woo voxel ray traversal (DDA). Salvaged and generalized from the
 * prototype's player raycast: it now takes a `isSolid` sampler so it has no knowledge
 * of any particular world representation — pure math, reusable by targeting, physics
 * line-of-sight, AI vision, etc.
 */

import type { Vec3 } from './vec3';

export interface VoxelHit {
  hit: boolean;
  /** Coordinates of the solid voxel that was hit. */
  block: Vec3;
  /** The empty voxel adjacent to the hit face (where a block would be placed). */
  place: Vec3;
  /** Face normal of the hit (points out of the hit block toward the ray origin). */
  normal: Vec3;
  /** Distance along the ray to the hit. */
  distance: number;
}

const sign = Math.sign;

export function raycastVoxels(
  origin: Vec3,
  dir: Vec3,
  maxDist: number,
  isSolid: (x: number, y: number, z: number) => boolean,
): VoxelHit {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = sign(dir.x);
  const stepY = sign(dir.y);
  const stepZ = sign(dir.z);

  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

  const distToBoundary = (o: number, step: number): number => {
    if (step > 0) return Math.floor(o) + 1 - o;
    if (step < 0) return o - Math.floor(o);
    return Infinity;
  };

  let tMaxX = tDeltaX === Infinity ? Infinity : tDeltaX * distToBoundary(origin.x, stepX);
  let tMaxY = tDeltaY === Infinity ? Infinity : tDeltaY * distToBoundary(origin.y, stepY);
  let tMaxZ = tDeltaZ === Infinity ? Infinity : tDeltaZ * distToBoundary(origin.z, stepZ);

  let px = x, py = y, pz = z;
  let t = 0;
  let guard = 0;
  const normal: Vec3 = { x: 0, y: 0, z: 0 };

  while (t <= maxDist && guard++ < 512) {
    if (isSolid(x, y, z)) {
      normal.x = px - x;
      normal.y = py - y;
      normal.z = pz - z;
      return {
        hit: true,
        block: { x, y, z },
        place: { x: px, y: py, z: pz },
        normal,
        distance: t,
      };
    }
    px = x; py = y; pz = z;
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX;
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY;
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ;
    }
  }

  return {
    hit: false,
    block: { x, y, z },
    place: { x: px, y: py, z: pz },
    normal,
    distance: t,
  };
}
