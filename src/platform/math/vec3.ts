/**
 * Minimal plain-data 3D vector helpers. The simulation uses plain {x,y,z} objects
 * (not THREE.Vector3) so that core/sim never depends on the renderer. The render
 * layer converts these to THREE types when drawing.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export function add(a: Vec3, b: Vec3, out: Vec3 = vec3()): Vec3 {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
  out.z = a.z + b.z;
  return out;
}

export function sub(a: Vec3, b: Vec3, out: Vec3 = vec3()): Vec3 {
  out.x = a.x - b.x;
  out.y = a.y - b.y;
  out.z = a.z - b.z;
  return out;
}

export function scale(a: Vec3, s: number, out: Vec3 = vec3()): Vec3 {
  out.x = a.x * s;
  out.y = a.y * s;
  out.z = a.z * s;
  return out;
}

export function lengthSq(a: Vec3): number {
  return a.x * a.x + a.y * a.y + a.z * a.z;
}

export function length(a: Vec3): number {
  return Math.sqrt(lengthSq(a));
}

export function normalize(a: Vec3, out: Vec3 = vec3()): Vec3 {
  const len = length(a) || 1;
  out.x = a.x / len;
  out.y = a.y / len;
  out.z = a.z / len;
  return out;
}

export function copy(a: Vec3, out: Vec3 = vec3()): Vec3 {
  out.x = a.x;
  out.y = a.y;
  out.z = a.z;
  return out;
}

/** Linear interpolation, useful for render-side interpolation between sim ticks. */
export function lerp(a: Vec3, b: Vec3, t: number, out: Vec3 = vec3()): Vec3 {
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
  return out;
}
