/**
 * IndexedDB storage for sensitive settings
 *
 * The single module that talks to IndexedDB. API keys are stored here rather
 * than in localStorage so they never sit in a plainly-readable web store.
 * Database `mitre-mcp-config`, object store `api-keys` keyed by `id`.
 */

const DB_NAME = 'mitre-mcp-config';
const DB_VERSION = 1;
const STORE_NAME = 'api-keys';

const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

/**
 * Persist an API key.
 *
 * @param {string} keyName - Storage key (e.g. 'geminiApiKey')
 * @param {string} value - Secret value
 * @returns {Promise<void>} Rejects when the write fails
 */
export const saveApiKey = async (keyName, value) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id: keyName, value });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

/**
 * Read an API key. Never rejects — resolves '' when the key is absent, the
 * store is missing, or IndexedDB is unavailable (e.g. in tests).
 *
 * @param {string} keyName - Storage key
 * @returns {Promise<string>} Stored value or ''
 */
export const getApiKey = async (keyName) => {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      return '';
    }
    return await new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(keyName);
      request.onerror = () => resolve('');
      request.onsuccess = () => resolve(request.result?.value || '');
    });
  } catch {
    return '';
  }
};

/**
 * Delete an API key.
 *
 * @param {string} keyName - Storage key
 * @returns {Promise<void>} Rejects when the delete fails
 */
export const deleteApiKey = async (keyName) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(keyName);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};
