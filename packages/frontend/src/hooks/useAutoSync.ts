/**
 * useAutoSync
 *
 * Synchronizes locally cached plan changes back to the server when connectivity resumes.
 * Implements server-wins conflict resolution strategy with optional user notification.
 *
 * Validates: Requirements 20.6
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { useOfflinePersistence, type OfflineChangeRecord } from './useOfflinePersistence';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'conflict';

export interface SyncConflict {
  planId: string;
  localVersion: unknown;
  serverVersion: unknown;
  resolvedWith: 'server' | 'local' | 'pending';
}

export interface SyncResult {
  synced: number;
  failed: number;
  conflicts: SyncConflict[];
}

export interface UseAutoSyncOptions {
  /** Whether auto-sync is enabled (default: true) */
  enabled?: boolean;
  /** Function to push a local change to the server. Return true if successful. */
  syncFn?: (record: OfflineChangeRecord) => Promise<boolean>;
  /** Function to fetch server version for conflict check */
  fetchServerVersion?: (planId: string) => Promise<unknown | null>;
  /** Conflict resolution strategy (default: 'server-wins') */
  conflictStrategy?: 'server-wins' | 'prompt-user';
  /** Delay (ms) after reconnection before starting sync (default: 2000) */
  reconnectDelay?: number;
}

export interface UseAutoSyncReturn {
  /** Current sync status */
  syncStatus: SyncStatus;
  /** Number of items waiting to be synced */
  pendingCount: number;
  /** Last sync result */
  lastSyncResult: SyncResult | null;
  /** Manually trigger a sync */
  triggerSync: () => Promise<SyncResult>;
  /** Resolve a conflict with a specific strategy */
  resolveConflict: (planId: string, resolution: 'server' | 'local') => Promise<void>;
}

/**
 * Hook that automatically syncs locally-stored plan changes to the server
 * when network connectivity is restored.
 */
export function useAutoSync(options: UseAutoSyncOptions = {}): UseAutoSyncReturn {
  const {
    enabled = true,
    syncFn,
    fetchServerVersion,
    conflictStrategy = 'server-wins',
    reconnectDelay = 2000,
  } = options;

  const { isOnline, onReconnect } = useNetworkStatus();
  const { listLocalChanges, markSynced, clearLocal } = useOfflinePersistence();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);

  const syncInProgress = useRef(false);

  // Update pending count periodically
  useEffect(() => {
    const updateCount = async () => {
      const changes = await listLocalChanges();
      setPendingCount(changes.filter((r) => !r.synced).length);
    };
    updateCount();
    const interval = setInterval(updateCount, 5000);
    return () => clearInterval(interval);
  }, [listLocalChanges]);

  const triggerSync = useCallback(async (): Promise<SyncResult> => {
    if (syncInProgress.current) {
      return lastSyncResult ?? { synced: 0, failed: 0, conflicts: [] };
    }

    syncInProgress.current = true;
    setSyncStatus('syncing');

    const result: SyncResult = { synced: 0, failed: 0, conflicts: [] };

    try {
      const changes = await listLocalChanges();
      const unsyncedChanges = changes.filter((r) => !r.synced);

      for (const record of unsyncedChanges) {
        try {
          // Check for conflicts if fetchServerVersion is provided
          if (fetchServerVersion) {
            const serverVersion = await fetchServerVersion(record.planId);
            if (serverVersion !== null) {
              // Server has a version — potential conflict
              if (conflictStrategy === 'server-wins') {
                // Server wins: discard local change, mark as synced
                await markSynced(record.planId);
                result.conflicts.push({
                  planId: record.planId,
                  localVersion: record.data,
                  serverVersion,
                  resolvedWith: 'server',
                });
                result.synced++;
                continue;
              } else {
                // Prompt user: don't auto-resolve
                result.conflicts.push({
                  planId: record.planId,
                  localVersion: record.data,
                  serverVersion,
                  resolvedWith: 'pending',
                });
                continue;
              }
            }
          }

          // Attempt to sync
          if (syncFn) {
            const success = await syncFn(record);
            if (success) {
              await markSynced(record.planId);
              result.synced++;
            } else {
              result.failed++;
            }
          } else {
            // No sync function provided — just mark as synced (used for testing or offline-only mode)
            await markSynced(record.planId);
            result.synced++;
          }
        } catch {
          result.failed++;
        }
      }

      setSyncStatus(result.failed > 0 ? 'error' : result.conflicts.length > 0 ? 'conflict' : 'success');
      setLastSyncResult(result);
      setPendingCount((prev) => Math.max(0, prev - result.synced));
    } catch {
      setSyncStatus('error');
      result.failed = 1;
      setLastSyncResult(result);
    } finally {
      syncInProgress.current = false;
    }

    return result;
  }, [listLocalChanges, markSynced, syncFn, fetchServerVersion, conflictStrategy, lastSyncResult]);

  const resolveConflict = useCallback(
    async (planId: string, resolution: 'server' | 'local') => {
      if (resolution === 'server') {
        // Discard local changes, keep server version
        await clearLocal(planId);
      } else {
        // Push local version (re-sync)
        const changes = await listLocalChanges();
        const record = changes.find((r) => r.planId === planId);
        if (record && syncFn) {
          const success = await syncFn(record);
          if (success) {
            await markSynced(planId);
          }
        }
      }
    },
    [clearLocal, listLocalChanges, syncFn, markSynced]
  );

  // Auto-sync on reconnection
  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = onReconnect(() => {
      setTimeout(() => {
        triggerSync();
      }, reconnectDelay);
    });

    return unsubscribe;
  }, [enabled, onReconnect, triggerSync, reconnectDelay]);

  // Also sync on mount if online and there are pending changes
  useEffect(() => {
    if (enabled && isOnline && pendingCount > 0) {
      triggerSync();
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    syncStatus,
    pendingCount,
    lastSyncResult,
    triggerSync,
    resolveConflict,
  };
}
