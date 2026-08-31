/**
 * useTranscription
 *
 * React hook that wraps TranscriptionEngine, manages microphone state,
 * and exposes error / warning states to the UI.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TranscriptSegment } from '@ptv-discovery-coach/shared'
import { TranscriptionEngine } from './TranscriptionEngine'
import type { MicrophoneError, TranscriptionEngineOptions } from './TranscriptionEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TranscriptionStatus =
  | 'idle'
  | 'initializing'
  | 'running'
  | 'audio_lost'
  | 'error'
  | 'stopped'

export interface UseTranscriptionResult {
  /** Current status of the transcription pipeline */
  status: TranscriptionStatus
  /** Accumulated transcript segments for this session */
  segments: TranscriptSegment[]
  /** Actionable error when microphone is denied or WASM fails (Req 1.4) */
  error: MicrophoneError | null
  /** True when audio signal has been lost for > 5 s (Req 1.5) */
  audioLost: boolean
  /** Start capturing; blocks and sets error if microphone is denied */
  start: (sessionId: string) => Promise<void>
  /** Stop capturing and release resources */
  stop: () => void
  /** Estimated word error rate from the engine */
  wordErrorEstimate: number
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTranscription(options: TranscriptionEngineOptions = {}): UseTranscriptionResult {
  const engineRef = useRef<TranscriptionEngine | null>(null)

  const [status, setStatus] = useState<TranscriptionStatus>('idle')
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [error, setError] = useState<MicrophoneError | null>(null)
  const [audioLost, setAudioLost] = useState(false)
  const [wordErrorEstimate, setWordErrorEstimate] = useState(0)

  // Keep options stable across renders via ref
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const start = useCallback(async (sessionId: string) => {
    // Reset state
    setError(null)
    setAudioLost(false)
    setSegments([])
    setStatus('initializing')

    const engine = new TranscriptionEngine(optionsRef.current)
    engineRef.current = engine

    // Wire up callbacks
    engine.onSegment = (segment) => {
      setSegments((prev) => [...prev, segment])
      setWordErrorEstimate(engine.getWordErrorEstimate())
    }

    engine.onError = (err) => {
      setError(err)
      setStatus('error')
    }

    engine.onAudioLost = () => {
      // Req 1.5 — show non-intrusive warning banner
      setAudioLost(true)
      setStatus('audio_lost')
    }

    engine.onAudioRestored = () => {
      // Req 1.5 — auto-resume when audio is restored
      setAudioLost(false)
      setStatus('running')
    }

    try {
      await engine.initialize(sessionId)
      setStatus('running')
    } catch {
      // Error already set via onError callback; status already set to 'error'
      engineRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    engineRef.current?.stop()
    engineRef.current = null
    setStatus('stopped')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.stop()
      engineRef.current = null
    }
  }, [])

  return {
    status,
    segments,
    error,
    audioLost,
    start,
    stop,
    wordErrorEstimate,
  }
}
