// The voxel world: chunk storage, procedural terrain + tree generation, and
// get/set block APIs. Edits made by the player are stored as deltas so they can
// be saved compactly and re-applied over freshly generated terrain.

import { SimplexNoise, hash2 } from '../engine/noise.js';
import { AIR } from '../engine/blocks.js';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const WATER_LEVEL = 22;

const BASE_HEIGHT = 26;
const HILL_AMPLITUDE = 14;

// Block ids used by the generator (mirror blocks.js).
const B = { GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7, BEDROCK: 14 };

export function chunkKey(cx, cz) {
  return cx + ',' + cz;
}

function localIndex(x, y, z) {
  return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
}

export class World {
  constructor(seed = 1337) {
    this.seed = seed >>> 0;
    this.noise = new SimplexNoise(this.seed);
    this.treeNoise = new SimplexNoise(this.seed + 1);
    this.chunks = new Map();      // key -> Uint8Array
    this.edits = new Map();       // "x,y,z" -> blockId (player modifications)
    this.dirty = new Set();       // chunk keys needing remesh
  }

  // Surface height (top solid y) for a world column.
  heightAt(x, z) {
    const n = this.noise.fbm2D(x * 0.012, z * 0.012, 4, 2, 0.5); // [-1,1]
    const detail = this.noise.fbm2D(x * 0.05, z * 0.05, 2, 2, 0.5) * 2.5;
    let h = BASE_HEIGHT + n * HILL_AMPLITUDE + detail;
    return Math.max(1, Math.min(WORLD_HEIGHT - 1, Math.floor(h)));
  }

  // Generate the base (unedited) block id at a world position.
  generateBlock(x, y, z, surface) {
    if (y === 0) return B.BEDROCK;
    const h = surface !== undefined ? surface : this.heightAt(x, z);
    if (y > h) {
      return y <= WATER_LEVEL ? B.WATER : AIR;
    }
    if (y === h) {
      if (h <= WATER_LEVEL + 1) return B.SAND; // beaches / underwater
      return B.GRASS;
    }
    if (y >= h - 3) {
      return h <= WATER_LEVEL + 1 ? B.SAND : B.DIRT;
    }
    return B.STONE;
  }

  // Build (or fetch cached) chunk block array, applying terrain, trees, edits.
  getChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    let arr = this.chunks.get(key);
    if (arr) return arr;

    arr = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
    const ox = cx * CHUNK_SIZE;
    const oz = cz * CHUNK_SIZE;

    // Terrain columns.
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wx = ox + lx;
        const wz = oz + lz;
        const surface = this.heightAt(wx, wz);
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          arr[localIndex(lx, y, lz)] = this.generateBlock(wx, y, wz, surface);
        }
      }
    }

    // Trees. Check a margin around the chunk so canopies can spill across
    // borders consistently.
    for (let lx = -2; lx < CHUNK_SIZE + 2; lx++) {
      for (let lz = -2; lz < CHUNK_SIZE + 2; lz++) {
        const wx = ox + lx;
        const wz = oz + lz;
        if (!this.hasTreeAt(wx, wz)) continue;
        const surface = this.heightAt(wx, wz);
        if (surface <= WATER_LEVEL + 1) continue; // no trees in water/beach
        this.stampTree(arr, ox, oz, wx, surface, wz);
      }
    }

    // Apply player edits that fall in this chunk.
    for (const [pos, id] of this.edits) {
      const [ex, ey, ez] = pos.split(',').map(Number);
      if (ex >= ox && ex < ox + CHUNK_SIZE && ez >= oz && ez < oz + CHUNK_SIZE && ey >= 0 && ey < WORLD_HEIGHT) {
        arr[localIndex(ex - ox, ey, ez - oz)] = id;
      }
    }

    this.chunks.set(key, arr);
    return arr;
  }

  // Deterministic tree placement: sparse, seeded by world coords.
  hasTreeAt(wx, wz) {
    // density mask from low-freq noise, then a per-cell hash gate.
    const density = this.treeNoise.noise2D(wx * 0.04, wz * 0.04);
    if (density < 0.1) return false;
    return hash2(wx, wz, this.seed) > 0.978;
  }

  // Write a tree (trunk + canopy) into arr if blocks fall inside this chunk.
  stampTree(arr, ox, oz, wx, surface, wz) {
    const trunkH = 4 + (Math.floor(hash2(wx, wz, this.seed + 7) * 3));
    const topY = surface + trunkH;
    const put = (x, y, z, id, overwrite = true) => {
      if (y < 0 || y >= WORLD_HEIGHT) return;
      const lx = x - ox, lz = z - oz;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
      const i = localIndex(lx, y, lz);
      if (!overwrite && arr[i] !== AIR) return;
      arr[i] = id;
    };
    // canopy: a 5x5 ball-ish cluster around the top.
    for (let dy = -2; dy <= 1; dy++) {
      const r = dy <= -1 ? 2 : 1;
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && r === 2) continue; // round corners
          put(wx + dx, topY + dy, wz + dz, B.LEAVES, false);
        }
      }
    }
    // trunk
    for (let y = surface + 1; y <= topY; y++) put(wx, y, wz, B.LOG, true);
  }

  // World-space get/set ----------------------------------------------------
  getBlock(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const arr = this.getChunk(cx, cz);
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    return arr[localIndex(lx, y, lz)];
  }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= WORLD_HEIGHT) return;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const arr = this.getChunk(cx, cz);
    const lx = x - cx * CHUNK_SIZE;
    const lz = z - cz * CHUNK_SIZE;
    arr[localIndex(lx, y, lz)] = id;
    this.edits.set(x + ',' + y + ',' + z, id);

    // Mark this chunk and any neighbours sharing the edited face as dirty.
    this.markDirty(cx, cz);
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1) this.markDirty(cx, cz + 1);
  }

  markDirty(cx, cz) {
    this.dirty.add(chunkKey(cx, cz));
  }

  consumeDirty() {
    const out = Array.from(this.dirty);
    this.dirty.clear();
    return out;
  }

  // Serialize edits + seed for saving.
  serializeEdits() {
    const obj = {};
    for (const [k, v] of this.edits) obj[k] = v;
    return obj;
  }

  loadEdits(obj) {
    this.edits.clear();
    if (obj) for (const k in obj) this.edits.set(k, obj[k]);
    // Drop cached chunks so they regenerate with edits applied.
    this.chunks.clear();
  }
}
