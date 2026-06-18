/**
 * Typed event bus. Systems emit past-tense facts; other systems / render / UI / the
 * chronicle subscribe. Systems never call each other directly (principle: minimal
 * coupling) — they communicate through events and shared components. This is also the
 * seam the world-history chronicle taps into.
 *
 * Event types are declared in a central map so payloads stay type-checked as the
 * system count grows. New systems extend `GameEvents` via declaration merging.
 */

// Core engine events. Gameplay layers augment this interface (declaration merging).
export interface GameEvents {
  'block.changed': { x: number; y: number; z: number; prev: number; next: number };
  'chunk.dirty': { cx: number; cy: number; cz: number };
  'world.dayElapsed': { day: number };
}

export type EventName = keyof GameEvents;
type Handler<K extends EventName> = (payload: GameEvents[K]) => void;

export class EventBus {
  private handlers = new Map<EventName, Set<Handler<EventName>>>();

  on<K extends EventName>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<EventName>);
    return () => set!.delete(handler as Handler<EventName>);
  }

  emit<K extends EventName>(event: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of set) (h as Handler<K>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
