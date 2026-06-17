// Save/load to localStorage. We persist only the world seed, the player's
// edits (deltas), camera position/orientation, and the selected hotbar slot —
// terrain regenerates deterministically from the seed.

const KEY = 'inkcraft.save.v1';

export function saveGame(world, player, hotbarIndex) {
  try {
    const data = {
      seed: world.seed,
      edits: world.serializeEdits(),
      player: {
        x: player.position.x,
        y: player.position.y,
        z: player.position.z,
        yaw: player.yaw,
        pitch: player.pitch,
      },
      hotbarIndex,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Save failed', e);
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Load failed', e);
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}
