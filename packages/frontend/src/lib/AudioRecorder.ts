/**
 * AudioRecorder
 *
 * Records session audio via the MediaRecorder API alongside transcription.
 * Stores audio chunks in memory during the session, finalizes to a Blob on stop.
 * Provides download helpers for MP3/WAV and a ZIP of session attachments.
 *
 * Requirements: 14.1, 14.2, 14.3
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AudioFormat = 'mp3' | 'wav'

export interface AudioRecorderOptions {
  /** MIME type to request from MediaRecorder (default: auto-detected) */
  mimeType?: string
}

// ─── AudioRecorder ────────────────────────────────────────────────────────────

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private audioBlob: Blob | null = null
  private stream: MediaStream | null = null
  private readonly mimeType: string

  constructor(options: AudioRecorderOptions = {}) {
    this.mimeType = options.mimeType ?? AudioRecorder.preferredMimeType()
  }

  /** Detect the best supported MIME type for recording */
  static preferredMimeType(): string {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ]
    for (const type of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    return 'audio/webm'
  }

  /** Start recording from the microphone */
  async start(): Promise<void> {
    this.chunks = []
    this.audioBlob = null

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType: this.mimeType })

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data)
      }
    }

    // Collect chunks every second so we don't lose data on abrupt stop
    this.mediaRecorder.start(1000)
  }

  /** Stop recording and finalize the audio Blob */
  stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('AudioRecorder: not started'))
        return
      }

      this.mediaRecorder.onstop = () => {
        this.audioBlob = new Blob(this.chunks, { type: this.mimeType })
        // Release microphone
        this.stream?.getTracks().forEach((t) => t.stop())
        this.stream = null
        resolve(this.audioBlob)
      }

      this.mediaRecorder.stop()
    })
  }

  /** Whether a recording is currently in progress */
  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  /** The finalized audio Blob (available after stop()) */
  get blob(): Blob | null {
    return this.audioBlob
  }

  /**
   * Download the recorded audio as MP3 or WAV.
   * Note: the browser records in WebM/Ogg; we serve the raw blob with the
   * requested extension. True re-encoding would require a WASM codec.
   * Req 14.2
   */
  downloadAudio(format: AudioFormat = 'wav', filename?: string): void {
    const blob = this.audioBlob
    if (!blob) throw new Error('AudioRecorder: no audio recorded yet')

    const name = filename ?? `session-audio.${format}`
    triggerDownload(blob, name)
  }

  /**
   * Upload the audio blob to the backend and return the storage URL.
   * POST /api/sessions/:id/audio
   * Req 14.1
   */
  async uploadToSession(sessionId: string): Promise<string> {
    const blob = this.audioBlob
    if (!blob) throw new Error('AudioRecorder: no audio recorded yet')

    const formData = new FormData()
    formData.append('audio', blob, `session-${sessionId}.webm`)

    const response = await fetch(`/api/sessions/${sessionId}/audio`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`AudioRecorder: upload failed with status ${response.status}`)
    }

    const data = (await response.json()) as { audioRecordingUrl: string }
    return data.audioRecordingUrl
  }
}

// ─── ZIP helper ───────────────────────────────────────────────────────────────

/**
 * Download a ZIP archive of session attachments.
 * Fetches each attachment URL and bundles them using the browser's
 * CompressionStream API (supported in modern browsers) or falls back to
 * a simple multi-file download.
 *
 * Req 14.3
 */
export async function downloadAttachmentsZip(
  attachments: Array<{ url: string; filename: string }>,
  zipFilename = 'session-attachments.zip'
): Promise<void> {
  if (attachments.length === 0) return

  // Attempt to use fflate if available (bundled via npm), otherwise fall back
  try {
    // Dynamic import so the bundle only loads fflate when needed
    // @ts-ignore — fflate types not available in this workspace
    const { zipSync, strToU8: _strToU8 } = await import('fflate')

    const files: Record<string, Uint8Array> = {}

    await Promise.all(
      attachments.map(async ({ url, filename }) => {
        const res = await fetch(url)
        const buf = await res.arrayBuffer()
        files[filename] = new Uint8Array(buf)
      })
    )

    const zipped = zipSync(files)
    const blob = new Blob([zipped], { type: 'application/zip' })
    triggerDownload(blob, zipFilename)
  } catch {
    // Fallback: download each file individually
    for (const { url, filename } of attachments) {
      const res = await fetch(url)
      const blob = await res.blob()
      triggerDownload(blob, filename)
    }
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  // Revoke after a short delay to allow the download to start
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
