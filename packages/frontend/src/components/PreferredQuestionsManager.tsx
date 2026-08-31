// @ts-nocheck
/**
 * PreferredQuestionsManager
 *
 * - Star/unstar control (single tap) on each suggested question
 * - Post-session review screen with star controls
 * - Profile/settings view listing all preferred questions with unstar option
 *
 * Requirements: 13.1, 13.3, 13.5, 13.8
 */

import React, { useState } from 'react'
import type { Question } from '@ptv-discovery-coach/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PreferredQuestionsManagerProps {
  /** All questions to display (session questions or preferred list) */
  questions: Question[]
  /** Set of currently preferred question IDs for this rep */
  preferredIds: Set<string>
  onStar: (questionId: string) => Promise<void>
  onUnstar: (questionId: string) => Promise<void>
  /** 'session' = inline during/after session, 'profile' = full preferred list */
  mode: 'session' | 'profile'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PreferredQuestionsManager({
  questions,
  preferredIds,
  onStar,
  onUnstar,
  mode,
}: PreferredQuestionsManagerProps): React.ReactElement {
  const displayQuestions =
    mode === 'profile' ? questions.filter((q) => preferredIds.has(q.id)) : questions

  return (
    <div
      className="space-y-2"
      data-testid={`preferred-questions-${mode}`}
      aria-label={mode === 'profile' ? 'Preferred questions' : 'Session questions'}
    >
      {mode === 'profile' && (
        <h2 className="text-sm font-medium text-gray-600 mb-2">
          Preferred Questions ({displayQuestions.length})
        </h2>
      )}

      {displayQuestions.length === 0 && mode === 'profile' && (
        <p className="text-sm text-gray-400">No preferred questions yet. Star questions during sessions.</p>
      )}

      {displayQuestions.map((q) => (
        <QuestionStarRow
          key={q.id}
          question={q}
          isPreferred={preferredIds.has(q.id)}
          onStar={onStar}
          onUnstar={onUnstar}
        />
      ))}
    </div>
  )
}

// ─── QuestionStarRow ──────────────────────────────────────────────────────────

interface QuestionStarRowProps {
  question: Question
  isPreferred: boolean
  onStar: (id: string) => Promise<void>
  onUnstar: (id: string) => Promise<void>
}

function QuestionStarRow({
  question,
  isPreferred,
  onStar,
  onUnstar,
}: QuestionStarRowProps): React.ReactElement {
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      if (isPreferred) {
        await onUnstar(question.id)
      } else {
        await onStar(question.id)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="flex items-start gap-2 rounded border border-gray-100 bg-white px-3 py-2"
      data-testid={`question-star-row-${question.id}`}
    >
      {/* Star button — single tap (Req 13.1) */}
      <button
        onClick={handleToggle}
        disabled={loading}
        aria-label={isPreferred ? 'Unstar question' : 'Star question'}
        aria-pressed={isPreferred}
        className={`shrink-0 text-lg leading-none disabled:opacity-50 ${
          isPreferred ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'
        }`}
        data-testid={`star-btn-${question.id}`}
      >
        ★
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800">{question.text}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {formatLabel(question.element)} · {formatLabel(question.persona)}
        </p>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLabel(s: string): string {
  return s.replace(/([A-Z])/g, ' $1').trim()
}
