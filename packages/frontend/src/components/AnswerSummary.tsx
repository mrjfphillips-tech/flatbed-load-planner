/**
 * AnswerSummary
 *
 * Shown between accepting a question and moving to the next one.
 * Displays an AI-generated summary of the customer's response,
 * the MEDDIC element targeted, and the score delta.
 * The rep reviews it before clicking "Continue to Next Question".
 */

import React from 'react'

export interface AnswerSummaryProps {
  questionText: string
  element: string
  summary: string
  scoreDelta: number
  onContinue: () => void
}

export function AnswerSummary({
  questionText,
  element,
  summary,
  scoreDelta,
  onContinue,
}: AnswerSummaryProps): React.ReactElement {
  return (
    <div
      className="rounded-lg border border-green-500/25 bg-gradient-to-br from-green-500/5 to-blue-500/5 p-4"
      data-testid="answer-summary"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🤖</span>
        <span className="text-sm font-semibold text-green-400">
          AI Summary — Customer Response
        </span>
        <span className="ml-auto rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
          {element}
        </span>
      </div>

      {/* Original question */}
      <p className="text-[11px] text-gray-500 mb-2">
        Question: "{questionText}"
      </p>

      {/* AI summary */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 mb-3">
        <p className="text-sm text-gray-200 leading-relaxed" data-testid="summary-text">
          {summary}
        </p>
      </div>

      {/* Score delta + continue */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-green-400">
            +{scoreDelta} {element.replace(/([A-Z])/g, ' $1').trim()}
          </span>
          <span className="text-[11px] text-gray-500">· Score updated</span>
        </div>
        <button
          onClick={onContinue}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
          data-testid="continue-btn"
        >
          Continue to Next Question →
        </button>
      </div>
    </div>
  )
}
