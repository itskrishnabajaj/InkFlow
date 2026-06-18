/**
 * Thin promise-based IndexedDB wrapper. This is the persistence substrate (Stage 6):
 * edited regions, world metadata, entity/world state, and the chronicle are stored
 * here incrementally. Stage 1 only establishes the connection + key/value + region
 * object stores; richer schemas arrive with the save system.
 */

const DB_NAME = 'aethelgard';
const DB_VERSION = 1;

export const STORE_KV = 'kv';        // small key/value: world meta, settings mirror, player
export const STORE_REGIONS = 'regions'; // edited chunk/region buffers keyed by region id
export const STORE_CHRONICLE = 'chronicle'; // append-only world history events

export class Database {
  private db: IDBDatabase | null = null;

  async open(): Promise<void> {
    if (this.db) return;
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_KV)) db.createObjectStore(STORE_KV);
        if (!db.objectStoreNames.contains(STORE_REGIONS)) db.createObjectStore(STORE_REGIONS);
        if (!db.objectStoreNames.contains(STORE_CHRONICLE)) {
          db.createObjectStore(STORE_CHRONICLE, { autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private store(name: string, mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) throw new Error('Database not opened');
    return this.db.transaction(name, mode).objectStore(name);
  }

  get<T = unknown>(store: string, key: IDBValidKey): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const req = this.store(store, 'readonly').get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  put(store: string, value: unknown, key?: IDBValidKey): Promise<void> {
    return new Promise((resolve, reject) => {
      const os = this.store(store, 'readwrite');
      const req = key !== undefined ? os.put(value, key) : os.put(value);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  delete(store: string, key: IDBValidKey): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = this.store(store, 'readwrite').delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  append(store: string, value: unknown): Promise<IDBValidKey> {
    return new Promise((resolve, reject) => {
      const req = this.store(store, 'readwrite').add(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
}
