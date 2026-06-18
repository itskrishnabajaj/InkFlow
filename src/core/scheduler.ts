/**
 * Fixed-timestep scheduler (principle #5). Simulation runs at a fixed rate for
 * determinism; rendering runs every animation frame and interpolates with `alpha`.
 *
 * The app loop calls `frame(realDt)` which runs zero or more fixed `tick`s, then one
 * render with the leftover interpolation factor. A spiral-of-death guard caps how
 * much catch-up work a single frame may do.
 */

export const SIM_HZ = 30;
export const FIXED_DT = 1 / SIM_HZ;
const MAX_STEPS_PER_FRAME = 5;

export interface SchedulerHooks {
  /** Advance the simulation by exactly FIXED_DT seconds. */
  tick: (fixedDt: number, tickIndex: number) => void;
  /** Draw the world; alpha in [0,1) interpolates between the last two sim states. */
  render: (alpha: number) => void;
}

export class Scheduler {
  private accumulator = 0;
  /** Number of simulation ticks elapsed since start (monotonic, deterministic). */
  tickCount = 0;
  private hooks: SchedulerHooks;

  constructor(hooks: SchedulerHooks) {
    this.hooks = hooks;
  }

  frame(realDt: number): void {
    // Clamp pathological deltas (tab switches, GC pauses) to avoid huge catch-up.
    this.accumulator += Math.min(realDt, 0.25);

    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.hooks.tick(FIXED_DT, this.tickCount);
      this.tickCount++;
      this.accumulator -= FIXED_DT;
      steps++;
    }
    // If we hit the cap, drop the backlog rather than spiraling.
    if (steps === MAX_STEPS_PER_FRAME && this.accumulator > FIXED_DT) {
      this.accumulator = 0;
    }

    const alpha = this.accumulator / FIXED_DT;
    this.hooks.render(alpha);
  }
}
