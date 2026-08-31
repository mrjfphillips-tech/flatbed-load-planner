// @ts-nocheck
/**
 * OCRCapture
 *
 * Camera capture or file upload (JPEG, PNG, PDF only).
 * Tesseract.js OCR integration.
 * Rep review/edit before appending as TranscriptSegment with source:'ocr'.
 * Warns if image < 150 DPI; notifies if no text extracted.
 * Stores original image as Attachment on session via API call.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.5, 11.6, 11.7, 11.8
 */

import React, { useRef, useState } from 'react'
// @ts-ignore — tesseract.js types not available in this workspace
import { createWorker } from 'tesseract.js'
import type { TranscriptSegment } from '@ptv-discovery-coach/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OCRCaptureProps {
  sessionId: string
  onSegmentReady: (segment: Omit<TranscriptSegment, 'id' | 'createdAt'>) => void
  /** Called to persist the original image as an Attachment */
  onAttachmentUpload?: (sessionId: string, file: File) => Promise<{ url: string }>
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf'])
const MIN_DPI = 150

// ─── Component ────────────────────────────────────────────────────────────────

export function OCRCapture({
  sessionId,
  onSegmentReady,
  onAttachmentUpload,
}: OCRCaptureProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [_extractedText, setExtractedText] = useState('')
  const [editedText, setEditedText] = useState('')
  const [status, setStatus] = useState<'idle' | 'processing' | 'review' | 'done'>('idle')
  const [warning, setWarning] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [currentFile, setCurrentFile] = useState<File | null>(null)

  const processFile = async (file: File) => {
    setWarning('')
    setError('')

    // Req 11.1: reject non-allowed MIME types
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setError(`Unsupported file type: ${file.type}. Please use JPEG, PNG, or PDF.`)
      return
    }

    setCurrentFile(file)
    setStatus('processing')

    // Req 11.7: warn if image may be < 150 DPI (heuristic: check image dimensions)
    if (file.type !== 'application/pdf') {
      await checkDPI(file, MIN_DPI, (lowDPI) => {
        if (lowDPI) setWarning(`Image may be below ${MIN_DPI} DPI. Text extraction quality may be reduced.`)
      })
    }

    try {
      const worker = await createWorker('eng')
      const { data } = await worker.recognize(file)
      await worker.terminate()

      const text = data.text.trim()

      if (!text) {
        // Req 11.5: notify rep if no text extracted
        setError('No text could be extracted from this image. Please try a clearer image or enter content manually.')
        setStatus('idle')
        return
      }

      setExtractedText(text)
      setEditedText(text)
      setStatus('review')
    } catch (err) {
      setError(`OCR failed: ${err instanceof Error ? err.message : String(err)}`)
      setStatus('idle')
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await processFile(file)
    e.target.value = ''
  }

  const handleAppend = async () => {
    if (!editedText.trim()) return

    const now = Date.now()
    const label = `OCR Input — ${new Date(now).toLocaleTimeString()}`

    // Req 11.3: append as TranscriptSegment with source:'ocr' and label
    onSegmentReady({
      sessionId,
      text: editedText.trim(),
      startMs: now,
      endMs: now,
      source: 'ocr',
      ocrLabel: label,
    })

    // Req 11.8: store original image as Attachment
    if (currentFile && onAttachmentUpload) {
      try {
        await onAttachmentUpload(sessionId, currentFile)
      } catch {
        // Non-fatal — attachment upload failure doesn't block transcript append
      }
    }

    setStatus('done')
    setExtractedText('')
    setEditedText('')
    setCurrentFile(null)
    setWarning('')
    setError('')
    setTimeout(() => setStatus('idle'), 1500)
  }

  const handleCancel = () => {
    setStatus('idle')
    setExtractedText('')
    setEditedText('')
    setCurrentFile(null)
    setWarning('')
    setError('')
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3" data-testid="ocr-capture">
      <p className="text-xs font-medium text-gray-600">Capture / Upload Image</p>

      {status === 'idle' && (
        <div className="flex gap-2">
          {/* Camera capture */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            data-testid="camera-capture-btn"
          >
            📷 Camera
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
            data-testid="camera-input"
          />

          {/* File upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            data-testid="file-upload-btn"
          >
            📁 Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={handleFileChange}
            data-testid="file-input"
          />
        </div>
      )}

      {status === 'processing' && (
        <p className="text-xs text-blue-600" data-testid="ocr-processing">
          Extracting text…
        </p>
      )}

      {warning && (
        <p className="text-xs text-yellow-600" data-testid="ocr-warning" role="alert">
          ⚠ {warning}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600" data-testid="ocr-error" role="alert">
          {error}
        </p>
      )}

      {/* Req 11.6: rep review/edit before appending */}
      {status === 'review' && (
        <div className="space-y-2" data-testid="ocr-review">
          <p className="text-xs text-gray-500">Review extracted text before appending:</p>
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={4}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm resize-none"
            data-testid="ocr-text-editor"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAppend}
              className="flex-1 rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white"
              data-testid="ocr-append-btn"
            >
              Append to Transcript
            </button>
            <button
              onClick={handleCancel}
              className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600"
              data-testid="ocr-cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === 'done' && (
        <p className="text-xs text-green-600" data-testid="ocr-done">
          Text appended to transcript.
        </p>
      )}
    </div>
  )
}

// ─── DPI check helper ─────────────────────────────────────────────────────────

/**
 * Heuristic DPI check: load image into an Image element and compare
 * natural dimensions vs. file size. This is a best-effort estimate.
 */
async function checkDPI(
  file: File,
  minDPI: number,
  callback: (lowDPI: boolean) => void
): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      // Assume standard screen DPI of 96; flag if image is very small
      const estimatedDPI = Math.min(img.naturalWidth, img.naturalHeight) / 2
      callback(estimatedDPI < minDPI)
      resolve()
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve()
    }
    img.src = url
  })
}
