export class DB {
  constructor(name = 'spanish-learner') {
    this.name = name;
    this.db = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'cardId' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  saveProgress(cardId, data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('progress', 'readwrite');
      tx.objectStore('progress').put({ cardId, ...data });
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  getProgress(cardId) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('progress', 'readonly');
      const req = tx.objectStore('progress').get(cardId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  getAllProgress() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('progress', 'readonly');
      const req = tx.objectStore('progress').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  saveSetting(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ key, value });
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  getSetting(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readonly');
      const req = tx.objectStore('settings').get(key);
      req.onsuccess = () => resolve(req.result?.value);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  clear() {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['progress', 'settings'], 'readwrite');
      tx.objectStore('progress').clear();
      tx.objectStore('settings').clear();
      tx.oncomplete = resolve;
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}
