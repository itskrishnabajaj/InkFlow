/**
 * The world clock. A single monotonically increasing in-game time, advanced only by
 * the deterministic simulation tick (never by wall-clock), so the calendar is
 * reproducible. Macro systems (economy, politics, disease, migration, knowledge,
 * lineage) will subscribe to coarse cadences — day / season / year boundaries —
 * rather than per-frame, letting centuries pass coherently.
 */

// Tunable pacing. A full day-night cycle is DAY_SECONDS of in-game time at timeScale 1.
export const DAY_SECONDS = 600; // 10 minutes of real time per day at scale 1
export const DAYS_PER_SEASON = 30;
export const SEASONS_PER_YEAR = 4;
export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'] as const;

export class WorldClock {
  /** Total elapsed in-game seconds. */
  gameSeconds = 0;
  /** Multiplier from sim-time to game-time. 0 pauses the world; >1 fast-forwards. */
  timeScale = 1;

  /** Advance by a fixed simulation delta (seconds). Returns the integer day boundary
   * crossed count so callers can fire daily cadence work. */
  advance(fixedDt: number): number {
    const prevDay = this.day;
    this.gameSeconds += fixedDt * this.timeScale;
    return this.day - prevDay;
  }

  /** Time of day in [0,1): 0 = midnight, 0.5 = noon. */
  get timeOfDay(): number {
    return (this.gameSeconds % DAY_SECONDS) / DAY_SECONDS;
  }

  get day(): number {
    return Math.floor(this.gameSeconds / DAY_SECONDS);
  }

  get season(): number {
    return Math.floor(this.day / DAYS_PER_SEASON) % SEASONS_PER_YEAR;
  }

  get year(): number {
    return Math.floor(this.day / (DAYS_PER_SEASON * SEASONS_PER_YEAR));
  }

  get seasonName(): string {
    return SEASON_NAMES[this.season]!;
  }

  /** Human-readable HH:MM for the overlay/UI. */
  get hhmm(): string {
    const mins = Math.floor(this.timeOfDay * 24 * 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  serialize(): { gameSeconds: number; timeScale: number } {
    return { gameSeconds: this.gameSeconds, timeScale: this.timeScale };
  }

  load(data: { gameSeconds?: number; timeScale?: number }): void {
    if (typeof data.gameSeconds === 'number') this.gameSeconds = data.gameSeconds;
    if (typeof data.timeScale === 'number') this.timeScale = data.timeScale;
  }
}
