/**
 * Generic Web Worker pool. Terrain generation and meshing (Stage 3) run here so the
 * main thread never blocks (principle #3). Workers communicate via a tiny request/
 * response protocol with transferable ArrayBuffers for zero-copy hand-off.
 *
 * Protocol:
 *   main → worker:  { id, payload }
 *   worker → main:  { id, result }  |  { id, error }
 * Worker result payloads should place transferables in a `transfer` array.
 */

export interface WorkerResponse<R> {
  id: number;
  result?: R;
  error?: string;
  transfer?: Transferable[];
}

interface Pending<R> {
  resolve: (value: R) => void;
  reject: (reason: unknown) => void;
}

export class WorkerPool {
  private workers: Worker[] = [];
  private nextWorker = 0;
  private nextId = 1;
  private pending = new Map<number, Pending<unknown>>();

  /**
   * @param factory creates a Worker (use Vite's `new Worker(new URL('./w.ts', import.meta.url), {type:'module'})`)
   * @param size number of workers (defaults to hardwareConcurrency-1, clamped)
   */
  constructor(factory: () => Worker, size?: number) {
    const n = size ?? Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
    for (let i = 0; i < n; i++) {
      const w = factory();
      w.onmessage = (e: MessageEvent<WorkerResponse<unknown>>) => this.onMessage(e.data);
      w.onerror = (e) => this.onError(e);
      this.workers.push(w);
    }
  }

  get size(): number {
    return this.workers.length;
  }

  /** Send a task to the next worker (round-robin). Resolves with its result. */
  run<Req, Res>(payload: Req, transfer: Transferable[] = []): Promise<Res> {
    const id = this.nextId++;
    const worker = this.workers[this.nextWorker]!;
    this.nextWorker = (this.nextWorker + 1) % this.workers.length;
    return new Promise<Res>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({ id, payload }, transfer);
    });
  }

  private onMessage(data: WorkerResponse<unknown>): void {
    const p = this.pending.get(data.id);
    if (!p) return;
    this.pending.delete(data.id);
    if (data.error !== undefined) p.reject(new Error(data.error));
    else p.resolve(data.result);
  }

  private onError(e: ErrorEvent): void {
    // Fail fast for visibility during development.
    console.error('[WorkerPool] worker error:', e.message);
  }

  dispose(): void {
    for (const w of this.workers) w.terminate();
    this.workers.length = 0;
    this.pending.clear();
  }
}
