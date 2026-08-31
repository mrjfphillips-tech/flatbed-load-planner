/**
 * useOfflinePersistence
 *
 * Persists unsaved plan changes to IndexedDB (via idb-keyval) automatically.
 * Provides methods to save, load, and clear locally cached plan data.
 *
 * Validates: Requirements 20.6
 */

import { useCallback, useEffect, useRef } from 'react';
import { get, set, del, keys } from 'idb-keyval';

/** Prefix for all offline persistence keys in IndexedDB */
const OFFLINE_PREFIX = 'flatbed-planner-offline:';

/** Debounce interval for auto-save (ms) */
const AUTO_SAVE_DEBOUNCE_MS = 1000;

export interface OfflineChangeRecord {
  /** Unique ID for this change record */
  id: string;
  /** Timestamp when the change was saved locally */
  savedAt: number;
  /** The plan ID this change relates to (or 'new' for unsaved plans) */
  planId: string;
  /** Serialized state snapshot */
  data: unknown;
  /** Whether this change has been synced to the server */
  synced: boolean;
}

export interface UseOfflinePersistenceReturn {
  /** Save current plan state to IndexedDB */
  saveLocally: (planId: string, data: unknown) => Promise<void>;
  /** Load a locally cached plan by ID */
  loadLocal: (planId: string) => Promise<OfflineChangeRecord | null>;
  /** List all locally cached change records */
  listLocalChanges: () => Promise<OfflineChangeRecord[]>;
  /** Mark a local change as synced */
  markSynced: (planId: string) => Promise<void>;
  /** Remove a locally cached plan */
  clearLocal: (planId: string) => Promise<void>;
  /** Remove all locally cached plans */
  clearAllLocal: () => Promise<void>;
  /** Get count of unsynced local changes */
  getUnsyncedCount: () => Promise<number>;
}

/**
 * Hook that provides IndexedDB-backed persistence for unsaved plan changes.
 * Stores changes as key-value pairs using idb-keyval with a consistent prefix.
 */
export function useOfflinePersistence(): UseOfflinePersistenceReturn {
  const saveLocally = useCallback(async (planId: string, data: unknown): Promise<void> => {
    const key = `${OFFLINE_PREFIX}${planId}`;
    const record: OfflineChangeRecord = {
      id: planId,
      savedAt: Date.now(),
      planId,
      data,
      synced: false,
    };
    await set(key, record);
  }, []);

  const loadLocal = useCallback(async (planId: string): Promise<OfflineChangeRecord | null> => {
    const key = `${OFFLINE_PREFIX}${planId}`;
    const record = await get<OfflineChangeRecord>(key);
    return record ?? null;
  }, []);

  const listLocalChanges = useCallback(async (): Promise<OfflineChangeRecord[]> => {
    const allKeys = await keys();
    const offlineKeys = allKeys.filter(
      (k) => typeof k === 'string' && k.startsWith(OFFLINE_PREFIX)
    );
    const records: OfflineChangeRecord[] = [];
    for (const key of offlineKeys) {
      const record = await get<OfflineChangeRecord>(key as string);
      if (record) {
        records.push(record);
      }
    }
    return records.sort((a, b) => b.savedAt - a.savedAt);
  }, []);

  const markSynced = useCallback(async (planId: string): Promise<void> => {
    const key = `${OFFLINE_PREFIX}${planId}`;
    const record = await get<OfflineChangeRecord>(key);
    if (record) {
      record.synced = true;
      await set(key, record);
    }
  }, []);

  const clearLocal = useCallback(async (planId: string): Promise<void> => {
    const key = `${OFFLINE_PREFIX}${planId}`;
    await del(key);
  }, []);

  const clearAllLocal = useCallback(async (): Promise<void> => {
    const allKeys = await keys();
    const offlineKeys = allKeys.filter(
      (k) => typeof k === 'string' && k.startsWith(OFFLINE_PREFIX)
    );
    for (const key of offlineKeys) {
      await del(key as IDBValidKey);
    }
  }, []);

  const getUnsyncedCount = useCallback(async (): Promise<number> => {
    const allChanges = await listLocalChanges();
    return allChanges.filter((r) => !r.synced).length;
  }, [listLocalChanges]);

  return {
    saveLocally,
    loadLocal,
    listLocalChanges,
    markSynced,
    clearLocal,
    clearAllLocal,
    getUnsyncedCount,
  };
}

/**
 * Hook that auto-saves plan state to IndexedDB whenever unsaved changes are detected.
 * Uses a debounce to avoid excessive writes.
 */
export function useAutoSavePlan(
  planId: string | null,
  data: unknown,
  hasUnsavedChanges: boolean,
  isOnline: boolean
): void {
  const { saveLocally } = useOfflinePersistence();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Auto-save whenever there are unsaved changes (regardless of online/offline)
    if (!hasUnsavedChanges || !planId) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      saveLocally(planId, data).catch(() => {
        // Silently fail — IndexedDB may be unavailable
      });
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [planId, data, hasUnsavedChanges, isOnline, saveLocally]);
}
