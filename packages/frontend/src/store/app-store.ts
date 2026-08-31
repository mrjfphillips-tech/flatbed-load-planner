/**
 * Main application store using Zustand with IndexedDB persistence.
 * Manages session state, connectivity status, and offline queue.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { indexedDBStorage } from './indexeddb-storage';

export interface AppSession {
  id: string;
  accountId: string;
  accountName: string;
  startedAt: string;
  status: 'active' | 'completed' | 'interrupted';
}

export interface AppState {
  // Connectivity
  isOnline: boolean;
  setOnline: (online: boolean) => void;

  // Current session
  activeSession: AppSession | null;
  startSession: (session: AppSession) => void;
  endSession: () => void;

  // Offline queue for background sync
  offlineQueue: Array<{ id: string; type: string; payload: unknown; timestamp: number }>;
  addToOfflineQueue: (item: { type: string; payload: unknown }) => void;
  clearOfflineQueue: () => void;

  // UI preferences
  discreetMode: boolean;
  toggleDiscreetMode: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Connectivity
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      setOnline: (online) => set({ isOnline: online }),

      // Current session
      activeSession: null,
      startSession: (session) => set({ activeSession: session }),
      endSession: () => set({ activeSession: null }),

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

      // UI preferences
      discreetMode: false,
      toggleDiscreetMode: () => set((state) => ({ discreetMode: !state.discreetMode })),
    }),
    {
      name: 'ptv-discovery-coach-store',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        activeSession: state.activeSession,
        offlineQueue: state.offlineQueue,
        discreetMode: state.discreetMode,
      }),
    }
  )
);
