/**
 * db.js — IndexedDB abstraction for InkFlow
 * Stores PDF blobs + reading metadata
 *
 * Schema:
 *   comics store: { id, title, size, addedAt, coverDataUrl }
 *   files  store: { id (same as comic id), blob }
 *   progress store: { id, currentPage, totalPages, lastRead, mode }
 */

const DB = (() => {
  const DB_NAME = 'inkflow_db';
  const DB_VER  = 1;
  let _db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (_db) return resolve(_db);

      const req = indexedDB.open(DB_NAME, DB_VER);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains('comics')) {
          const comicsStore = db.createObjectStore('comics', { keyPath: 'id' });
          comicsStore.createIndex('addedAt', 'addedAt');
        }
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'id' });
        }
      };

      req.onsuccess = (e) => {
        _db = e.target.result;
        resolve(_db);
      };

      req.onerror = () => reject(req.error);
    });
  }

  function tx(stores, mode = 'readonly') {
    return _db.transaction(stores, mode);
  }

  function get(store, key) {
    return new Promise((resolve, reject) => {
      const req = tx(store).objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror  = () => reject(req.error);
    });
  }

  function getAll(store) {
    return new Promise((resolve, reject) => {
      const req = tx(store).objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror  = () => reject(req.error);
    });
  }

  function put(store, value) {
    return new Promise((resolve, reject) => {
      const t = tx(store, 'readwrite');
      const req = t.objectStore(store).put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror  = () => reject(req.error);
    });
  }

  function del(store, key) {
    return new Promise((resolve, reject) => {
      const t = tx([store], 'readwrite');
      const req = t.objectStore(store).delete(key);
      req.onsuccess = () => resolve();
      req.onerror  = () => reject(req.error);
    });
  }

  return {
    /* init — call once on startup */
    async init() {
      await open();
    },

    /* Comics metadata */
    async saveComic(meta) {
      await put('comics', meta);
    },

    async getAllComics() {
      return getAll('comics');
    },

    async deleteComic(id) {
      await del('comics', id);
      await del('files', id);
      await del('progress', id);
    },

    /* PDF file blob */
    async saveFile(id, blob) {
      await put('files', { id, blob });
    },

    async getFile(id) {
      const rec = await get('files', id);
      return rec ? rec.blob : null;
    },

    /* Reading progress */
    async saveProgress(id, data) {
      await put('progress', { id, ...data, lastRead: Date.now() });
    },

    async getProgress(id) {
      return get('progress', id);
    },

    async getAllProgress() {
      return getAll('progress');
    },

    async resetProgress(id) {
      await del('progress', id);
    }
  };
})();
