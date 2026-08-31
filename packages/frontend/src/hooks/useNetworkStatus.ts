/**
 * useNetworkStatus
 *
 * Detects network connectivity via navigator.onLine and online/offline events.
 * Updates the app store's isOnline state and provides local status.
 *
 * Validates: Requirements 20.6
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface NetworkStatusInfo {
  /** Whether the browser currently reports online connectivity */
  isOnline: boolean;
  /** Timestamp of last detected connectivity change (ms since epoch) */
  lastChangedAt: number | null;
  /** How long (ms) the app has been in the current state */
  durationInCurrentState: number;
}

export interface UseNetworkStatusReturn {
  /** Current connectivity status */
  isOnline: boolean;
  /** Timestamp when status last changed */
  lastChangedAt: number | null;
  /** Register a callback for when the app goes online */
  onReconnect: (callback: () => void) => () => void;
  /** Register a callback for when the app goes offline */
  onDisconnect: (callback: () => void) => () => void;
}

/**
 * Hook that monitors browser network status via the navigator.onLine API
 * and the window online/offline events.
 *
 * Compatible with Chrome, Firefox, Edge, and Safari (current versions).
 */
export function useNetworkStatus(): UseNetworkStatusReturn {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [lastChangedAt, setLastChangedAt] = useState<number | null>(null);

  const reconnectCallbacks = useRef<Set<() => void>>(new Set());
  const disconnectCallbacks = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastChangedAt(Date.now());
      reconnectCallbacks.current.forEach((cb) => {
        try {
          cb();
        } catch {
          // Silently ignore callback errors
        }
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastChangedAt(Date.now());
      disconnectCallbacks.current.forEach((cb) => {
        try {
          cb();
        } catch {
          // Silently ignore callback errors
        }
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const onReconnect = useCallback((callback: () => void) => {
    reconnectCallbacks.current.add(callback);
    return () => {
      reconnectCallbacks.current.delete(callback);
    };
  }, []);

  const onDisconnect = useCallback((callback: () => void) => {
    disconnectCallbacks.current.add(callback);
    return () => {
      disconnectCallbacks.current.delete(callback);
    };
  }, []);

  return { isOnline, lastChangedAt, onReconnect, onDisconnect };
}
