/**
 * OfflineRecoveryUpload
 *
 * Allows a Rep to upload a previously recorded audio file (MP3/WAV) and
 * optional images to a new or existing Account for post-session processing.
 * Displays progress through: uploading → transcribing → analyzing → summarizing → complete.
 * Polls /api/offline-recovery/:sessionId/status every 2 s during processing.
 * On complete, navigates to the session summary view.
 *
 * Requirements: 14.4, 14.6
 */

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { type Account, type RecoveryStatus } from '@ptv-discovery-coach/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OfflineRecoveryUploadProps {
  /** List of existing accounts for the account selector */
  accounts: Account[]
  /** Called when processing is complete with the resulting sessionId */
  onComplete?: (sessionId: string) => void
  /** Called to navigate to the session summary view */
  onNavigateToSession?: (sessionId: string) => void
}

type UploadStage = RecoveryStatus['stage'] | 'idle' | 'error'

const STAGE_LABELS: Record<UploadStage, string> = {
  idle: 'Ready',
  uploading: 'Uploading…',
  transcribing: 'Transcribing audio…',
  analyzing: 'Analyzing MEDDIC coverage…',
  summarizing: 'Generating summary…',
  complete: 'Complete',
  failed: 'Failed',
  error: 'Error',
}

const STAGE_ORDER: UploadStage[] = [
  'uploading',
  'transcribing',
  'analyzing',
  'summarizing',
  'complete',
]

// ─── Component ────────────────────────────────────────────────────────────────

export function OfflineRecoveryUpload({
  accounts,
  onComplete,
  onNavigateToSession,
}: OfflineRecoveryUploadProps): React.ReactElement {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? '')
  const [newAccountName, setNewAccountName] = useState('')
  const [useNewAccount, setUseNewAccount] = useState(accounts.length === 0)

  const [stage, setStage] = useState<UploadStage>('idle')
  const [progressPct, setProgressPct] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Polling ───────────────────────────────────────────────────────────────

  const startPolling = useCallback((sid: string) => {
    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/offline-recovery/${sid}/status`)
        if (!res.ok) return

        const status = (await res.json()) as RecoveryStatus
        setStage(status.stage)
        setProgressPct(status.progressPct)

        if (status.stage === 'complete') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          onComplete?.(sid)
        } else if (status.stage === 'failed') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setErrorMessage(status.errorMessage ?? 'Processing failed')
          setStage('error')
        }
      } catch {
        // Network hiccup — keep polling
      }
    }, 2000)
  }, [onComplete])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    setAudioFile(file)
  }

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setImageFiles(files)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!audioFile) return

    setStage('uploading')
    setProgressPct(10)
    setErrorMessage('')

    try {
      // Resolve accountId — create new account if needed
      let accountId = selectedAccountId
      if (useNewAccount && newAccountName.trim()) {
        const createRes = await fetch('/api/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newAccountName.trim() }),
        })
        if (!createRes.ok) throw new Error('Failed to create account')
        const created = (await createRes.json()) as { id: string }
        accountId = created.id
      }

      if (!accountId) {
        throw new Error('Please select or create an account')
      }

      // Build multipart form data
      const formData = new FormData()
      formData.append('accountId', accountId)
      formData.append('audio', audioFile, audioFile.name)
      for (const img of imageFiles) {
        formData.append('images', img, img.name)
      }

      const uploadRes = await fetch('/api/offline-recovery/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        const err = (await uploadRes.json()) as { message?: string }
        throw new Error(err.message ?? 'Upload failed')
      }

      const data = (await uploadRes.json()) as { sessionId: string }
      setSessionId(data.sessionId)
      setStage('transcribing')
      startPolling(data.sessionId)
    } catch (err) {
      setStage('error')
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  const handleNavigate = () => {
    if (sessionId) onNavigateToSession?.(sessionId)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const isProcessing = ['uploading', 'transcribing', 'analyzing', 'summarizing'].includes(stage)
  const isComplete = stage === 'complete'
  const isError = stage === 'error' || stage === 'failed'

  return (
    <div
      className="max-w-sm mx-auto p-4 space-y-5"
      data-testid="offline-recovery-upload"
    >
      <h2 className="text-base font-semibold text-gray-800">Offline Session Recovery</h2>
      <p className="text-xs text-gray-500">
        Upload a recorded audio file to generate a full MEDDIC analysis and summary.
      </p>

      {/* Form — hidden while processing or complete */}
      {stage === 'idle' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account selector */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">Account</label>

            {accounts.length > 0 && (
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => setUseNewAccount(false)}
                  className={`text-xs px-2 py-1 rounded border ${!useNewAccount ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}
                  data-testid="use-existing-account"
                >
                  Existing
                </button>
                <button
                  type="button"
                  onClick={() => setUseNewAccount(true)}
                  className={`text-xs px-2 py-1 rounded border ${useNewAccount ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'}`}
                  data-testid="use-new-account"
                >
                  New
                </button>
              </div>
            )}

            {!useNewAccount && accounts.length > 0 ? (
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="account-select"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="New account name"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                data-testid="new-account-name"
              />
            )}
          </div>

          {/* Audio file picker */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Audio File <span className="text-gray-400">(MP3 or WAV)</span>
            </label>
            <input
              type="file"
              accept="audio/mpeg,audio/wav,.mp3,.wav"
              onChange={handleAudioChange}
              required
              className="w-full text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-blue-700"
              data-testid="audio-file-input"
            />
            {audioFile && (
              <p className="text-xs text-gray-400">{audioFile.name}</p>
            )}
          </div>

          {/* Image files picker (optional) */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">
              Images <span className="text-gray-400">(optional, for OCR)</span>
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              multiple
              onChange={handleImagesChange}
              className="w-full text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700"
              data-testid="image-files-input"
            />
            {imageFiles.length > 0 && (
              <p className="text-xs text-gray-400">{imageFiles.length} image(s) selected</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!audioFile}
            className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            data-testid="submit-upload"
          >
            Upload &amp; Process
          </button>
        </form>
      )}

      {/* Progress display */}
      {(isProcessing || isComplete || isError) && (
        <div className="space-y-3" data-testid="progress-display">
          {/* Stage steps */}
          <div className="space-y-1">
            {STAGE_ORDER.map((s) => {
              const currentIdx = STAGE_ORDER.indexOf(stage as UploadStage)
              const stepIdx = STAGE_ORDER.indexOf(s)
              const isDone = stepIdx < currentIdx || isComplete
              const isActive = s === stage && !isComplete

              return (
                <div
                  key={s}
                  className={`flex items-center gap-2 text-xs ${
                    isDone
                      ? 'text-green-600'
                      : isActive
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-400'
                  }`}
                  data-testid={`stage-${s}`}
                >
                  <span className="w-4 text-center">
                    {isDone ? '✓' : isActive ? '●' : '○'}
                  </span>
                  <span>{STAGE_LABELS[s]}</span>
                </div>
              )
            })}
          </div>

          {/* Progress bar */}
          {isProcessing && (
            <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
                data-testid="progress-bar"
              />
            </div>
          )}

          {/* Error */}
          {isError && (
            <p className="text-xs text-red-600" data-testid="error-message">
              {errorMessage}
            </p>
          )}

          {/* Complete */}
          {isComplete && (
            <div className="space-y-2">
              <p className="text-xs text-green-600 font-medium" data-testid="complete-message">
                Processing complete. Your session is ready.
              </p>
              <button
                onClick={handleNavigate}
                className="w-full rounded bg-green-600 px-4 py-2 text-sm font-medium text-white"
                data-testid="view-session-button"
              >
                View Session Summary
              </button>
            </div>
          )}

          {/* Retry on error */}
          {isError && (
            <button
              onClick={() => { setStage('idle'); setErrorMessage('') }}
              className="w-full rounded border border-gray-300 px-4 py-2 text-sm text-gray-600"
              data-testid="retry-button"
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  )
}
