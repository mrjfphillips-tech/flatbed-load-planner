/**
 * Custom Zustand storage adapter using idb-keyval for IndexedDB persistence.
 * This enables offline-first state persistence across sessions.
 */
import { get, set, del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

export const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await get(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};
