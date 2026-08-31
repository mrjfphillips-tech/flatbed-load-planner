/**
 * SMSEmailExport
 *
 * Pre-populated SMS (Web Share API) and email (mailto:) composition.
 * Section selection: Summary, action items, next steps.
 * Complete in ≤ 4 interactions from post-session Summary screen.
 * Logs ExportEvent on success via API.
 * Retains draft on failure.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8
 */

import React, { useState } from 'react'
import type { Summary } from '@ptv-discovery-coach/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SMSEmailExportProps {
  summary: Summary
  sessionId: string
  onLogExportEvent: (
    sessionId: string,
    channel: 'sms' | 'email',
    recipientCount: number
  ) => Promise<void>
}

interface SectionSelection {
  summary: boolean
  actionItems: boolean
  nextSteps: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSection(text: string, heading: string): string {
  const regex = new RegExp(`##\\s*${heading}[\\s\\S]*?(?=##|$)`, 'i')
  const match = text.match(regex)
  return match ? match[0].replace(/^##[^\n]*\n/, '').trim() : ''
}

function buildBody(text: string, sections: SectionSelection): string {
  const parts: string[] = []
  if (sections.summary) {
    const s = extractSection(text, 'Key Findings')
    if (s) parts.push(`Key Findings:\n${s}`)
  }
  if (sections.actionItems) {
    const s = extractSection(text, 'Action Items')
    if (s) parts.push(`Action Items:\n${s}`)
  }
  if (sections.nextSteps) {
    const s = extractSection(text, 'Recommended Next Steps')
    if (s) parts.push(`Next Steps:\n${s}`)
  }
  return parts.join('\n\n') || text
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SMSEmailExport({
  summary,
  sessionId,
  onLogExportEvent,
}: SMSEmailExportProps): React.ReactElement {
  const [sections, setSections] = useState<SectionSelection>({
    summary: true,
    actionItems: true,
    nextSteps: true,
  })
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  // Retain draft on failure (Req 12.6)
  const [draft, setDraft] = useState<string | null>(null)

  const summaryText = summary.repEdited || summary.aiGenerated
  const body = draft ?? buildBody(summaryText, sections)

  const handleToggle = (key: keyof SectionSelection) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Req 12.2, 12.8: SMS via Web Share API
  const handleSMS = async () => {
    setStatus('idle')
    setErrorMessage('')

    if (navigator.share) {
      try {
        await navigator.share({ text: body })
        await onLogExportEvent(sessionId, 'sms', 1)
        setStatus('success')
        setDraft(null)
      } catch (err) {
        // User cancelled or share failed
        if (err instanceof Error && err.name !== 'AbortError') {
          setStatus('error')
          setErrorMessage(err.message)
          setDraft(body) // Retain draft (Req 12.6)
        }
      }
    } else {
      // Fallback: open SMS URI
      const smsUri = `sms:?body=${encodeURIComponent(body)}`
      window.open(smsUri, '_blank')
      try {
        await onLogExportEvent(sessionId, 'sms', 1)
        setStatus('success')
        setDraft(null)
      } catch {
        setStatus('error')
        setErrorMessage('Failed to log export event')
        setDraft(body)
      }
    }
  }

  // Req 12.3: Email via mailto:
  const handleEmail = async () => {
    setStatus('idle')
    setErrorMessage('')

    const subject = encodeURIComponent('Discovery Session Summary')
    const bodyEncoded = encodeURIComponent(body)
    const mailtoUri = `mailto:?subject=${subject}&body=${bodyEncoded}`

    try {
      window.location.href = mailtoUri
      await onLogExportEvent(sessionId, 'email', 1)
      setStatus('success')
      setDraft(null)
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to open email client')
      setDraft(body) // Retain draft (Req 12.6)
    }
  }

  return (
    <div className="max-w-sm mx-auto p-4 space-y-4" data-testid="sms-email-export">
      <h2 className="text-sm font-semibold text-gray-700">Share via SMS or Email</h2>

      {/* Interaction 1: Section selection (Req 12.7) */}
      <div className="space-y-1" data-testid="section-selection">
        <p className="text-xs text-gray-500">Include sections:</p>
        {(
          [
            { key: 'summary', label: 'Summary / Key Findings' },
            { key: 'actionItems', label: 'Action Items' },
            { key: 'nextSteps', label: 'Next Steps' },
          ] as Array<{ key: keyof SectionSelection; label: string }>
        ).map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={sections[key]}
              onChange={() => handleToggle(key)}
              className="rounded"
              data-testid={`section-${key}`}
            />
            {label}
          </label>
        ))}
      </div>

      {/* Preview */}
      <div className="rounded border border-gray-200 bg-gray-50 p-2 max-h-32 overflow-y-auto">
        <pre className="text-xs text-gray-600 whitespace-pre-wrap">{body}</pre>
      </div>

      {/* Interaction 2+3: Send buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSMS}
          className="flex-1 rounded bg-green-600 px-3 py-2 text-xs font-medium text-white"
          data-testid="send-sms-btn"
        >
          Send SMS
        </button>
        <button
          onClick={handleEmail}
          className="flex-1 rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white"
          data-testid="send-email-btn"
        >
          Send Email
        </button>
      </div>

      {/* Status */}
      {status === 'success' && (
        <p className="text-xs text-green-600" data-testid="export-success">
          Sent successfully.
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-600" data-testid="export-error">
          {errorMessage || 'Send failed. Your draft has been retained.'}
        </p>
      )}
    </div>
  )
}
