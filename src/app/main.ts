/**
 * Composition root. Wires the layers together (platform → core → render) and owns the
 * animation-frame loop. This is the ONLY place layers are connected; nothing else
 * reaches across boundaries. Gameplay systems (sim) plug in here in later stages.
 */

import '/styles/main.css';
import { FrameStats, now } from '@platform/time';
import { loadSettings } from '@platform/settings';
import { DebugOverlay } from '@platform/debug/overlay';
import { Database } from '@platform/db';
import { SeedSource } from '@platform/rng';
import { WorldClock } from '@core/clock';
import { Scheduler } from '@core/scheduler';
import { EventBus } from '@core/events/bus';
import { Renderer } from '@render/renderer';

const VERSION = '0.1.0 — Stage 1 (engine skeleton)';

class App {
  private settings = loadSettings();
  private stats = new FrameStats();
  private overlay = new DebugOverlay();
  private db = new Database();
  private seeds: SeedSource;
  private clock = new WorldClock();
  private events = new EventBus();
  private renderer: Renderer;
  private scheduler: Scheduler;
  private lastTime = now();
  private lastDt = 1 / 60;

  constructor() {
    this.seeds = new SeedSource((Math.random() * 0xffffffff) >>> 0);

    const canvas = document.getElementById('viewport') as HTMLCanvasElement;
    this.renderer = new Renderer(canvas);
    this.overlay.setVisible(this.settings.debugOverlay);

    this.scheduler = new Scheduler({
      tick: (dt) => this.tick(dt),
      render: (alpha) => this.draw(alpha),
    });

    // Bridge the world clock to the event bus for daily-cadence systems (later stages).
    this.events.on('world.dayElapsed', ({ day }) => {
      this.overlay.set('event', `day elapsed → ${day}`);
    });
  }

  async start(): Promise<void> {
    try {
      await this.db.open();
    } catch (e) {
      console.warn('IndexedDB unavailable; running without persistence.', e);
    }
    requestAnimationFrame(() => this.loop());
    // Reveal the world once the first frame is scheduled.
    requestAnimationFrame(() => {
      document.getElementById('boot')?.classList.add('hidden');
    });
  }

  private tick(fixedDt: number): void {
    const daysCrossed = this.clock.advance(fixedDt);
    if (daysCrossed > 0) this.events.emit('world.dayElapsed', { day: this.clock.day });
    // Sim systems will run here in later stages.
  }

  private draw(_alpha: number): void {
    this.renderer.render(this.lastDt);

    this.stats.sample(this.lastDt);
    this.overlay.set('title', `AETHELGARD  ·  ${VERSION}`);
    this.overlay.set('fps', `fps ${this.stats.fps.toFixed(0)}   frame ${this.stats.frameMs.toFixed(1)}ms`);
    this.overlay.set('draw', `draw calls ${this.renderer.drawCalls}`);
    this.overlay.set('clock', `Y${this.clock.year} ${this.clock.seasonName} D${this.clock.day} ${this.clock.hhmm}`);
    this.overlay.set('sim', `tick ${this.scheduler.tickCount}   seed ${this.seeds.worldSeed}`);
    this.overlay.render();
  }

  private loop(): void {
    requestAnimationFrame(() => this.loop());
    const t = now();
    this.lastDt = t - this.lastTime;
    this.lastTime = t;
    this.scheduler.frame(this.lastDt);
  }
}

new App().start();
