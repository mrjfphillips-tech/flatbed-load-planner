// @ts-nocheck
/**
 * BusinessCardScanner
 *
 * Live camera capture or file upload of a business card image.
 * Uses getUserMedia for live camera on desktop, capture attribute on mobile.
 * Runs OCR (Tesseract.js client-side) and maps fields to ContactInput.
 *
 * Requirements: 15.3, 15.4, 15.5
 */

import React, { useRef, useState, useCallback, useEffect } from 'react'
import type { ContactInput, BuyerPersona } from '@ptv-discovery-coach/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessCardScannerProps {
  onFieldsMapped: (fields: Partial<ContactInput>, imageFile: File | null) => void
  onImageUpload?: (file: File) => Promise<string>
  apiBaseUrl?: string
}

const BUYER_PERSONAS: BuyerPersona[] = [
  'fleet_manager',
  'logistics_director',
  'supply_chain_vp',
  'it_architect',
  'operations_analyst',
]

const PERSONA_LABELS: Record<string, string> = {
  fleet_manager: 'Fleet Manager',
  logistics_director: 'Logistics Director',
  supply_chain_vp: 'Supply Chain VP',
  it_architect: 'IT Architect',
  operations_analyst: 'Operations Analyst',
}

const CONTACT_FIELDS: Array<{ key: keyof ContactInput; label: string }> = [
  { key: 'fullName', label: 'Full Name' },
  { key: 'jobTitle', label: 'Job Title' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'linkedInUrl', label: 'LinkedIn URL' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function BusinessCardScanner({
  onFieldsMapped,
  onImageUpload,
  apiBaseUrl = '/api',
}: BusinessCardScannerProps): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [mode, setMode] = useState<'idle' | 'camera' | 'processing' | 'review'>('idle')
  const [error, setError] = useState<string>('')
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')

  // Mapped form fields
  const [fields, setFields] = useState<Partial<ContactInput>>({})
  const [unmatchedText, setUnmatchedText] = useState<string[]>([])
  const [assigningChip, setAssigningChip] = useState<string | null>(null)

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  // ─── Camera Functions ─────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setMode('camera')
    } catch (err) {
      setError('Camera access denied or not available. Use the Upload button instead.')
      setMode('idle')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    stopCamera()

    canvas.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], `businesscard-${Date.now()}.jpg`, { type: 'image/jpeg' })
      setCapturedFile(file)
      setPreviewUrl(URL.createObjectURL(blob))
      await processImage(file)
    }, 'image/jpeg', 0.9)
  }, [stopCamera])

  const cancelCamera = useCallback(() => {
    stopCamera()
    setMode('idle')
  }, [stopCamera])

  // ─── File Upload ──────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCapturedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    await processImage(file)
  }

  // ─── OCR Processing ───────────────────────────────────────────────────

  const processImage = async (file: File) => {
    setError('')
    setMode('processing')

    try {
      // Run client-side OCR with Tesseract.js
      const extractedText = await runClientOCR(file)

      if (!extractedText.trim()) {
        setError('No text could be extracted. Try a clearer image with good lighting.')
        setMode('idle')
        return
      }

      // Map extracted text to contact fields using simple heuristics
      const { mappedFields, unmatched } = mapTextToFields(extractedText)
      setFields(mappedFields)
      setUnmatchedText(unmatched)
      setMode('review')
    } catch (err) {
      setError(`Processing failed: ${err instanceof Error ? err.message : String(err)}`)
      setMode('idle')
    }
  }

  // ─── Field Management ─────────────────────────────────────────────────

  const handleFieldChange = (key: keyof ContactInput, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const assignChipToField = (chip: string, fieldKey: keyof ContactInput) => {
    setFields((prev) => ({
      ...prev,
      [fieldKey]: prev[fieldKey] ? `${prev[fieldKey]} ${chip}` : chip,
    }))
    setUnmatchedText((prev) => prev.filter((t) => t !== chip))
    setAssigningChip(null)
  }

  const handleConfirm = async () => {
    if (capturedFile && onImageUpload) {
      try { await onImageUpload(capturedFile) } catch {}
    }
    onFieldsMapped(fields, capturedFile)
    resetState()
  }

  const resetState = () => {
    setMode('idle')
    setFields({})
    setUnmatchedText([])
    setCapturedFile(null)
    setPreviewUrl('')
    setError('')
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4" data-testid="business-card-scanner">
      <p className="text-sm font-medium text-gray-700">📇 Scan Business Card</p>

      {/* Idle: Show Camera + Upload buttons */}
      {mode === 'idle' && (
        <div className="flex gap-2">
          <button
            onClick={startCamera}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
          >
            📷 Camera
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
          >
            📁 Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* Camera Mode: Live video feed + Snap button */}
      {mode === 'camera' && (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto max-h-64 object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex justify-center gap-3">
              <button
                onClick={capturePhoto}
                className="rounded-full bg-white w-14 h-14 flex items-center justify-center shadow-lg hover:bg-gray-100 active:scale-95 transition-transform"
                title="Take photo"
              >
                <div className="w-10 h-10 rounded-full border-4 border-red-500" />
              </button>
            </div>
          </div>
          <button
            onClick={cancelCamera}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Processing indicator */}
      {mode === 'processing' && (
        <div className="text-center py-6 space-y-3">
          {previewUrl && (
            <img src={previewUrl} alt="Captured" className="mx-auto max-h-32 rounded-lg border" />
          )}
          <p className="text-sm text-blue-600 animate-pulse">
            Extracting text from business card…
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600" role="alert">{error}</p>
      )}

      {/* Review: Show mapped fields + unmatched chips */}
      {mode === 'review' && (
        <div className="space-y-4">
          {previewUrl && (
            <img src={previewUrl} alt="Scanned card" className="max-h-24 rounded border mx-auto" />
          )}

          {/* Unmatched chips */}
          {unmatchedText.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">
                Unmatched text — tap to assign to a field:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {unmatchedText.map((token) => (
                  <button
                    key={token}
                    onClick={() => setAssigningChip(assigningChip === token ? null : token)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      assigningChip === token
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {token}
                  </button>
                ))}
              </div>
              {assigningChip && (
                <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-2">
                  <p className="text-xs text-blue-700 mb-1">Assign "{assigningChip}" to:</p>
                  <div className="flex flex-wrap gap-1">
                    {CONTACT_FIELDS.map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => assignChipToField(assigningChip, key)}
                        className="rounded border border-blue-300 bg-white px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-100"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mapped fields form */}
          <div className="space-y-2">
            {CONTACT_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
                <input
                  type={key === 'email' ? 'email' : 'text'}
                  value={(fields[key] as string) ?? ''}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  placeholder={label}
                  className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Buyer Persona</label>
              <select
                value={fields.buyerPersona ?? ''}
                onChange={(e) => handleFieldChange('buyerPersona', e.target.value)}
                className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
              >
                <option value="">Select persona…</option>
                {BUYER_PERSONAS.map((p) => (
                  <option key={p} value={p}>{PERSONA_LABELS[p] || p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConfirm}
              className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              ✓ Use These Fields
            </button>
            <button
              onClick={resetState}
              className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

// ─── Client-side OCR ──────────────────────────────────────────────────────────

async function runClientOCR(file: File): Promise<string> {
  try {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('eng')
    const { data } = await worker.recognize(file)
    await worker.terminate()
    return data.text.trim()
  } catch {
    return ''
  }
}

// ─── Field Mapping Heuristics ─────────────────────────────────────────────────

function mapTextToFields(text: string): { mappedFields: Partial<ContactInput>; unmatched: string[] } {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const mappedFields: Partial<ContactInput> = {}
  const unmatched: string[] = []

  for (const line of lines) {
    // Email detection
    const emailMatch = line.match(/[\w.-]+@[\w.-]+\.\w+/)
    if (emailMatch && !mappedFields.email) {
      mappedFields.email = emailMatch[0]
      continue
    }

    // Phone detection
    const phoneMatch = line.match(/[\+]?[\d\s\-().]{7,}/)
    if (phoneMatch && !mappedFields.phone) {
      mappedFields.phone = phoneMatch[0].trim()
      continue
    }

    // LinkedIn URL
    if (line.toLowerCase().includes('linkedin.com') && !mappedFields.linkedInUrl) {
      const urlMatch = line.match(/https?:\/\/[^\s]+linkedin[^\s]*/i)
      mappedFields.linkedInUrl = urlMatch ? urlMatch[0] : line
      continue
    }

    // Web URL (not LinkedIn) - skip
    if (line.match(/^https?:\/\//i) || line.match(/^www\./i)) {
      unmatched.push(line)
      continue
    }

    // First line that looks like a name (2-3 words, no numbers)
    if (!mappedFields.fullName && line.match(/^[A-Z][a-z]+ [A-Z][a-z]+/) && !line.match(/\d/)) {
      mappedFields.fullName = line
      continue
    }

    // Job title detection (common keywords)
    const titleKeywords = /\b(director|manager|vp|president|ceo|coo|cfo|head|lead|chief|analyst|engineer|architect|coordinator|planner|supervisor|specialist)\b/i
    if (!mappedFields.jobTitle && titleKeywords.test(line)) {
      mappedFields.jobTitle = line
      continue
    }

    // Address detection (contains number + street-like pattern)
    if (!mappedFields.address && line.match(/\d+\s+\w+\s+(st|street|ave|avenue|rd|road|blvd|dr|drive|way|ln|lane|pkwy|ct)/i)) {
      mappedFields.address = line
      continue
    }

    // Everything else is unmatched
    if (line.length > 2) {
      unmatched.push(line)
    }
  }

  return { mappedFields, unmatched }
}
