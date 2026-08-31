/**
 * DiscreetModeToggle
 *
 * Single tap collapses UI to single-line status bar.
 * Persists preference to localStorage.
 * Low-contrast, non-animated defaults.
 *
 * Requirements: 10.4, 10.5
 */

import React from 'react'
import { useDiscreetMode } from '../hooks/useDiscreetMode'

export interface DiscreetModeToggleProps {
  /** Optional label shown in the status bar when discreet mode is active */
  statusLabel?: string
  /** Content to render when discreet mode is OFF */
  children: React.ReactNode
}

export function DiscreetModeToggle({
  statusLabel = 'PTV Coach — active',
  children,
}: DiscreetModeToggleProps): React.ReactElement {
  const { isDiscreet, toggle } = useDiscreetMode()

  if (isDiscreet) {
    return (
      <div
        className="w-full flex items-center justify-between px-3 py-1 bg-gray-100 text-gray-400 text-xs"
        data-testid="discreet-status-bar"
        role="status"
        aria-label="Discreet mode active"
      >
        <span>{statusLabel}</span>
        <button
          onClick={toggle}
          className="text-gray-400 hover:text-gray-600 text-xs"
          aria-label="Expand coaching overlay"
          data-testid="discreet-toggle"
        >
          ▲
        </button>
      </div>
    )
  }

  return (
    <div data-testid="discreet-wrapper">
      {/* Collapse button — low contrast, no animation */}
      <div className="flex justify-end px-3 pt-1">
        <button
          onClick={toggle}
          className="text-gray-300 hover:text-gray-500 text-xs"
          aria-label="Collapse to discreet mode"
          data-testid="discreet-toggle"
        >
          ▼ discreet
        </button>
      </div>
      {children}
    </div>
  )
}
