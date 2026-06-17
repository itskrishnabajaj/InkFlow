// Creative-mode player: a free-flying camera with yaw/pitch look and a voxel
// raycast for targeting the block under the crosshair (Amanatides & Woo DDA).

import * as THREE from 'three';
import { isAir } from '../engine/blocks.js';
import { WORLD_HEIGHT } from '../world/world.js';

const MOVE_SPEED = 7;      // blocks/sec
const BOOST_MULT = 2.4;    // double-tap / sprint multiplier
const VERTICAL_SPEED = 7;
const LOOK_SENS = 0.0028;  // radians per pixel
const MAX_PITCH = Math.PI / 2 - 0.01;
export const REACH = 7;    // max block interaction distance

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.position = new THREE.Vector3(8, WORLD_HEIGHT * 0.6, 8);
    this.yaw = 0;   // around Y
    this.pitch = 0; // up/down
    this.boost = false;
    this._dir = new THREE.Vector3();
    this.syncCamera();
  }

  syncCamera() {
    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  addLook(dx, dy) {
    this.yaw -= dx * LOOK_SENS;
    this.pitch -= dy * LOOK_SENS;
    this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
  }

  // input: { moveX, moveZ (-1..1), up, down, boost }
  update(dt, input) {
    const speed = (input.boost ? MOVE_SPEED * BOOST_MULT : MOVE_SPEED) * dt;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);

    // moveZ: forward(+)/back(-). forward = -Z rotated by yaw.
    // moveX: strafe right(+)/left(-).
    const fx = -sin, fz = -cos; // forward
    const rx = cos, rz = -sin;  // right

    this.position.x += (fx * input.moveZ + rx * input.moveX) * speed;
    this.position.z += (fz * input.moveZ + rz * input.moveX) * speed;

    let vy = 0;
    if (input.up) vy += 1;
    if (input.down) vy -= 1;
    this.position.y += vy * VERTICAL_SPEED * dt;
    this.position.y = Math.max(1, Math.min(WORLD_HEIGHT - 1, this.position.y));

    this.syncCamera();
  }

  forwardVector() {
    this._dir.set(0, 0, -1).applyEuler(this.camera.rotation);
    return this._dir;
  }

  // Voxel DDA from the camera along its view direction.
  // Returns { hit, block:{x,y,z}, place:{x,y,z} } or { hit:false }.
  raycast(maxDist = REACH) {
    const origin = this.camera.position;
    const dir = this.forwardVector();

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = Math.sign(dir.x);
    const stepY = Math.sign(dir.y);
    const stepZ = Math.sign(dir.z);

    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

    const distToBoundary = (s, o, step) => {
      if (step > 0) return (Math.floor(o) + 1 - o);
      if (step < 0) return (o - Math.floor(o));
      return Infinity;
    };
    let tMaxX = tDeltaX === Infinity ? Infinity : tDeltaX * distToBoundary(dir.x, origin.x, stepX);
    let tMaxY = tDeltaY === Infinity ? Infinity : tDeltaY * distToBoundary(dir.y, origin.y, stepY);
    let tMaxZ = tDeltaZ === Infinity ? Infinity : tDeltaZ * distToBoundary(dir.z, origin.z, stepZ);

    let prev = { x, y, z };
    let t = 0;
    let guard = 0;
    while (t <= maxDist && guard++ < 256) {
      const id = this.world.getBlock(x, y, z);
      if (!isAir(id)) {
        return { hit: true, block: { x, y, z }, place: prev };
      }
      prev = { x, y, z };
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ;
      }
    }
    return { hit: false };
  }
}
