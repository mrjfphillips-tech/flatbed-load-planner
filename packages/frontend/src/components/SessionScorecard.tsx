/**
 * SessionScorecard
 *
 * Shown when a session ends. Displays all MEDDIC scores with progress bars,
 * deltas from session start (or "baseline" for first sessions),
 * a "needs attention" section, and a "What's Next" action panel.
 */

import React from 'react'

export interface SessionScorecardProps {
  /** Current MEDDIC scores at session end */
  scores: Record<string, number>
  /** Scores at session start (empty/zero = first session) */
  startScores: Record<string, number>
  /** Callbacks for What's Next actions */
  onViewOverview?: () => void
  onBuildROI?: () => void
  onManageContacts?: () => void
  onStartNewSession?: () => void
}

export function SessionScorecard({
  scores,
  startScores,
  onViewOverview,
  onBuildROI,
  onManageContacts,
  onStartNewSession,
}: SessionScorecardProps): React.ReactElement {
  const isFirstSession = Object.values(startScores).every((v) => v === 0)
  const elements = Object.keys(scores)
  const weakAreas = elements.filter((k) => scores[k] < 50)

  return (
    <div className="space-y-4" data-testid="session-scorecard">
      {/* MEDDIC Scores */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">
          📊 MEDDIC Scores — End of Session
        </h3>
        <div className="space-y-2">
          {elements.map((key) => {
            const score = scores[key]
            const prev = startScores[key] ?? 0
            const delta = score - prev
            const pct = Math.min(100, score)
            const barColor =
              pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-blue-500' : 'bg-red-500'
            const label = key.replace(/([A-Z])/g, ' $1').trim()

            return (
              <div key={key} className="flex items-center gap-2" data-testid={`score-${key}`}>
                <span className="w-28 text-xs text-gray-400 truncate">{label}</span>
                <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span
                  className={`w-7 text-right text-xs font-medium ${
                    pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-white' : 'text-red-400'
                  }`}
                >
                  {score}
                </span>
                {/* Delta badge */}
                {isFirstSession ? (
                  <span className="text-[10px] text-gray-500 ml-1">baseline</span>
                ) : delta > 0 ? (
                  <span className="rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-400 ml-1">
                    +{delta}
                  </span>
                ) : delta < 0 ? (
                  <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400 ml-1">
                    {delta}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-500 ml-1">—</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Needs attention */}
        {weakAreas.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-[11px] font-semibold text-red-400 mb-1">
              ⚠ Needs attention on next call
            </p>
            {weakAreas.map((key) => (
              <p key={key} className="text-xs text-gray-400">
                {key.replace(/([A-Z])/g, ' $1').trim()} ({scores[key]}%) — prioritize next session
              </p>
            ))}
          </div>
        )}
      </div>

      {/* What's Next */}
      <div
        className="rounded-lg border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-purple-500/5 p-5"
        style={{ animation: 'pulse 2s ease-in-out infinite' }}
        data-testid="whats-next"
      >
        <h3 className="text-base font-bold text-blue-400 mb-1">🚀 What's Next?</h3>
        <p className="text-xs text-gray-400 mb-4">
          Choose your next step to keep the deal moving forward.
        </p>
        <div className="flex flex-col gap-2">
          {onViewOverview && (
            <button
              onClick={onViewOverview}
              className="flex items-center gap-3 rounded-lg bg-blue-600 px-4 py-3 text-left text-white hover:bg-blue-500 transition-colors"
              data-testid="next-overview"
            >
              <span className="text-lg">📁</span>
              <span>
                <strong className="text-sm">View Account Overview</strong>
                <br />
                <span className="text-[11px] opacity-80">
                  See updated MEDDIC health, deal map, and timeline
                </span>
              </span>
            </button>
          )}
          {onBuildROI && (
            <button
              onClick={onBuildROI}
              className="flex items-center gap-3 rounded-lg bg-green-600 px-4 py-3 text-left text-white hover:bg-green-500 transition-colors"
              data-testid="next-roi"
            >
              <span className="text-lg">📊</span>
              <span>
                <strong className="text-sm">Build ROI Calculator</strong>
                <br />
                <span className="text-[11px] opacity-80">
                  Use session data to quantify value for the customer
                </span>
              </span>
            </button>
          )}
          {onManageContacts && (
            <button
              onClick={onManageContacts}
              className="flex items-center gap-3 rounded-lg border border-gray-600 px-4 py-3 text-left text-gray-300 hover:bg-gray-800 transition-colors"
              data-testid="next-contacts"
            >
              <span className="text-lg">👥</span>
              <span>
                <strong className="text-sm">Manage Contacts</strong>
                <br />
                <span className="text-[11px] text-gray-500">
                  Update stakeholder map and deal roles
                </span>
              </span>
            </button>
          )}
          {onStartNewSession && (
            <button
              onClick={onStartNewSession}
              className="flex items-center gap-3 rounded-lg border border-gray-600 px-4 py-3 text-left text-gray-300 hover:bg-gray-800 transition-colors"
              data-testid="next-session"
            >
              <span className="text-lg">🎙</span>
              <span>
                <strong className="text-sm">Start Another Session</strong>
                <br />
                <span className="text-[11px] text-gray-500">
                  Continue discovery to improve weak MEDDIC areas
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
