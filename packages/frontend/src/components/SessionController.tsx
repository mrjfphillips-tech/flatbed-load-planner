// @ts-nocheck
/**
 * SessionController
 *
 * Orchestrates the active session lifecycle:
 *  - Starts/stops audio capture via useTranscription
 *  - Manages WebSocket connection for AI analysis results
 *  - Displays suggested question and QIS indicator within 3 s of transcript update
 *  - Accept / skip / alternatives controls; logs accepted questions
 *
 * Requirements: 3.2, 3.3, 3.4, 3.5, 3.13
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  type AnalysisResult,
  type Question,
  type MEDDICScores,
  type UserRole,
  defaultMEDDICScores,
} from '@ptv-discovery-coach/shared'
import { useTranscription } from '../lib/transcription/useTranscription'
import { TranscriptionStatus } from './TranscriptionStatus'
import { MEDDICDashboard } from './MEDDICDashboard'
import { GDPRConsentGate } from './GDPRConsentGate'
import { AnswerSummary } from './AnswerSummary'
import { SessionScorecard } from './SessionScorecard'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionControllerProps {
  sessionId: string
  accountId: string
  userRole: UserRole
  wsUrl?: string
  onSessionEnd?: (scores: MEDDICScores) => void
}

interface AcceptedQuestionLog {
  questionId: string
  questionText: string
  acceptedAt: Date
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SessionController({
  sessionId,
  accountId: _accountId,
  userRole,
  wsUrl,
  onSessionEnd,
}: SessionControllerProps): React.ReactElement {
  const { status, segments, error, audioLost, start, stop } = useTranscription()

  const [coverageScores, setCoverageScores] = useState<MEDDICScores>(defaultMEDDICScores())
  const [suggestedQuestion, setSuggestedQuestion] = useState<Question | null>(null)
  const [alternativeQuestions, setAlternativeQuestions] = useState<Question[]>([])
  const [qis, setQis] = useState<number | null>(null)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [acceptedLog, setAcceptedLog] = useState<AcceptedQuestionLog[]>([])
  const [analysisPaused, setAnalysisPaused] = useState(false)
  const [isActive, setIsActive] = useState(false)

  // New state for GDPR, answer summaries, and scorecard
  const [_gdprConsented, setGdprConsented] = useState(false)
  const [sessionPhase, setSessionPhase] = useState<'gdpr' | 'active' | 'summary' | 'ended'>('gdpr')
  const [pendingSummary, setPendingSummary] = useState<{
    questionText: string; element: string; summary: string; scoreDelta: number
  } | null>(null)
  const [startScores, setStartScores] = useState<MEDDICScores>(defaultMEDDICScores())

  const wsRef = useRef<WebSocket | null>(null)

  // ─── WebSocket setup ───────────────────────────────────────────────────────

  const connectWebSocket = useCallback(() => {
    if (!wsUrl) return

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (event: MessageEvent) => {
      try {
        const result = JSON.parse(event.data as string) as AnalysisResult & {
          analysisPaused?: boolean
        }

        setCoverageScores(result.coverageScores)
        setSuggestedQuestion(result.suggestedQuestion ?? null)
        setAlternativeQuestions(result.alternativeQuestions ?? [])
        if (result.questionIntentScore !== undefined) {
          setQis(result.questionIntentScore)
        }
        setAnalysisPaused(result.analysisPaused ?? false)
        setShowAlternatives(false)
      } catch {
        // Ignore malformed messages
      }
    }

    ws.onerror = () => {
      setAnalysisPaused(true)
    }

    return ws
  }, [wsUrl])

  // ─── Send transcript segments to backend via WebSocket ────────────────────

  useEffect(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    if (segments.length === 0) return

    const latest = segments[segments.length - 1]
    wsRef.current.send(
      JSON.stringify({ type: 'transcript_segment', sessionId, segment: latest })
    )
  }, [segments, sessionId])

  // ─── Session lifecycle ─────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    setIsActive(true)
    setStartScores({ ...coverageScores }) // Snapshot for delta calculation
    setCoverageScores(defaultMEDDICScores())
    setSuggestedQuestion(null)
    setAlternativeQuestions([])
    setQis(null)
    setAcceptedLog([])
    setPendingSummary(null)
    setSessionPhase('active')
    connectWebSocket()
    await start(sessionId)
  }, [start, sessionId, connectWebSocket, coverageScores])

  const handleStop = useCallback(() => {
    stop()
    wsRef.current?.close()
    wsRef.current = null
    setIsActive(false)
    setSessionPhase('ended')
    onSessionEnd?.(coverageScores)
  }, [stop, coverageScores, onSessionEnd])

  // ─── Question controls ─────────────────────────────────────────────────────

  const handleAccept = useCallback(() => {
    if (!suggestedQuestion) return

    // Log the accepted question
    setAcceptedLog((prev) => [
      ...prev,
      {
        questionId: suggestedQuestion.id,
        questionText: suggestedQuestion.text,
        acceptedAt: new Date(),
      },
    ])

    // Notify backend
    wsRef.current?.send(
      JSON.stringify({ type: 'question_accepted', sessionId, questionId: suggestedQuestion.id })
    )

    // Show AI answer summary instead of immediately moving to next question
    setPendingSummary({
      questionText: suggestedQuestion.text,
      element: suggestedQuestion.element,
      summary: 'Generating summary...', // Placeholder while API call runs
      scoreDelta: 12,
    })
    setSessionPhase('summary')
    setSuggestedQuestion(null)
    setQis(null)

    // Fetch AI-generated summary from backend
    fetch(`/api/sessions/${sessionId}/answer-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionText: suggestedQuestion.text,
        element: suggestedQuestion.element,
        recentTranscript: segments.slice(-5).map((s) => s.text).join('\n'),
      }),
    })
      .then((res) => res.json())
      .then((data: { summary?: string }) => {
        setPendingSummary((prev) =>
          prev ? { ...prev, summary: data.summary ?? prev.summary } : null
        )
      })
      .catch(() => {
        // Keep the placeholder — non-fatal
      })
  }, [suggestedQuestion, sessionId])

  const handleContinueFromSummary = useCallback(() => {
    setPendingSummary(null)
    setSessionPhase('active')
  }, [])

  const handleSkip = useCallback(() => {
    // Req 3.4: skip does not penalize coverage score; next suggestion targets same element
    wsRef.current?.send(
      JSON.stringify({
        type: 'question_skipped',
        sessionId,
        questionId: suggestedQuestion?.id,
        element: suggestedQuestion?.element,
      })
    )
    setSuggestedQuestion(null)
    setQis(null)
  }, [suggestedQuestion, sessionId])

  const handleShowAlternatives = useCallback(() => {
    setShowAlternatives(true)
  }, [])

  const handleSelectAlternative = useCallback(
    (question: Question) => {
      setSuggestedQuestion(question)
      setShowAlternatives(false)
      setQis(null)
    },
    []
  )

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 p-3 max-w-sm mx-auto" data-testid="session-controller">
      {/* GDPR Consent Gate — blocks everything until consent */}
      {sessionPhase === 'gdpr' && (
        <GDPRConsentGate
          onConsent={() => { setGdprConsented(true); handleStart() }}
          onDecline={() => setSessionPhase('gdpr')}
          onSkipRecording={() => { setGdprConsented(true); handleStart() }}
        />
      )}

      {/* Active session */}
      {sessionPhase !== 'gdpr' && sessionPhase !== 'ended' && (
        <>
          {/* Status bar */}
          <TranscriptionStatus status={status} error={error} audioLost={audioLost} />

          {/* Analysis paused indicator */}
          {analysisPaused && (
            <div
              className="rounded bg-orange-100 px-3 py-1 text-xs text-orange-800"
              data-testid="analysis-paused"
              role="status"
            >
              AI analysis paused — showing last known scores
            </div>
          )}

          {/* Session controls */}
          <div className="flex gap-2">
            {!isActive ? (
              <button
                onClick={() => setSessionPhase('gdpr')}
                className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                data-testid="start-session"
              >
                Start Session
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="flex-1 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white"
                data-testid="stop-session"
              >
                End Session
              </button>
            )}
          </div>

          {/* MEDDIC Dashboard */}
          <MEDDICDashboard scores={coverageScores} userRole={userRole} />

          {/* Answer Summary — shown between questions */}
          {sessionPhase === 'summary' && pendingSummary && (
            <AnswerSummary
              questionText={pendingSummary.questionText}
              element={pendingSummary.element}
              summary={pendingSummary.summary}
              scoreDelta={pendingSummary.scoreDelta}
              onContinue={handleContinueFromSummary}
            />
          )}

          {/* Suggested question panel — hidden during summary review */}
          {sessionPhase === 'active' && isActive && suggestedQuestion && (
            <QuestionPanel
              question={suggestedQuestion}
              qis={qis}
              alternatives={alternativeQuestions}
              showAlternatives={showAlternatives}
              onAccept={handleAccept}
              onSkip={handleSkip}
              onShowAlternatives={handleShowAlternatives}
              onSelectAlternative={handleSelectAlternative}
            />
          )}
        </>
      )}

      {/* Session ended — Scorecard */}
      {sessionPhase === 'ended' && (
        <SessionScorecard
          scores={coverageScores}
          startScores={startScores}
          onViewOverview={() => {/* navigate to overview */}}
          onBuildROI={() => {/* navigate to ROI */}}
          onManageContacts={() => {/* navigate to contacts */}}
          onStartNewSession={() => setSessionPhase('gdpr')}
        />
      )}

      {/* Accepted questions log (hidden, for testing) */}
      <div data-testid="accepted-log" className="hidden">
        {JSON.stringify(acceptedLog)}
      </div>
    </div>
  )
}

// ─── QuestionPanel ────────────────────────────────────────────────────────────

interface QuestionPanelProps {
  question: Question
  qis: number | null
  alternatives: Question[]
  showAlternatives: boolean
  onAccept: () => void
  onSkip: () => void
  onShowAlternatives: () => void
  onSelectAlternative: (q: Question) => void
}

function QuestionPanel({
  question,
  qis,
  alternatives,
  showAlternatives,
  onAccept,
  onSkip,
  onShowAlternatives,
  onSelectAlternative,
}: QuestionPanelProps): React.ReactElement {
  return (
    <div
      className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
      data-testid="question-panel"
    >
      {/* Element badge */}
      <span className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 mb-1">
        {question.element}
      </span>

      {/* Question text */}
      <p className="text-sm text-gray-800 mb-2" data-testid="suggested-question-text">
        {question.text}
      </p>

      {/* QIS indicator (Req 3.13) */}
      {qis !== null && (
        <div className="mb-2 flex items-center gap-2" data-testid="qis-indicator">
          <span className="text-xs text-gray-500">Intent score:</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full ${qis >= 70 ? 'bg-green-500' : 'bg-yellow-400'}`}
              style={{ width: `${qis}%` }}
            />
          </div>
          <span className="text-xs font-medium text-gray-600">{qis}</span>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={onAccept}
          className="flex-1 rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white"
          data-testid="accept-question"
        >
          Accept
        </button>
        <button
          onClick={onSkip}
          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600"
          data-testid="skip-question"
        >
          Skip
        </button>
        <button
          onClick={onShowAlternatives}
          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600"
          data-testid="show-alternatives"
        >
          Alternatives
        </button>
      </div>

      {/* Alternatives list (Req 3.5: at least 2) */}
      {showAlternatives && alternatives.length > 0 && (
        <div className="mt-2 space-y-1" data-testid="alternatives-list">
          {alternatives.map((alt) => (
            <button
              key={alt.id}
              onClick={() => onSelectAlternative(alt)}
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50"
              data-testid={`alternative-${alt.id}`}
            >
              {alt.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
