/**
 * User/engine settings with sane defaults, persisted to localStorage. The dynamic
 * quality manager (Stage 7) reads/writes the graphics fields; the UI exposes them.
 */

export interface Settings {
  /** Target frames-per-second band; dynamic quality scales to stay near targetFps. */
  targetFps: number;
  /** Chunk render radius (in chunks). Auto-tuned at runtime, clamped to [min,max]. */
  renderDistance: number;
  renderDistanceMin: number;
  renderDistanceMax: number;
  shadows: boolean;
  particles: boolean;
  /** Master + sfx volume in [0,1]. */
  masterVolume: number;
  /** Show the debug overlay. */
  debugOverlay: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  targetFps: 90,
  renderDistance: 8,
  renderDistanceMin: 4,
  renderDistanceMax: 16,
  shadows: true,
  particles: true,
  masterVolume: 0.8,
  debugOverlay: true,
};

const KEY = 'aethelgard.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage may be unavailable; ignore */
  }
}
