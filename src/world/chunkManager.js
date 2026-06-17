// Loads/unloads chunk meshes around the player and rebuilds dirty chunks.
// Builds a limited number of chunks per frame to avoid stutter on mobile.

import * as THREE from 'three';
import { World, CHUNK_SIZE, chunkKey } from './world.js';
import { buildChunkGeometry } from './chunk.js';
import { buildAtlasTexture } from '../engine/textures.js';

const MAX_BUILDS_PER_FRAME = 2;

export class ChunkManager {
  constructor(scene, world, renderDistance = 6) {
    this.scene = scene;
    this.world = world;
    this.renderDistance = renderDistance;
    this.meshes = new Map(); // key -> { opaque, translucent }

    const atlas = buildAtlasTexture();
    this.opaqueMaterial = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
    });
    this.translucentMaterial = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.buildQueue = [];
  }

  setRenderDistance(d) {
    this.renderDistance = d;
  }

  // Called each frame with the player's world position.
  update(px, pz) {
    const ccx = Math.floor(px / CHUNK_SIZE);
    const ccz = Math.floor(pz / CHUNK_SIZE);
    const R = this.renderDistance;

    // Determine the set of chunks that should be loaded.
    const wanted = new Set();
    const candidates = [];
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const dist = dx * dx + dz * dz;
        if (dist > R * R) continue;
        const cx = ccx + dx;
        const cz = ccz + dz;
        const key = chunkKey(cx, cz);
        wanted.add(key);
        if (!this.meshes.has(key)) candidates.push({ cx, cz, key, dist });
      }
    }

    // Unload chunks outside range.
    for (const key of Array.from(this.meshes.keys())) {
      if (!wanted.has(key)) this.disposeChunk(key);
    }

    // Apply dirty (edited) chunks immediately-ish by queueing them first.
    const dirty = this.world.consumeDirty();
    for (const key of dirty) {
      if (wanted.has(key)) {
        const [cx, cz] = key.split(',').map(Number);
        candidates.unshift({ cx, cz, key, dist: -1, force: true });
      }
    }

    // Build nearest-first, a few per frame.
    candidates.sort((a, b) => a.dist - b.dist);
    let built = 0;
    for (const c of candidates) {
      if (built >= MAX_BUILDS_PER_FRAME && !c.force) break;
      this.buildChunk(c.cx, c.cz, c.key);
      built++;
    }
  }

  buildChunk(cx, cz, key) {
    const arr = this.world.getChunk(cx, cz);
    const { opaque, translucent } = buildChunkGeometry(this.world, cx, cz, arr);

    // Replace existing meshes if rebuilding a dirty chunk.
    this.disposeChunk(key, /*keepEntry*/ false);

    const entry = {};
    if (opaque) {
      const m = new THREE.Mesh(opaque, this.opaqueMaterial);
      m.frustumCulled = true;
      this.scene.add(m);
      entry.opaque = m;
    }
    if (translucent) {
      const m = new THREE.Mesh(translucent, this.translucentMaterial);
      m.frustumCulled = true;
      this.scene.add(m);
      entry.translucent = m;
    }
    this.meshes.set(key, entry);
  }

  disposeChunk(key, removeEntry = true) {
    const entry = this.meshes.get(key);
    if (!entry) return;
    if (entry.opaque) {
      this.scene.remove(entry.opaque);
      entry.opaque.geometry.dispose();
    }
    if (entry.translucent) {
      this.scene.remove(entry.translucent);
      entry.translucent.geometry.dispose();
    }
    if (removeEntry) this.meshes.delete(key);
  }

  // Force-rebuild every currently loaded chunk (e.g. after loading a save).
  rebuildAll() {
    for (const key of Array.from(this.meshes.keys())) this.disposeChunk(key);
  }
}
