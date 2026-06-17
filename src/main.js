// InkCraft — entry point. Creates the renderer/scene, wires the world, player,
// controls, HUD, audio and day/night sky, then runs the game loop.

import * as THREE from 'three';
import { World, WORLD_HEIGHT } from './world/world.js';
import { ChunkManager } from './world/chunkManager.js';
import { Player } from './player/player.js';
import { Controls } from './player/controls.js';
import { Hud } from './ui/hud.js';
import { Sfx } from './audio/sfx.js';
import { Sky } from './world/sky.js';
import { AIR } from './engine/blocks.js';
import { saveGame, loadGame, clearSave } from './save/storage.js';

const BEDROCK = 14;
const DEFAULT_RENDER_DISTANCE = 6;

function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      72, window.innerWidth / window.innerHeight, 0.1, 1000);

    this.renderDistance = DEFAULT_RENDER_DISTANCE;
    this.paused = false;
    this.clock = new THREE.Clock();
    this.frames = 0;
    this.fpsTime = 0;
    this.lastSave = 0;

    this.sfx = new Sfx();
    this.sky = new Sky(this.scene);
    this.hud = new Hud();

    this._initWorldFromSave();

    this.chunks = new ChunkManager(this.scene, this.world, this.renderDistance);
    this.sky.setFogFar(this.renderDistance * 16 * 0.95);

    this._initHighlight();
    this._initControls();
    this._wireHud();
    this._initEvents();

    // Hide the loading screen once the first frames are ready.
    requestAnimationFrame(() => {
      const ls = document.getElementById('loading');
      if (ls) ls.classList.add('hidden');
    });

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  _initWorldFromSave() {
    const save = loadGame();
    const seed = save ? save.seed : randomSeed();
    this.world = new World(seed);
    this.player = new Player(this.camera, this.world);

    if (save) {
      this.world.loadEdits(save.edits);
      const p = save.player;
      if (p) {
        this.player.position.set(p.x, p.y, p.z);
        this.player.yaw = p.yaw;
        this.player.pitch = p.pitch;
        this.player.syncCamera();
      }
      if (typeof save.hotbarIndex === 'number') this.hud.setActive(save.hotbarIndex);
    } else {
      // Drop the player onto the surface near origin.
      const h = this.world.heightAt(8, 8);
      this.player.position.set(8, h + 3, 8);
      this.player.syncCamera();
    }
  }

  _initHighlight() {
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.003, 1.003, 1.003));
    const mat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    this.highlight = new THREE.LineSegments(geo, mat);
    this.highlight.visible = false;
    this.scene.add(this.highlight);
  }

  _initControls() {
    this.controls = new Controls(this.hud.el);

    this.controls.on('break', () => this.breakBlock());
    this.controls.on('place', () => this.placeBlock());
    this.controls.on('pick', (i) => {
      this.hud.setActive(i);
      this.sfx.click();
    });
  }

  _wireHud() {
    this.hud.setRenderDistance(this.renderDistance);
    this.hud.on('select', () => this.sfx.click());
    this.hud.on('save', () => {
      this.doSave();
      this.hud.toast('World saved');
    });
    this.hud.on('newWorld', () => this.newWorld());
    this.hud.on('mute', (m) => this.sfx.setMuted(m));
    this.hud.on('pause', (p) => { this.paused = p; });
    this.hud.on('renderDistance', (v) => {
      this.renderDistance = v;
      this.chunks.setRenderDistance(v);
      this.sky.setFogFar(v * 16 * 0.95);
    });
  }

  _initEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    // Unlock audio on first interaction (mobile autoplay policy).
    const unlock = () => { this.sfx.resume(); window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.doSave();
    });
    window.addEventListener('beforeunload', () => this.doSave());
  }

  breakBlock() {
    const hit = this.player.raycast();
    if (!hit.hit) return;
    const { x, y, z } = hit.block;
    if (this.world.getBlock(x, y, z) === BEDROCK) return; // unbreakable floor
    this.world.setBlock(x, y, z, AIR);
    this.sfx.break();
  }

  placeBlock() {
    const hit = this.player.raycast();
    if (!hit.hit) return;
    const { x, y, z } = hit.place;
    if (y < 0 || y >= WORLD_HEIGHT) return;
    // Don't place a block where the player camera currently is.
    const px = Math.floor(this.player.position.x);
    const py = Math.floor(this.player.position.y);
    const pz = Math.floor(this.player.position.z);
    if (x === px && y === py && z === pz) return;
    if (this.world.getBlock(x, y, z) !== AIR) return;
    this.world.setBlock(x, y, z, this.hud.activeBlockId());
    this.sfx.place();
  }

  doSave() {
    saveGame(this.world, this.player, this.hud.activeIndex);
  }

  newWorld() {
    clearSave();
    this.world = new World(randomSeed());
    this.player = new Player(this.camera, this.world);
    const h = this.world.heightAt(8, 8);
    this.player.position.set(8, h + 3, 8);
    this.player.syncCamera();
    // Rebuild rendering against the new world.
    this.chunks.rebuildAll();
    this.chunks.world = this.world;
    this.hud.toast('New world generated');
  }

  updateHighlight() {
    const hit = this.player.raycast();
    if (hit.hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.block.x + 0.5, hit.block.y + 0.5, hit.block.z + 0.5);
    } else {
      this.highlight.visible = false;
    }
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);

    this.controls.update();
    if (!this.paused) {
      const look = this.controls.consumeLook();
      if (look.dx || look.dy) this.player.addLook(look.dx, look.dy);
      this.player.update(dt, this.controls.state);
    } else {
      this.controls.consumeLook(); // discard while paused
    }

    this.sky.update(dt);
    this.chunks.update(this.player.position.x, this.player.position.z);
    this.updateHighlight();
    this.hud.setCoords(this.player.position.x, this.player.position.y, this.player.position.z);

    // FPS counter (updated ~2x/sec).
    this.frames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.hud.setFps(Math.round(this.frames / this.fpsTime));
      this.frames = 0;
      this.fpsTime = 0;
    }

    // Auto-save every 15 seconds of play.
    this.lastSave += dt;
    if (this.lastSave >= 15) { this.doSave(); this.lastSave = 0; }

    this.renderer.render(this.scene, this.camera);
  }
}

// Register the service worker for offline play (non-blocking).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

// Boot.
window.addEventListener('DOMContentLoaded', () => {
  try {
    new Game();
  } catch (e) {
    console.error(e);
    const ls = document.getElementById('loading');
    if (ls) ls.querySelector('.loading-text').textContent = 'Error: ' + e.message;
  }
});
