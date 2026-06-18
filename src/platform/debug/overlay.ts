/**
 * Lightweight debug overlay. Renders multi-line text into #debug-overlay. Used to
 * watch FPS, the world clock, chunk streaming, and (later) simulation stats so we can
 * validate performance continuously rather than at the end.
 */

export class DebugOverlay {
  private el: HTMLElement;
  private lines: Record<string, string> = {};
  visible = true;

  constructor() {
    this.el = document.getElementById('debug-overlay')!;
    // Toggle with the backtick key (desktop) — handy during development.
    window.addEventListener('keydown', (e) => {
      if (e.key === '`') this.setVisible(!this.visible);
    });
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.el.style.display = v ? 'block' : 'none';
  }

  /** Set a named line of the overlay (rendered in insertion order). */
  set(key: string, value: string): void {
    this.lines[key] = value;
  }

  render(): void {
    if (!this.visible) return;
    let out = '';
    for (const k in this.lines) out += this.lines[k] + '\n';
    this.el.textContent = out;
  }
}
