// Per-chunk mesh builder. Produces merged BufferGeometry with hidden-face
// culling — only faces exposed to air or a different see-through block are
// emitted. Opaque and translucent (water/glass) faces go into separate
// geometries so they can be drawn in the correct order.

import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT } from './world.js';
import { AIR, shouldDrawFace, isTranslucent, faceTile } from '../engine/blocks.js';
import { tileUV } from '../engine/textures.js';

// Six cube faces. Each: corner offsets (CCW seen from outside), normal,
// the tile-face category, and a baked brightness for fake directional shading.
const FACES = [
  { // +X
    dir: [1, 0, 0], face: 'side', bright: 0.8,
    corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
  },
  { // -X
    dir: [-1, 0, 0], face: 'side', bright: 0.8,
    corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
  },
  { // +Y (top)
    dir: [0, 1, 0], face: 'top', bright: 1.0,
    corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
  },
  { // -Y (bottom)
    dir: [0, -1, 0], face: 'bottom', bright: 0.5,
    corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  },
  { // +Z
    dir: [0, 0, 1], face: 'side', bright: 0.65,
    corners: [[1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1]],
  },
  { // -Z
    dir: [0, 0, -1], face: 'side', bright: 0.65,
    corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
  },
];

function localIndex(x, y, z) {
  return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
}

function makeGeometry(positions, normals, uvs, colors, indices) {
  if (indices.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeBoundingSphere();
  return g;
}

// Build geometry for one chunk. `arr` is the chunk's block array; the world is
// used to query neighbouring blocks (including across chunk borders).
export function buildChunkGeometry(world, cx, cz, arr) {
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;

  const op = { pos: [], norm: [], uv: [], col: [], idx: [] };
  const tr = { pos: [], norm: [], uv: [], col: [], idx: [] };

  const emit = (bucket, wx, y, wz, f, id) => {
    const start = bucket.pos.length / 3;
    const [col, row] = faceTile(id, f.face);
    const uvRect = tileUV(col, row);
    // UV corners ordered to match the corner winding below.
    const uvCorners = [
      [uvRect.u1, uvRect.v0],
      [uvRect.u0, uvRect.v0],
      [uvRect.u0, uvRect.v1],
      [uvRect.u1, uvRect.v1],
    ];
    for (let c = 0; c < 4; c++) {
      const cr = f.corners[c];
      bucket.pos.push(wx + cr[0], y + cr[1], wz + cr[2]);
      bucket.norm.push(f.dir[0], f.dir[1], f.dir[2]);
      bucket.uv.push(uvCorners[c][0], uvCorners[c][1]);
      bucket.col.push(f.bright, f.bright, f.bright);
    }
    bucket.idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };

  for (let lx = 0; lx < CHUNK_SIZE; lx++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        const id = arr[localIndex(lx, y, lz)];
        if (id === AIR) continue;
        const wx = ox + lx;
        const wz = oz + lz;
        const bucket = isTranslucent(id) ? tr : op;
        for (let fi = 0; fi < FACES.length; fi++) {
          const f = FACES[fi];
          const nb = world.getBlock(wx + f.dir[0], y + f.dir[1], wz + f.dir[2]);
          if (shouldDrawFace(id, nb)) emit(bucket, wx, y, wz, f, id);
        }
      }
    }
  }

  return {
    opaque: makeGeometry(op.pos, op.norm, op.uv, op.col, op.idx),
    translucent: makeGeometry(tr.pos, tr.norm, tr.uv, tr.col, tr.idx),
  };
}
