/**
 * Tests for frontend/src/services/storage.js — the single IndexedDB module.
 *
 * A tiny in-memory `indexedDB` stub drives the request/onsuccess callbacks so
 * the promise-based helpers can be exercised without a real database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveApiKey, getApiKey, deleteApiKey } from './storage.js';

// In-memory key -> value store plus switches to simulate failures.
const state = {
  data: new Map(),
  storeCreated: true,
  dbExists: false,
  failOpen: false,
};

const makeDb = () => ({
  objectStoreNames: { contains: (name) => name === 'api-keys' && state.storeCreated },
  createObjectStore: (name) => { if (name === 'api-keys') state.storeCreated = true; },
  transaction: () => ({
    objectStore: () => ({
      get: (key) => {
        const request = {};
        queueMicrotask(() => {
          request.result = state.data.has(key) ? { id: key, value: state.data.get(key) } : undefined;
          request.onsuccess?.();
        });
        return request;
      },
      put: (record) => {
        const request = {};
        queueMicrotask(() => {
          state.data.set(record.id, record.value);
          request.onsuccess?.();
        });
        return request;
      },
      delete: (key) => {
        const request = {};
        queueMicrotask(() => {
          state.data.delete(key);
          request.onsuccess?.();
        });
        return request;
      },
    }),
  }),
});

const indexedDBStub = {
  open: () => {
    const request = {};
    queueMicrotask(() => {
      if (state.failOpen) {
        request.error = new Error('open failed');
        request.onerror?.();
        return;
      }
      const db = makeDb();
      // A first open fires the upgrade handler, which creates the store.
      if (!state.dbExists) {
        request.onupgradeneeded?.({ target: { result: db } });
        state.dbExists = true;
      }
      request.result = db;
      request.onsuccess?.();
    });
    return request;
  },
};

describe('storage', () => {
  beforeEach(() => {
    state.data.clear();
    state.storeCreated = true;
    state.dbExists = false;
    state.failOpen = false;
    vi.stubGlobal('indexedDB', indexedDBStub);
  });

  it('round-trips a saved API key', async () => {
    await saveApiKey('geminiApiKey', 'secret-123');
    await expect(getApiKey('geminiApiKey')).resolves.toBe('secret-123');
  });

  it('resolves "" for a missing key', async () => {
    await expect(getApiKey('openrouterApiKey')).resolves.toBe('');
  });

  it('deleteApiKey removes a stored key', async () => {
    await saveApiKey('geminiApiKey', 'secret-123');
    await deleteApiKey('geminiApiKey');
    await expect(getApiKey('geminiApiKey')).resolves.toBe('');
  });

  it('getApiKey resolves "" instead of rejecting when IndexedDB fails', async () => {
    state.failOpen = true;
    await expect(getApiKey('geminiApiKey')).resolves.toBe('');
  });

  it('getApiKey resolves "" when the object store is absent', async () => {
    state.dbExists = true;      // existing DB, so no onupgradeneeded fires
    state.storeCreated = false; // ...but it predates the api-keys store
    await expect(getApiKey('geminiApiKey')).resolves.toBe('');
  });
});
