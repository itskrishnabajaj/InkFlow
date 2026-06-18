/**
 * Axis-aligned bounding box helpers for the character controller and entity physics
 * (used from Stage 4 onward). Pure data; no renderer dependency.
 */

import type { Vec3 } from './vec3';

export interface AABB {
  min: Vec3;
  max: Vec3;
}

export function aabbFromCenter(center: Vec3, half: Vec3): AABB {
  return {
    min: { x: center.x - half.x, y: center.y - half.y, z: center.z - half.z },
    max: { x: center.x + half.x, y: center.y + half.y, z: center.z + half.z },
  };
}

export function aabbTranslate(box: AABB, d: Vec3): AABB {
  return {
    min: { x: box.min.x + d.x, y: box.min.y + d.y, z: box.min.z + d.z },
    max: { x: box.max.x + d.x, y: box.max.y + d.y, z: box.max.z + d.z },
  };
}

export function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.min.x < b.max.x && a.max.x > b.min.x &&
    a.min.y < b.max.y && a.max.y > b.min.y &&
    a.min.z < b.max.z && a.max.z > b.min.z
  );
}

/** Iterate the integer voxel coordinates an AABB overlaps. */
export function forEachVoxelInAABB(
  box: AABB,
  fn: (x: number, y: number, z: number) => void,
): void {
  const x0 = Math.floor(box.min.x), x1 = Math.floor(box.max.x);
  const y0 = Math.floor(box.min.y), y1 = Math.floor(box.max.y);
  const z0 = Math.floor(box.min.z), z1 = Math.floor(box.max.z);
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) fn(x, y, z);
}
