/**
 * OfflineIndicator
 *
 * Displays a visual indicator when the application is offline.
 * Shows sync status and pending change count when relevant.
 * Responsive: visible and readable on screens from 1024px to 3840px.
 *
 * Validates: Requirements 20.3, 20.4, 20.5, 20.6
 */

import React from 'react';
import type { SyncStatus } from '../../hooks/useAutoSync';

export interface OfflineIndicatorProps {
  /** Whether the browser is currently online */
  isOnline: boolean;
  /** Current synchronization status */
  syncStatus: SyncStatus;
  /** Number of locally cached changes waiting to be synced */
  pendingCount: number;
  /** Optional: callback to manually trigger sync */
  onRetrySync?: () => void;
}

/**
 * Renders a compact offline/sync status indicator bar.
 * Hidden when online and idle with no pending changes.
 */
export function OfflineIndicator({
  isOnline,
  syncStatus,
  pendingCount,
  onRetrySync,
}: OfflineIndicatorProps): React.ReactElement | null {
  // Don't render anything when online with no pending changes and idle
  if (isOnline && syncStatus === 'idle' && pendingCount === 0) {
    return null;
  }

  const statusConfig = getStatusConfig(isOnline, syncStatus, pendingCount);

  return (
    <div
      className="offline-indicator"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        fontSize: 'clamp(0.75rem, 1vw, 0.875rem)',
        backgroundColor: statusConfig.bgColor,
        color: statusConfig.textColor,
        borderRadius: '0.25rem',
        minHeight: '2rem',
      }}
    >
      <span
        className="offline-indicator__icon"
        aria-hidden="true"
        style={{ fontSize: '1.1em' }}
      >
        {statusConfig.icon}
      </span>
      <span className="offline-indicator__message">
        {statusConfig.message}
      </span>
      {pendingCount > 0 && (
        <span
          className="offline-indicator__badge"
          aria-label={`${pendingCount} unsaved change${pendingCount !== 1 ? 's' : ''} pending`}
          style={{
            backgroundColor: statusConfig.badgeBg,
            color: '#fff',
            borderRadius: '9999px',
            padding: '0.125rem 0.5rem',
            fontSize: '0.75em',
            fontWeight: 600,
          }}
        >
          {pendingCount}
        </span>
      )}
      {syncStatus === 'error' && onRetrySync && (
        <button
          className="offline-indicator__retry"
          onClick={onRetrySync}
          aria-label="Retry synchronization"
          style={{
            marginLeft: 'auto',
            padding: '0.25rem 0.5rem',
            fontSize: '0.75em',
            border: '1px solid currentColor',
            borderRadius: '0.25rem',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

interface StatusConfig {
  icon: string;
  message: string;
  bgColor: string;
  textColor: string;
  badgeBg: string;
}

function getStatusConfig(
  isOnline: boolean,
  syncStatus: SyncStatus,
  pendingCount: number
): StatusConfig {
  if (!isOnline) {
    return {
      icon: '⚡',
      message: 'Offline — changes saved locally',
      bgColor: '#fef3cd',
      textColor: '#856404',
      badgeBg: '#856404',
    };
  }

  switch (syncStatus) {
    case 'syncing':
      return {
        icon: '🔄',
        message: 'Syncing changes…',
        bgColor: '#cce5ff',
        textColor: '#004085',
        badgeBg: '#004085',
      };
    case 'success':
      return {
        icon: '✓',
        message: 'All changes synced',
        bgColor: '#d4edda',
        textColor: '#155724',
        badgeBg: '#155724',
      };
    case 'error':
      return {
        icon: '⚠',
        message: 'Sync failed — changes saved locally',
        bgColor: '#f8d7da',
        textColor: '#721c24',
        badgeBg: '#721c24',
      };
    case 'conflict':
      return {
        icon: '⚠',
        message: 'Sync conflict detected',
        bgColor: '#fff3cd',
        textColor: '#856404',
        badgeBg: '#856404',
      };
    default:
      // idle but with pending changes
      if (pendingCount > 0) {
        return {
          icon: '💾',
          message: 'Unsaved local changes',
          bgColor: '#e2e3e5',
          textColor: '#383d41',
          badgeBg: '#383d41',
        };
      }
      return {
        icon: '✓',
        message: 'Connected',
        bgColor: '#d4edda',
        textColor: '#155724',
        badgeBg: '#155724',
      };
  }
}
