// Procedurally draws every block texture onto a single canvas "atlas" and wraps
// it in a THREE.Texture. No image files needed — keeps the game fully
// self-contained. Pixel-art look via nearest-neighbor filtering.

import * as THREE from 'three';
import { mulberry32 } from './noise.js';

export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 2;
export const TILE = 16; // pixels per tile

// Small helpers ------------------------------------------------------------
function shade(hex, amt) {
  // amt in [-1,1]; positive lightens, negative darkens.
  const c = parseInt(hex.slice(1), 16);
  let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  if (amt >= 0) {
    r = r + (255 - r) * amt;
    g = g + (255 - g) * amt;
    b = b + (255 - b) * amt;
  } else {
    r = r * (1 + amt);
    g = g * (1 + amt);
    b = b * (1 + amt);
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// Fill a tile with a base color plus per-pixel speckle for texture.
function speckle(ctx, ox, oy, base, intensity, seed) {
  const rand = mulberry32(seed);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = (rand() - 0.5) * 2 * intensity;
      ctx.fillStyle = shade(base, n);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

// Tile draw functions. Each receives ctx and the pixel origin (ox,oy).
const TILES = {
  // row 0
  grassTop: (ctx, ox, oy) => speckle(ctx, ox, oy, '#5fae3b', 0.18, 11),
  grassSide: (ctx, ox, oy) => {
    speckle(ctx, ox, oy, '#8a663d', 0.18, 12); // dirt base
    // grass overhang on top few rows
    const rand = mulberry32(99);
    for (let x = 0; x < TILE; x++) {
      const h = 3 + Math.floor(rand() * 3);
      for (let y = 0; y < h; y++) {
        ctx.fillStyle = shade('#5fae3b', (rand() - 0.5) * 0.3);
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  },
  dirt: (ctx, ox, oy) => speckle(ctx, ox, oy, '#8a663d', 0.2, 13),
  stone: (ctx, ox, oy) => speckle(ctx, ox, oy, '#888888', 0.16, 14),
  sand: (ctx, ox, oy) => speckle(ctx, ox, oy, '#e3d9a3', 0.12, 15),
  water: (ctx, ox, oy) => speckle(ctx, ox, oy, '#3a6ee0', 0.1, 16),
  logTop: (ctx, ox, oy) => {
    speckle(ctx, ox, oy, '#9a7b4f', 0.1, 17);
    // rings
    ctx.strokeStyle = shade('#6b4f2e', 0);
    for (let r = 2; r < 8; r += 2) {
      ctx.beginPath();
      ctx.arc(ox + 8, oy + 8, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  logSide: (ctx, ox, oy) => {
    speckle(ctx, ox, oy, '#6b4f2e', 0.16, 18);
    // vertical bark streaks
    const rand = mulberry32(20);
    for (let x = 0; x < TILE; x += 3) {
      ctx.fillStyle = shade('#5a4225', -0.15);
      ctx.fillRect(ox + x + (rand() < 0.5 ? 0 : 1), oy, 1, TILE);
    }
  },
  // row 1
  leaves: (ctx, ox, oy) => {
    speckle(ctx, ox, oy, '#3c8a2e', 0.25, 21);
    const rand = mulberry32(22);
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = shade('#2f6e23', -0.2 + rand() * 0.4);
      ctx.fillRect(ox + (rand() * TILE) | 0, oy + (rand() * TILE) | 0, 1, 1);
    }
  },
  planks: (ctx, ox, oy) => {
    speckle(ctx, ox, oy, '#b08a4f', 0.1, 23);
    ctx.fillStyle = shade('#7d5f33', 0);
    for (let y = 0; y < TILE; y += 4) ctx.fillRect(ox, oy + y, TILE, 1);
  },
  cobblestone: (ctx, ox, oy) => {
    speckle(ctx, ox, oy, '#7a7a7a', 0.22, 24);
    ctx.fillStyle = shade('#4f4f4f', 0);
    // mortar grid
    for (let y = 0; y < TILE; y += 5) ctx.fillRect(ox, oy + y, TILE, 1);
    for (let x = 0; x < TILE; x += 5) ctx.fillRect(ox + x, oy, 1, TILE);
  },
  glass: (ctx, ox, oy) => {
    ctx.clearRect(ox, oy, TILE, TILE);
    ctx.fillStyle = 'rgba(180,220,255,0.22)';
    ctx.fillRect(ox, oy, TILE, TILE);
    ctx.strokeStyle = 'rgba(220,240,255,0.85)';
    ctx.strokeRect(ox + 0.5, oy + 0.5, TILE - 1, TILE - 1);
    ctx.beginPath();
    ctx.moveTo(ox + 3, oy + TILE - 3);
    ctx.lineTo(ox + TILE - 5, oy + 3);
    ctx.stroke();
  },
  brick: (ctx, ox, oy) => {
    speckle(ctx, ox, oy, '#a8442f', 0.1, 25);
    ctx.fillStyle = '#d6cdbf';
    for (let y = 0; y < TILE; y += 4) ctx.fillRect(ox, oy + y, TILE, 1);
    for (let y = 0; y < TILE; y += 8) {
      ctx.fillRect(ox + 4, oy + y, 1, 4);
      ctx.fillRect(ox + 12, oy + y + 4, 1, 4);
    }
  },
  gold: (ctx, ox, oy) => {
    speckle(ctx, ox, oy, '#888888', 0.14, 26);
    const rand = mulberry32(27);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = shade('#ffd83d', (rand() - 0.5) * 0.4);
      ctx.fillRect(ox + (2 + rand() * 12) | 0, oy + (2 + rand() * 12) | 0, 2, 2);
    }
  },
  diamond: (ctx, ox, oy) => {
    speckle(ctx, ox, oy, '#888888', 0.14, 28);
    const rand = mulberry32(29);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = shade('#4fe6e0', (rand() - 0.5) * 0.4);
      ctx.fillRect(ox + (2 + rand() * 12) | 0, oy + (2 + rand() * 12) | 0, 2, 2);
    }
  },
  bedrock: (ctx, ox, oy) => speckle(ctx, ox, oy, '#3a3a3a', 0.3, 30),
};

// Mapping from atlas [col,row] -> tile draw key. Must match blocks.js T table.
const LAYOUT = {
  '0,0': 'grassTop',
  '1,0': 'grassSide',
  '2,0': 'dirt',
  '3,0': 'stone',
  '4,0': 'sand',
  '5,0': 'water',
  '6,0': 'logTop',
  '7,0': 'logSide',
  '0,1': 'leaves',
  '1,1': 'planks',
  '2,1': 'cobblestone',
  '3,1': 'glass',
  '4,1': 'brick',
  '5,1': 'gold',
  '6,1': 'diamond',
  '7,1': 'bedrock',
};

let cachedTexture = null;
let cachedCanvas = null;

function buildAtlasCanvas() {
  if (cachedCanvas) return cachedCanvas;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_COLS * TILE;
  canvas.height = ATLAS_ROWS * TILE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  for (const key in LAYOUT) {
    const [col, row] = key.split(',').map(Number);
    const fn = TILES[LAYOUT[key]];
    if (fn) fn(ctx, col * TILE, row * TILE);
  }
  cachedCanvas = canvas;
  return canvas;
}

export function getAtlasCanvas() {
  return buildAtlasCanvas();
}

export function buildAtlasTexture() {
  if (cachedTexture) return cachedTexture;
  const tex = new THREE.CanvasTexture(buildAtlasCanvas());
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  cachedTexture = tex;
  return tex;
}

// UV rect for a tile [col,row]: returns {u0,v0,u1,v1}. A tiny inset avoids
// bleeding between neighbouring tiles in the atlas.
export function tileUV(col, row) {
  const inset = 0.5 / (ATLAS_COLS * TILE);
  const u0 = col / ATLAS_COLS + inset;
  const u1 = (col + 1) / ATLAS_COLS - inset;
  // canvas y is top-down; flip for GL (row 0 at top of canvas).
  const v1 = 1 - (row / ATLAS_ROWS) - inset;
  const v0 = 1 - ((row + 1) / ATLAS_ROWS) + inset;
  return { u0, v0, u1, v1 };
}
