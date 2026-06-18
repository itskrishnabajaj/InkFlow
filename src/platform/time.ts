/** High-resolution monotonic time in seconds. */
export const now = (): number => performance.now() / 1000;

/** Rolling frame-time / FPS tracker for the debug overlay and dynamic quality. */
export class FrameStats {
  private samples: number[] = [];
  private readonly capacity = 60;
  fps = 0;
  frameMs = 0;

  sample(dtSeconds: number): void {
    this.samples.push(dtSeconds);
    if (this.samples.length > this.capacity) this.samples.shift();
    let sum = 0;
    for (const s of this.samples) sum += s;
    const avg = sum / this.samples.length || 1 / 60;
    this.frameMs = avg * 1000;
    this.fps = 1 / avg;
  }
}
