// Block registry. Each block has an id, a display name, the atlas tile used on
// each face, and flags. Tile coords are [col, row] into the texture atlas grid
// defined in textures.js (ATLAS_COLS wide). Faces: top, bottom, side.

export const AIR = 0;

// Atlas tile indices (col,row). Keep in sync with textures.js drawing order.
const T = {
  grassTop: [0, 0],
  grassSide: [1, 0],
  dirt: [2, 0],
  stone: [3, 0],
  sand: [4, 0],
  water: [5, 0],
  logTop: [6, 0],
  logSide: [7, 0],
  leaves: [0, 1],
  planks: [1, 1],
  cobblestone: [2, 1],
  glass: [3, 1],
  brick: [4, 1],
  gold: [5, 1],
  diamond: [6, 1],
  bedrock: [7, 1],
};

// id -> definition. Order matters only for the hotbar selection list below.
export const BLOCKS = {
  1: { name: 'Grass', top: T.grassTop, bottom: T.dirt, side: T.grassSide, solid: true },
  2: { name: 'Dirt', all: T.dirt, solid: true },
  3: { name: 'Stone', all: T.stone, solid: true },
  4: { name: 'Sand', all: T.sand, solid: true },
  5: { name: 'Water', all: T.water, solid: false, transparent: true, liquid: true, translucent: true },
  6: { name: 'Oak Log', top: T.logTop, bottom: T.logTop, side: T.logSide, solid: true },
  7: { name: 'Leaves', all: T.leaves, solid: true, transparent: true },
  8: { name: 'Planks', all: T.planks, solid: true },
  9: { name: 'Cobblestone', all: T.cobblestone, solid: true },
  10: { name: 'Glass', all: T.glass, solid: true, transparent: true, translucent: true },
  11: { name: 'Brick', all: T.brick, solid: true },
  12: { name: 'Gold', all: T.gold, solid: true },
  13: { name: 'Diamond', all: T.diamond, solid: true },
  14: { name: 'Bedrock', all: T.bedrock, solid: true },
};

// Blocks offered in the hotbar, in display order.
export const HOTBAR_BLOCKS = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13];

export function isAir(id) {
  return id === AIR || id === undefined;
}

export function isSolid(id) {
  if (isAir(id)) return false;
  const b = BLOCKS[id];
  return b ? !!b.solid : false;
}

export function isTransparent(id) {
  if (isAir(id)) return true;
  const b = BLOCKS[id];
  return b ? !!b.transparent : false;
}

export function isLiquid(id) {
  const b = BLOCKS[id];
  return b ? !!b.liquid : false;
}

// Translucent blocks (water, glass) render in a separate pass with blending.
export function isTranslucent(id) {
  const b = BLOCKS[id];
  return b ? !!b.translucent : false;
}

// Whether a face between `current` and `neighbor` should be drawn.
// Hidden when the neighbor fully blocks view; drawn against air or a
// different see-through block.
export function shouldDrawFace(current, neighbor) {
  if (isAir(neighbor)) return true;
  if (!isTransparent(neighbor)) return false; // opaque neighbor hides the face
  return neighbor !== current; // cull internal faces between same transparent block
}

// Return [col,row] tile for a given block face. face: 'top'|'bottom'|'side'.
export function faceTile(id, face) {
  const b = BLOCKS[id];
  if (!b) return [0, 0];
  if (b.all) return b.all;
  if (face === 'top') return b.top || b.side || b.all;
  if (face === 'bottom') return b.bottom || b.side || b.all;
  return b.side || b.all;
}
