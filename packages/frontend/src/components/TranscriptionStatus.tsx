/**
 * TranscriptionStatus
 *
 * Small UI component showing:
 *  - Microphone status indicator
 *  - Non-intrusive audio-loss warning banner (Req 1.5)
 *  - Actionable error message when microphone is denied (Req 1.4)
 */

import type { TranscriptionStatus as TStatus } from '../lib/transcription/useTranscription'
import type { MicrophoneError } from '../lib/transcription/TranscriptionEngine'

// ─── Props ────────────────────────────────────────────────────────────────────

interface TranscriptionStatusProps {
  status: TStatus
  error: MicrophoneError | null
  audioLost: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TranscriptionStatus({ status, error, audioLost }: TranscriptionStatusProps) {
  return (
    <div className="transcription-status" data-testid="transcription-status">
      {/* Microphone status indicator */}
      <MicStatusIndicator status={status} />

      {/* Audio loss warning banner — non-intrusive, auto-clears when audio resumes */}
      {audioLost && (
        <div
          role="alert"
          aria-live="polite"
          data-testid="audio-lost-banner"
          className="mt-1 rounded bg-yellow-100 px-3 py-1 text-xs text-yellow-800"
        >
          Audio signal lost. Waiting to resume transcription…
        </div>
      )}

      {/* Actionable error message — shown when microphone is denied or WASM fails */}
      {error && <MicErrorMessage error={error} />}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MicStatusIndicator({ status }: { status: TStatus }) {
  const config: Record<TStatus, { label: string; dotClass: string }> = {
    idle: { label: 'Microphone off', dotClass: 'bg-gray-400' },
    initializing: { label: 'Connecting microphone…', dotClass: 'bg-yellow-400 animate-pulse' },
    running: { label: 'Transcribing', dotClass: 'bg-green-500' },
    audio_lost: { label: 'Audio signal lost', dotClass: 'bg-yellow-500 animate-pulse' },
    error: { label: 'Microphone error', dotClass: 'bg-red-500' },
    stopped: { label: 'Microphone stopped', dotClass: 'bg-gray-400' },
  }

  const { label, dotClass } = config[status]

  return (
    <div
      className="flex items-center gap-1.5 text-xs text-gray-600"
      data-testid="mic-status-indicator"
      aria-label={label}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

function MicErrorMessage({ error }: { error: MicrophoneError }) {
  return (
    <div
      role="alert"
      data-testid="mic-error-message"
      className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      <p className="font-medium">{error.message}</p>
      {'instructions' in error && error.instructions && (
        <p className="mt-1 text-xs text-red-700">{error.instructions}</p>
      )}
      {error.kind === 'permission_denied' && (
        <p className="mt-1 text-xs text-red-700">
          The session cannot start until microphone access is granted.
        </p>
      )}
    </div>
  )
}
