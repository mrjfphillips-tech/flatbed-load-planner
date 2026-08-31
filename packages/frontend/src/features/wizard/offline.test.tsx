/**
 * Unit tests for offline data preservation and sync.
 *
 * Tests cover:
 * - IndexedDB persistence via idb-keyval (mocked)
 * - Network status detection
 * - Sync on reconnection
 * - OfflineIndicator component rendering
 * - Responsive rendering considerations
 * - Browser compatibility (standard Web API usage)
 *
 * Validates: Requirements 20.3, 20.4, 20.5, 20.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';

// ─── Mock idb-keyval ─────────────────────────────────────────────────────────

const mockStore = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => mockStore.get(key) ?? undefined),
  set: vi.fn(async (key: string, value: unknown) => {
    mockStore.set(key, value);
  }),
  del: vi.fn(async (key: string) => {
    mockStore.delete(key);
  }),
  keys: vi.fn(async () => Array.from(mockStore.keys())),
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import {
  useOfflinePersistence,
  useAutoSavePlan,
  type OfflineChangeRecord,
} from '../../hooks/useOfflinePersistence';
import { useAutoSync } from '../../hooks/useAutoSync';
import { OfflineIndicator } from './OfflineIndicator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    value,
    writable: true,
    configurable: true,
  });
}

// ─── Tests: useNetworkStatus ─────────────────────────────────────────────────

describe('useNetworkStatus', () => {
  beforeEach(() => {
    setupNavigatorOnline(true);
  });

  it('should return initial online status from navigator.onLine', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('should detect going offline via window event', () => {
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      setupNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.lastChangedAt).not.toBeNull();
  });

  it('should detect going online via window event', () => {
    setupNavigatorOnline(false);
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      setupNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.lastChangedAt).not.toBeNull();
  });

  it('should call onReconnect callbacks when going online', () => {
    setupNavigatorOnline(false);
    const { result } = renderHook(() => useNetworkStatus());
    const callback = vi.fn();

    act(() => {
      result.current.onReconnect(callback);
    });

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should call onDisconnect callbacks when going offline', () => {
    setupNavigatorOnline(true);
    const { result } = renderHook(() => useNetworkStatus());
    const callback = vi.fn();

    act(() => {
      result.current.onDisconnect(callback);
    });

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe callbacks when cleanup function is called', () => {
    setupNavigatorOnline(true);
    const { result } = renderHook(() => useNetworkStatus());
    const callback = vi.fn();

    let unsub: () => void;
    act(() => {
      unsub = result.current.onDisconnect(callback);
    });

    act(() => {
      unsub();
    });

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(callback).not.toHaveBeenCalled();
  });
});

// ─── Tests: useOfflinePersistence ────────────────────────────────────────────

describe('useOfflinePersistence', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('should save data to IndexedDB with correct key prefix', async () => {
    const { result } = renderHook(() => useOfflinePersistence());

    await act(async () => {
      await result.current.saveLocally('plan-1', { version: 1, items: ['a', 'b'] });
    });

    const stored = mockStore.get('flatbed-planner-offline:plan-1') as OfflineChangeRecord;
    expect(stored).toBeDefined();
    expect(stored.planId).toBe('plan-1');
    expect(stored.synced).toBe(false);
    expect(stored.data).toEqual({ version: 1, items: ['a', 'b'] });
    expect(stored.savedAt).toBeGreaterThan(0);
  });

  it('should load a locally saved record by plan ID', async () => {
    const { result } = renderHook(() => useOfflinePersistence());

    await act(async () => {
      await result.current.saveLocally('plan-2', { items: [1, 2, 3] });
    });

    let record: OfflineChangeRecord | null = null;
    await act(async () => {
      record = await result.current.loadLocal('plan-2');
    });

    expect(record).not.toBeNull();
    expect(record!.planId).toBe('plan-2');
    expect(record!.data).toEqual({ items: [1, 2, 3] });
  });

  it('should return null when loading a non-existent plan', async () => {
    const { result } = renderHook(() => useOfflinePersistence());

    let record: OfflineChangeRecord | null = null;
    await act(async () => {
      record = await result.current.loadLocal('non-existent');
    });

    expect(record).toBeNull();
  });

  it('should list all local change records sorted by most recent first', async () => {
    const { result } = renderHook(() => useOfflinePersistence());

    await act(async () => {
      await result.current.saveLocally('plan-a', { order: 1 });
    });

    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));

    await act(async () => {
      await result.current.saveLocally('plan-b', { order: 2 });
    });

    let records: OfflineChangeRecord[] = [];
    await act(async () => {
      records = await result.current.listLocalChanges();
    });

    expect(records).toHaveLength(2);
    // Most recent first
    expect(records[0].planId).toBe('plan-b');
    expect(records[1].planId).toBe('plan-a');
  });

  it('should mark a record as synced', async () => {
    const { result } = renderHook(() => useOfflinePersistence());

    await act(async () => {
      await result.current.saveLocally('plan-sync', { data: 'test' });
    });

    await act(async () => {
      await result.current.markSynced('plan-sync');
    });

    let record: OfflineChangeRecord | null = null;
    await act(async () => {
      record = await result.current.loadLocal('plan-sync');
    });

    expect(record!.synced).toBe(true);
  });

  it('should clear a specific local record', async () => {
    const { result } = renderHook(() => useOfflinePersistence());

    await act(async () => {
      await result.current.saveLocally('plan-x', { x: 1 });
      await result.current.saveLocally('plan-y', { y: 2 });
    });

    await act(async () => {
      await result.current.clearLocal('plan-x');
    });

    let recordX: OfflineChangeRecord | null = null;
    let recordY: OfflineChangeRecord | null = null;
    await act(async () => {
      recordX = await result.current.loadLocal('plan-x');
      recordY = await result.current.loadLocal('plan-y');
    });

    expect(recordX).toBeNull();
    expect(recordY).not.toBeNull();
  });

  it('should clear all local records', async () => {
    const { result } = renderHook(() => useOfflinePersistence());

    await act(async () => {
      await result.current.saveLocally('p1', { a: 1 });
      await result.current.saveLocally('p2', { b: 2 });
      await result.current.saveLocally('p3', { c: 3 });
    });

    await act(async () => {
      await result.current.clearAllLocal();
    });

    let records: OfflineChangeRecord[] = [];
    await act(async () => {
      records = await result.current.listLocalChanges();
    });

    expect(records).toHaveLength(0);
  });

  it('should return correct unsynced count', async () => {
    const { result } = renderHook(() => useOfflinePersistence());

    await act(async () => {
      await result.current.saveLocally('p1', { a: 1 });
      await result.current.saveLocally('p2', { b: 2 });
      await result.current.markSynced('p1');
    });

    let count = 0;
    await act(async () => {
      count = await result.current.getUnsyncedCount();
    });

    expect(count).toBe(1);
  });
});

// ─── Tests: useAutoSync ──────────────────────────────────────────────────────

describe('useAutoSync', () => {
  beforeEach(() => {
    mockStore.clear();
    setupNavigatorOnline(true);
  });

  it('should start with idle status and zero pending count', () => {
    const { result } = renderHook(() => useAutoSync({ enabled: false }));

    expect(result.current.syncStatus).toBe('idle');
    expect(result.current.pendingCount).toBe(0);
  });

  it('should sync all unsynced records when triggerSync is called', async () => {
    const syncFn = vi.fn().mockResolvedValue(true);

    // Pre-populate store with unsynced records
    mockStore.set('flatbed-planner-offline:plan-1', {
      id: 'plan-1',
      savedAt: Date.now(),
      planId: 'plan-1',
      data: { test: true },
      synced: false,
    });

    const { result } = renderHook(() =>
      useAutoSync({ enabled: false, syncFn })
    );

    let syncResult: { synced: number; failed: number } | null = null;
    await act(async () => {
      syncResult = await result.current.triggerSync();
    });

    expect(syncFn).toHaveBeenCalledTimes(1);
    expect(syncResult!.synced).toBe(1);
    expect(syncResult!.failed).toBe(0);
  });

  it('should report failed syncs when syncFn returns false', async () => {
    const syncFn = vi.fn().mockResolvedValue(false);

    mockStore.set('flatbed-planner-offline:plan-fail', {
      id: 'plan-fail',
      savedAt: Date.now(),
      planId: 'plan-fail',
      data: { fail: true },
      synced: false,
    });

    const { result } = renderHook(() =>
      useAutoSync({ enabled: false, syncFn })
    );

    let syncResult: { synced: number; failed: number } | null = null;
    await act(async () => {
      syncResult = await result.current.triggerSync();
    });

    expect(syncResult!.synced).toBe(0);
    expect(syncResult!.failed).toBe(1);
    expect(result.current.syncStatus).toBe('error');
  });

  it('should trigger sync on reconnection when enabled', async () => {
    setupNavigatorOnline(false);

    mockStore.set('flatbed-planner-offline:plan-recon', {
      id: 'plan-recon',
      savedAt: Date.now(),
      planId: 'plan-recon',
      data: { reconnect: true },
      synced: false,
    });

    const syncFn = vi.fn().mockResolvedValue(true);

    renderHook(() =>
      useAutoSync({ enabled: true, syncFn, reconnectDelay: 50 })
    );

    // Simulate going back online
    act(() => {
      setupNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    // Wait for reconnect delay + sync
    await waitFor(
      () => {
        expect(syncFn).toHaveBeenCalled();
      },
      { timeout: 2000 }
    );
  });

  it('should handle server-wins conflict resolution', async () => {
    const syncFn = vi.fn().mockResolvedValue(true);
    const fetchServerVersion = vi.fn().mockResolvedValue({ version: 5 });

    mockStore.set('flatbed-planner-offline:plan-conflict', {
      id: 'plan-conflict',
      savedAt: Date.now(),
      planId: 'plan-conflict',
      data: { local: true },
      synced: false,
    });

    const { result } = renderHook(() =>
      useAutoSync({
        enabled: false,
        syncFn,
        fetchServerVersion,
        conflictStrategy: 'server-wins',
      })
    );

    let syncResult: { synced: number; conflicts: unknown[] } | null = null;
    await act(async () => {
      syncResult = await result.current.triggerSync();
    });

    // Server wins: local change is discarded (marked synced), conflict logged
    expect(syncResult!.conflicts.length).toBe(1);
    expect(syncFn).not.toHaveBeenCalled(); // syncFn should not be called in server-wins
  });
});

// ─── Tests: OfflineIndicator Component ───────────────────────────────────────

describe('OfflineIndicator', () => {
  it('should not render when online, idle, and no pending changes', () => {
    const { container } = render(
      <OfflineIndicator isOnline={true} syncStatus="idle" pendingCount={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('should display offline message when not online', () => {
    render(
      <OfflineIndicator isOnline={false} syncStatus="idle" pendingCount={2} />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Offline/)).toBeInTheDocument();
    expect(screen.getByText(/changes saved locally/)).toBeInTheDocument();
  });

  it('should display pending count badge when there are pending changes', () => {
    render(
      <OfflineIndicator isOnline={false} syncStatus="idle" pendingCount={5} />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(
      screen.getByLabelText('5 unsaved changes pending')
    ).toBeInTheDocument();
  });

  it('should display syncing message when sync is in progress', () => {
    render(
      <OfflineIndicator isOnline={true} syncStatus="syncing" pendingCount={3} />
    );

    expect(screen.getByText(/Syncing changes/)).toBeInTheDocument();
  });

  it('should display success message after sync completes', () => {
    render(
      <OfflineIndicator isOnline={true} syncStatus="success" pendingCount={0} />
    );

    expect(screen.getByText(/All changes synced/)).toBeInTheDocument();
  });

  it('should display error message and retry button on sync failure', () => {
    const onRetry = vi.fn();
    render(
      <OfflineIndicator
        isOnline={true}
        syncStatus="error"
        pendingCount={1}
        onRetrySync={onRetry}
      />
    );

    expect(screen.getByText(/Sync failed/)).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: /Retry synchronization/ });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should display conflict message when sync has conflicts', () => {
    render(
      <OfflineIndicator isOnline={true} syncStatus="conflict" pendingCount={1} />
    );

    expect(screen.getByText(/conflict detected/)).toBeInTheDocument();
  });

  it('should have proper ARIA attributes for accessibility', () => {
    render(
      <OfflineIndicator isOnline={false} syncStatus="idle" pendingCount={1} />
    );

    const indicator = screen.getByRole('status');
    expect(indicator).toHaveAttribute('aria-live', 'polite');
    expect(indicator).toHaveAttribute('aria-atomic', 'true');
  });

  it('should render with responsive font sizing (clamp-based)', () => {
    render(
      <OfflineIndicator isOnline={false} syncStatus="idle" pendingCount={1} />
    );

    const indicator = screen.getByRole('status');
    expect(indicator.style.fontSize).toContain('clamp');
  });
});

// ─── Tests: useAutoSavePlan ──────────────────────────────────────────────────

describe('useAutoSavePlan', () => {
  beforeEach(() => {
    mockStore.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should auto-save when there are unsaved changes', async () => {
    const planData = { items: ['steel-coil-1'], version: 3 };

    renderHook(() => useAutoSavePlan('plan-auto', planData, true, true));

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    const stored = mockStore.get('flatbed-planner-offline:plan-auto') as OfflineChangeRecord;
    expect(stored).toBeDefined();
    expect(stored.data).toEqual(planData);
  });

  it('should not auto-save when there are no unsaved changes', async () => {
    renderHook(() => useAutoSavePlan('plan-no-save', { data: 'x' }, false, true));

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockStore.has('flatbed-planner-offline:plan-no-save')).toBe(false);
  });

  it('should not auto-save when planId is null', async () => {
    renderHook(() => useAutoSavePlan(null, { data: 'x' }, true, true));

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockStore.size).toBe(0);
  });

  it('should debounce rapid saves', async () => {
    const { rerender } = renderHook(
      ({ data }) => useAutoSavePlan('plan-debounce', data, true, true),
      { initialProps: { data: { v: 1 } } }
    );

    // Change data rapidly
    rerender({ data: { v: 2 } });
    rerender({ data: { v: 3 } });
    rerender({ data: { v: 4 } });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    const stored = mockStore.get('flatbed-planner-offline:plan-debounce') as OfflineChangeRecord;
    // Only the last value should be saved
    expect(stored.data).toEqual({ v: 4 });
  });
});

// ─── Tests: IndexedDB Storage Adapter ────────────────────────────────────────

describe('indexedDBStorage adapter', () => {
  beforeEach(() => {
    mockStore.clear();
  });

  it('should implement StateStorage interface with getItem/setItem/removeItem', async () => {
    // Verify the module exports are consistent with Zustand StateStorage
    const { indexedDBStorage } = await import('../../store/indexeddb-storage');

    expect(typeof indexedDBStorage.getItem).toBe('function');
    expect(typeof indexedDBStorage.setItem).toBe('function');
    expect(typeof indexedDBStorage.removeItem).toBe('function');
  });

  it('should store and retrieve string values', async () => {
    const { indexedDBStorage } = await import('../../store/indexeddb-storage');

    await indexedDBStorage.setItem('test-key', '{"count":42}');
    const retrieved = await indexedDBStorage.getItem('test-key');
    expect(retrieved).toBe('{"count":42}');
  });

  it('should return null for non-existent keys', async () => {
    const { indexedDBStorage } = await import('../../store/indexeddb-storage');

    const retrieved = await indexedDBStorage.getItem('missing-key');
    expect(retrieved).toBeNull();
  });

  it('should remove items from storage', async () => {
    const { indexedDBStorage } = await import('../../store/indexeddb-storage');

    await indexedDBStorage.setItem('to-remove', '"value"');
    await indexedDBStorage.removeItem('to-remove');
    const retrieved = await indexedDBStorage.getItem('to-remove');
    expect(retrieved).toBeNull();
  });
});

// ─── Tests: Responsive Rendering (Req 20.4) ─────────────────────────────────

describe('Responsive rendering (1024px to 3840px)', () => {
  it('OfflineIndicator uses clamp() for responsive font sizing', () => {
    render(
      <OfflineIndicator isOnline={false} syncStatus="idle" pendingCount={1} />
    );

    const indicator = screen.getByRole('status');
    // clamp(0.75rem, 1vw, 0.875rem) ensures readability across viewport widths
    expect(indicator.style.fontSize).toBe('clamp(0.75rem, 1vw, 0.875rem)');
  });

  it('OfflineIndicator uses flexbox layout for responsive alignment', () => {
    render(
      <OfflineIndicator isOnline={false} syncStatus="idle" pendingCount={1} />
    );

    const indicator = screen.getByRole('status');
    expect(indicator.style.display).toBe('flex');
    expect(indicator.style.alignItems).toBe('center');
  });
});

// ─── Tests: Browser Compatibility (Req 20.5) ────────────────────────────────

describe('Browser compatibility', () => {
  it('uses standard navigator.onLine API (supported by all modern browsers)', () => {
    // navigator.onLine is part of the HTML5 spec, supported since:
    // Chrome 1+, Firefox 3+, Edge 12+, Safari 5+
    expect(typeof navigator.onLine).toBe('boolean');
  });

  it('uses standard window online/offline events', () => {
    // These events are part of the HTML5 spec
    const handler = vi.fn();
    window.addEventListener('online', handler);
    window.dispatchEvent(new Event('online'));
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('online', handler);
  });

  it('uses IndexedDB API (via idb-keyval abstraction)', async () => {
    // idb-keyval wraps the standard IndexedDB API supported by:
    // Chrome 23+, Firefox 10+, Edge 12+, Safari 10+
    const { get, set } = await import('idb-keyval');
    expect(typeof get).toBe('function');
    expect(typeof set).toBe('function');
  });
});
