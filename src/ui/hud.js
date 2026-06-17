// Heads-up display: hotbar (block selector with mini icons), FPS counter, mute
// toggle, and the pause/settings menu (Save, New World, render distance).
// Queries static elements from index.html and builds the dynamic hotbar.

import { HOTBAR_BLOCKS, BLOCKS, faceTile } from '../engine/blocks.js';
import { getAtlasCanvas, TILE } from '../engine/textures.js';

export class Hud {
  constructor() {
    this.el = {
      lookLayer: document.getElementById('look-layer'),
      joystick: document.getElementById('joystick'),
      knob: document.getElementById('knob'),
      btnUp: document.getElementById('btn-up'),
      btnDown: document.getElementById('btn-down'),
      btnBreak: document.getElementById('btn-break'),
      btnPlace: document.getElementById('btn-place'),
      hotbar: document.getElementById('hotbar'),
      fps: document.getElementById('fps'),
      coords: document.getElementById('coords'),
      menuBtn: document.getElementById('menu-btn'),
      muteBtn: document.getElementById('mute-btn'),
      menu: document.getElementById('menu'),
      btnSave: document.getElementById('btn-save'),
      btnNew: document.getElementById('btn-new'),
      btnResume: document.getElementById('btn-resume'),
      rdSlider: document.getElementById('rd-slider'),
      rdValue: document.getElementById('rd-value'),
      toast: document.getElementById('toast'),
    };
    this.activeIndex = 0;
    this.callbacks = {};
    this._buildHotbar();
    this._wireMenu();
  }

  on(name, fn) { this.callbacks[name] = fn; }

  _iconCanvas(blockId) {
    const atlas = getAtlasCanvas();
    const [col, row] = faceTile(blockId, 'side');
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlas, col * TILE, row * TILE, TILE, TILE, 0, 0, 32, 32);
    return c;
  }

  _buildHotbar() {
    this.el.hotbar.innerHTML = '';
    this.slots = [];
    HOTBAR_BLOCKS.forEach((blockId, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.appendChild(this._iconCanvas(blockId));
      const label = document.createElement('span');
      label.className = 'slot-num';
      label.textContent = (i + 1) <= 9 ? (i + 1) : '';
      slot.appendChild(label);
      slot.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.setActive(i);
        if (this.callbacks.select) this.callbacks.select(i);
      });
      this.el.hotbar.appendChild(slot);
      this.slots.push(slot);
    });
    this.setActive(0);
  }

  setActive(i) {
    this.activeIndex = i;
    this.slots.forEach((s, idx) => s.classList.toggle('active', idx === i));
  }

  activeBlockId() {
    return HOTBAR_BLOCKS[this.activeIndex];
  }

  setFps(v) { this.el.fps.textContent = v + ' fps'; }

  setCoords(x, y, z) {
    this.el.coords.textContent = `${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)}`;
  }

  toast(msg) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
  }

  _wireMenu() {
    const open = () => { this.el.menu.classList.add('open'); if (this.callbacks.pause) this.callbacks.pause(true); };
    const close = () => { this.el.menu.classList.remove('open'); if (this.callbacks.pause) this.callbacks.pause(false); };
    this.el.menuBtn.addEventListener('click', open);
    this.el.btnResume.addEventListener('click', close);

    this.el.btnSave.addEventListener('click', () => {
      if (this.callbacks.save) this.callbacks.save();
      close();
    });
    this.el.btnNew.addEventListener('click', () => {
      if (this.callbacks.newWorld) this.callbacks.newWorld();
      close();
    });
    this.el.muteBtn.addEventListener('click', () => {
      const muted = this.el.muteBtn.classList.toggle('muted');
      this.el.muteBtn.textContent = muted ? '🔇' : '🔊';
      if (this.callbacks.mute) this.callbacks.mute(muted);
    });
    this.el.rdSlider.addEventListener('input', () => {
      const v = parseInt(this.el.rdSlider.value, 10);
      this.el.rdValue.textContent = v;
      if (this.callbacks.renderDistance) this.callbacks.renderDistance(v);
    });
  }

  setRenderDistance(v) {
    this.el.rdSlider.value = v;
    this.el.rdValue.textContent = v;
  }
}
