/**
 * Main application store using Zustand with IndexedDB persistence.
 * Manages connectivity status and offline queue for the Load Planner.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { indexedDBStorage } from './indexeddb-storage';

export interface AppState {
  // Connectivity
  isOnline: boolean;
  setOnline: (online: boolean) => void;

  // Offline queue for background sync
  offlineQueue: Array<{ id: string; type: string; payload: unknown; timestamp: number }>;
  addToOfflineQueue: (item: { type: string; payload: unknown }) => void;
  clearOfflineQueue: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Connectivity
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      setOnline: (online) => set({ isOnline: online }),

      // Offline queue
      offlineQueue: [],
      addToOfflineQueue: (item) =>
        set((state) => ({
          offlineQueue: [
            ...state.offlineQueue,
            { id: crypto.randomUUID(), timestamp: Date.now(), ...item },
          ],
        })),
      clearOfflineQueue: () => set({ offlineQueue: [] }),
    }),
    {
      name: 'optiflow-load-planner-store',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        offlineQueue: state.offlineQueue,
      }),
    }
  )
);
