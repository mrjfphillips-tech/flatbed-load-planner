/**
 * AudioExportComponent
 *
 * UI component for downloading session audio (MP3/WAV) and a ZIP of
 * session attachments. Auto-surfaces on critical app error via a React
 * error boundary.
 *
 * Requirements: 14.1, 14.2, 14.3
 */

import React, { Component, type ErrorInfo } from 'react'
import { type Attachment } from '@ptv-discovery-coach/shared'
import { AudioRecorder, downloadAttachmentsZip, type AudioFormat } from '../lib/AudioRecorder'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AudioExportComponentProps {
  /** The AudioRecorder instance for the current session */
  recorder: AudioRecorder
  /** Session attachments for ZIP download */
  attachments?: Attachment[]
  /** Called after a successful audio upload */
  onAudioUploaded?: (url: string) => void
  /** If true, renders in "critical error" mode with prominent styling */
  isCriticalError?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AudioExportComponent({
  recorder,
  attachments = [],
  onAudioUploaded: _onAudioUploaded,
  isCriticalError = false,
}: AudioExportComponentProps): React.ReactElement {
  const [audioStatus, setAudioStatus] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [zipStatus, setZipStatus] = React.useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = React.useState('')

  const handleDownloadAudio = async (format: AudioFormat) => {
    setAudioStatus('loading')
    setErrorMsg('')
    try {
      recorder.downloadAudio(format)
      setAudioStatus('done')
    } catch (err) {
      setAudioStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Download failed')
    }
  }

  const handleDownloadZip = async () => {
    setZipStatus('loading')
    setErrorMsg('')
    try {
      const files = attachments.map((a) => ({
        url: a.originalUrl,
        filename: `${a.id}.${mimeToExt(a.mimeType)}`,
      }))
      await downloadAttachmentsZip(files)
      setZipStatus('done')
    } catch (err) {
      setZipStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'ZIP download failed')
    }
  }

  const containerClass = isCriticalError
    ? 'rounded-lg border-2 border-red-500 bg-red-50 p-4 space-y-3'
    : 'rounded-lg border border-gray-200 bg-white p-4 space-y-3'

  return (
    <div className={containerClass} data-testid="audio-export-component">
      {isCriticalError && (
        <div className="text-sm font-semibold text-red-700" role="alert" data-testid="critical-error-banner">
          A critical error occurred. Save your session data before closing.
        </div>
      )}

      <p className="text-xs text-gray-600 font-medium">Download Session Audio</p>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => handleDownloadAudio('wav')}
          disabled={audioStatus === 'loading' || !recorder.blob}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          data-testid="download-wav"
        >
          {audioStatus === 'loading' ? 'Preparing…' : 'Download WAV'}
        </button>
        <button
          onClick={() => handleDownloadAudio('mp3')}
          disabled={audioStatus === 'loading' || !recorder.blob}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          data-testid="download-mp3"
        >
          {audioStatus === 'loading' ? 'Preparing…' : 'Download MP3'}
        </button>
      </div>

      {attachments.length > 0 && (
        <>
          <p className="text-xs text-gray-600 font-medium">Download Attachments</p>
          <button
            onClick={handleDownloadZip}
            disabled={zipStatus === 'loading'}
            className="rounded bg-gray-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            data-testid="download-zip"
          >
            {zipStatus === 'loading' ? 'Zipping…' : `Download ZIP (${attachments.length} file${attachments.length !== 1 ? 's' : ''})`}
          </button>
        </>
      )}

      {audioStatus === 'done' && (
        <p className="text-xs text-green-600" data-testid="audio-download-success">
          Audio download started.
        </p>
      )}
      {zipStatus === 'done' && (
        <p className="text-xs text-green-600" data-testid="zip-download-success">
          ZIP download started.
        </p>
      )}
      {(audioStatus === 'error' || zipStatus === 'error') && (
        <p className="text-xs text-red-600" data-testid="download-error">
          {errorMsg}
        </p>
      )}
    </div>
  )
}

// ─── Error Boundary ───────────────────────────────────────────────────────────

export interface AudioExportErrorBoundaryProps {
  recorder: AudioRecorder
  attachments?: Attachment[]
  onAudioUploaded?: (url: string) => void
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  errorMessage: string
}

/**
 * React error boundary that catches critical errors and surfaces
 * AudioExportComponent prominently before session termination.
 * Req 14.3
 */
export class AudioExportErrorBoundary extends Component<
  AudioExportErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: AudioExportErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, errorMessage: '' }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AudioExportErrorBoundary] Critical error caught:', error, info)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-red-700">Session Error</h2>
            <p className="text-xs text-gray-600">{this.state.errorMessage}</p>
            <AudioExportComponent
              recorder={this.props.recorder}
              attachments={this.props.attachments}
              onAudioUploaded={this.props.onAudioUploaded}
              isCriticalError
            />
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }
  return map[mimeType] ?? 'bin'
}
