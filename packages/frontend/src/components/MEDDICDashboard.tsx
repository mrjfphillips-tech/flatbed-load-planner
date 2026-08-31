// @ts-nocheck
/**
 * MEDDICDashboard
 *
 * Renders the Confidence_Meter for all 12 MEDDIC dimensions in a
 * single-screen mobile view. Visible to Rep role only.
 *
 * Requirements: 2.2, 2.3, 2.4, 2.5
 */

import React from 'react'
import { MEDDIC_ELEMENTS, type MEDDICScores, type UserRole } from '@ptv-discovery-coach/shared'

// ─── Props ────────────────────────────────────────────────────────────────────

interface MEDDICDashboardProps {
  /** Current coverage scores for all 12 elements */
  scores: MEDDICScores
  /** Only Rep role sees the dashboard (Req 2.5) */
  userRole: UserRole
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MEDDICDashboard({ scores, userRole }: MEDDICDashboardProps): React.ReactElement | null {
  // Req 2.5: render nothing for Manager / Admin
  if (userRole !== 'Rep') return null

  return (
    <div
      className="w-full max-w-sm mx-auto px-3 py-2 space-y-1"
      data-testid="meddic-dashboard"
      aria-label="MEDDIC coverage dashboard"
    >
      {MEDDIC_ELEMENTS.map((element) => (
        <ConfidenceMeter
          key={element}
          element={element}
          score={scores[element]}
        />
      ))}
    </div>
  )
}

// ─── ConfidenceMeter ──────────────────────────────────────────────────────────

interface ConfidenceMeterProps {
  element: string
  score: number
}

function ConfidenceMeter({ element, score }: ConfidenceMeterProps): React.ReactElement {
  const isComplete = score >= 100
  const pct = Math.min(100, Math.max(0, score))

  return (
    <div
      className="flex items-center gap-2"
      data-testid={`confidence-meter-${element}`}
      aria-label={`${formatLabel(element)}: ${pct}%`}
    >
      {/* Element label */}
      <span className="w-36 shrink-0 text-xs text-gray-500 truncate">
        {formatLabel(element)}
      </span>

      {/* Progress bar */}
      <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isComplete ? 'bg-green-500' : 'bg-blue-400'
          }`}
          style={{ width: `${pct}%` }}
          data-testid={`bar-${element}`}
        />
      </div>

      {/* Score label or checkmark */}
      <div className="w-8 text-right shrink-0">
        {isComplete ? (
          <span
            className="text-green-600 text-sm font-bold"
            data-testid={`complete-${element}`}
            aria-label="Complete"
          >
            ✓
          </span>
        ) : (
          <span className="text-xs text-gray-400">{pct}</span>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert camelCase element name to a readable label */
function formatLabel(element: string): string {
  return element
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}
