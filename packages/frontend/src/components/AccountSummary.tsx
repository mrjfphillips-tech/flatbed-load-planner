// @ts-nocheck
/**
 * AccountSummary
 *
 * Displays a chronological session list with per-element coverage scores,
 * highlights MEDDIC elements with cumulative coverage < 60 across all sessions,
 * shows contacts grouped by BuyerPersona, and shows gap recommendations per session.
 *
 * Requirements: 4.3, 4.4, 6.3, 15.9
 */

import React, { useMemo } from 'react'
import {
  MEDDIC_ELEMENTS,
  type MEDDICElement,
  type MEDDICScores,
  type Session,
  type GapRecommendation,
  type Contact,
  type BuyerPersona,
  defaultMEDDICScores,
} from '@ptv-discovery-coach/shared'
import { LeexiSync } from './LeexiSync'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionSummaryRow {
  session: Session
  gapRecommendations: GapRecommendation[]
}

export interface AccountSummaryProps {
  accountId: string
  accountName: string
  sessions: SessionSummaryRow[]
  contacts: Contact[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compute cumulative coverage scores across all sessions for an account */
function computeCumulativeScores(sessions: Session[]): MEDDICScores {
  if (sessions.length === 0) return defaultMEDDICScores()

  const totals = defaultMEDDICScores()
  for (const session of sessions) {
    for (const el of MEDDIC_ELEMENTS) {
      totals[el] += session.coverageScores[el] ?? 0
    }
  }

  // Average across sessions
  const result = defaultMEDDICScores()
  for (const el of MEDDIC_ELEMENTS) {
    result[el] = Math.round(totals[el] / sessions.length)
  }
  return result
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const BUYER_PERSONAS: BuyerPersona[] = [
  'FleetManager',
  'LogisticsDirector',
  'SupplyChainVP',
  'ITArchitect',
  'OperationsAnalyst',
]

function formatPersonaLabel(persona: BuyerPersona): string {
  return persona.replace(/([A-Z])/g, ' $1').trim()
}

function formatElementLabel(el: MEDDICElement): string {
  return el.replace(/([A-Z])/g, ' $1').trim()
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AccountSummary({
  accountId,
  accountName,
  sessions,
  contacts,
}: AccountSummaryProps): React.ReactElement {
  const allSessions = sessions.map((r) => r.session)

  // Req 4.4: highlight elements with cumulative coverage < 60
  const cumulativeScores = useMemo(() => computeCumulativeScores(allSessions), [allSessions])
  const gapElements = useMemo(
    () => MEDDIC_ELEMENTS.filter((el) => cumulativeScores[el] < 60),
    [cumulativeScores]
  )

  // Req 15.9: group contacts by BuyerPersona
  const contactsByPersona = useMemo(() => {
    const map = new Map<BuyerPersona, Contact[]>()
    for (const persona of BUYER_PERSONAS) {
      map.set(persona, [])
    }
    for (const contact of contacts) {
      const list = map.get(contact.buyerPersona) ?? []
      list.push(contact)
      map.set(contact.buyerPersona, list)
    }
    return map
  }, [contacts])

  return (
    <div
      className="max-w-2xl mx-auto px-4 py-6 space-y-8"
      data-testid="account-summary"
    >
      {/* Header */}
      <h1 className="text-xl font-semibold text-gray-800" data-testid="account-name">
        {accountName}
      </h1>

      {/* Leexi Audio Sync — Pull/Push */}
      <LeexiSync
        accountId={accountId}
        sessions={allSessions.map((s) => ({
          id: s.id,
          title: `Session — ${formatDate(s.startedAt)}`,
          date: formatDate(s.startedAt),
          duration: s.durationSeconds ?? 0,
          sizeBytes: (s.durationSeconds ?? 0) * 8000, // rough estimate
          pushedToLeexi: false,
        }))}
      />

      {/* Cumulative gap highlights (Req 4.4) */}
      {gapElements.length > 0 && (
        <section aria-label="Coverage gaps" data-testid="gap-highlights">
          <h2 className="text-sm font-medium text-gray-600 mb-2">Coverage Gaps (cumulative &lt; 60)</h2>
          <div className="flex flex-wrap gap-2">
            {gapElements.map((el) => (
              <GapBadge key={el} element={el} score={cumulativeScores[el]} />
            ))}
          </div>
        </section>
      )}

      {/* Session list (Req 4.3) */}
      <section aria-label="Session history" data-testid="session-list">
        <h2 className="text-sm font-medium text-gray-600 mb-3">Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400">No sessions yet.</p>
        ) : (
          <div className="space-y-4">
            {sessions.map((row, idx) => (
              <SessionCard
                key={row.session.id}
                row={row}
                gapElements={gapElements}
                previousScores={idx > 0 ? sessions[idx - 1].session.coverageScores : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* Contacts grouped by BuyerPersona (Req 15.9) */}
      {contacts.length > 0 && (
        <section aria-label="Contacts" data-testid="contacts-section">
          <h2 className="text-sm font-medium text-gray-600 mb-3">Contacts</h2>
          <div className="space-y-4">
            {BUYER_PERSONAS.map((persona) => {
              const list = contactsByPersona.get(persona) ?? []
              if (list.length === 0) return null
              return (
                <div key={persona} data-testid={`persona-group-${persona}`}>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {formatPersonaLabel(persona)}
                  </h3>
                  <div className="space-y-1">
                    {list.map((c) => (
                      <ContactRow key={c.id} contact={c} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── SessionCard ──────────────────────────────────────────────────────────────

interface SessionCardProps {
  row: SessionSummaryRow
  gapElements: MEDDICElement[]
  previousScores?: MEDDICScores
}

function SessionCard({ row, gapElements, previousScores }: SessionCardProps): React.ReactElement {
  const { session, gapRecommendations } = row
  const [expanded, setExpanded] = React.useState(false)

  return (
    <div
      className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
      data-testid={`session-card-${session.id}`}
    >
      {/* Header row */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-800">
            {formatDate(session.startedAt)}
          </span>
          <span className="text-xs text-gray-400">{formatDuration(session.durationSeconds)}</span>
          {session.sessionType === 'offline_recovery' && (
            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
              Offline Recovery
            </span>
          )}
        </div>
        <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Coverage scores mini-bar */}
      <div className="px-4 pb-2">
        <div className="flex flex-wrap gap-1">
          {MEDDIC_ELEMENTS.map((el) => {
            const score = session.coverageScores[el] ?? 0
            const isGap = gapElements.includes(el)
            return (
              <div
                key={el}
                className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                  isGap ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                }`}
                title={formatElementLabel(el)}
                data-testid={`score-${session.id}-${el}`}
              >
                <span className="font-medium">{score}</span>
                {previousScores && (() => {
                  const delta = score - (previousScores[el] ?? 0)
                  if (delta > 0) return <span className="text-green-600 font-semibold text-[10px]">+{delta}</span>
                  if (delta < 0) return <span className="text-red-600 font-semibold text-[10px]">{delta}</span>
                  return null
                })()}
              </div>
            )
          })}
        </div>
      </div>

      {/* Expanded: gap recommendations */}
      {expanded && gapRecommendations.length > 0 && (
        <div
          className="border-t border-gray-100 px-4 py-3 space-y-2"
          data-testid={`gap-recs-${session.id}`}
        >
          <p className="text-xs font-medium text-gray-500">Gap Recommendations</p>
          {gapRecommendations.map((rec) => (
            <GapRecommendationRow key={rec.element} rec={rec} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── GapBadge ─────────────────────────────────────────────────────────────────

interface GapBadgeProps {
  element: MEDDICElement
  score: number
}

function GapBadge({ element, score }: GapBadgeProps): React.ReactElement {
  const isCritical = element === 'EconomicBuyer' || element === 'Champion'
  return (
    <span
      className={`rounded px-2 py-1 text-xs font-medium ${
        isCritical
          ? 'bg-red-100 text-red-800 ring-1 ring-red-300'
          : 'bg-orange-100 text-orange-700'
      }`}
      data-testid={`gap-badge-${element}`}
      title={isCritical ? 'Critical gap' : undefined}
    >
      {formatElementLabel(element)} ({score})
      {isCritical && ' ⚠'}
    </span>
  )
}

// ─── GapRecommendationRow ─────────────────────────────────────────────────────

interface GapRecommendationRowProps {
  rec: GapRecommendation
}

function GapRecommendationRow({ rec }: GapRecommendationRowProps): React.ReactElement {
  return (
    <div className="flex items-start gap-2 text-xs" data-testid={`gap-rec-${rec.element}`}>
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 font-medium ${
          rec.isCritical ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
        }`}
      >
        {formatElementLabel(rec.element)}
        {rec.isCritical && ' ⚠'}
      </span>
      <span className="text-gray-500">
        Suggested personas:{' '}
        {rec.recommendedPersonas.map(formatPersonaLabel).join(', ')}
      </span>
    </div>
  )
}

// ─── ContactRow ───────────────────────────────────────────────────────────────

interface ContactRowProps {
  contact: Contact
}

function ContactRow({ contact }: ContactRowProps): React.ReactElement {
  return (
    <div
      className="flex items-center gap-3 rounded border border-gray-100 bg-gray-50 px-3 py-2"
      data-testid={`contact-row-${contact.id}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{contact.fullName}</p>
        <p className="text-xs text-gray-500 truncate">{contact.jobTitle}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-gray-500">{contact.email}</p>
        {contact.phone && <p className="text-xs text-gray-400">{contact.phone}</p>}
      </div>
    </div>
  )
}
