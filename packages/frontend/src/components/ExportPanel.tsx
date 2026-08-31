/**
 * ExportPanel
 *
 * Export options: Salesforce, Microsoft 365, SMS, Email.
 * Preview before export, section selection, status display.
 *
 * Requirements: 8.3, 8.7
 */

import React, { useState } from 'react'
import { type Summary } from '@ptv-discovery-coach/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportChannel = 'salesforce' | 'microsoft365' | 'sms' | 'email'

export interface ExportSection {
  summary: boolean
  actionItems: boolean
  nextSteps: boolean
}

export interface ExportPanelProps {
  summary: Summary
  sessionId: string
  onExport: (channel: ExportChannel, sections: ExportSection) => Promise<void>
}

type ExportStatus = 'idle' | 'loading' | 'success' | 'error'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSection(text: string, heading: string): string {
  const regex = new RegExp(`##\\s*${heading}[\\s\\S]*?(?=##|$)`, 'i')
  const match = text.match(regex)
  return match ? match[0].replace(/^##[^\n]*\n/, '').trim() : ''
}

function buildPreview(text: string, sections: ExportSection): string {
  const parts: string[] = []
  if (sections.summary) {
    const s = extractSection(text, 'Key Findings')
    if (s) parts.push(`## Key Findings\n${s}`)
  }
  if (sections.actionItems) {
    const s = extractSection(text, 'Action Items')
    if (s) parts.push(`## Action Items\n${s}`)
  }
  if (sections.nextSteps) {
    const s = extractSection(text, 'Recommended Next Steps')
    if (s) parts.push(`## Next Steps\n${s}`)
  }
  return parts.join('\n\n') || text
}

const CHANNEL_LABELS: Record<ExportChannel, string> = {
  salesforce: 'Salesforce',
  microsoft365: 'Microsoft 365',
  sms: 'SMS',
  email: 'Email',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExportPanel({
  summary,
  sessionId: _sessionId,
  onExport,
}: ExportPanelProps): React.ReactElement {
  const [sections, setSections] = useState<ExportSection>({
    summary: true,
    actionItems: true,
    nextSteps: true,
  })
  const [selectedChannel, setSelectedChannel] = useState<ExportChannel | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const summaryText = summary.repEdited || summary.aiGenerated
  const previewText = buildPreview(summaryText, sections)

  const handleToggleSection = (key: keyof ExportSection) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSelectChannel = (channel: ExportChannel) => {
    setSelectedChannel(channel)
    setShowPreview(true)
    setStatus('idle')
    setErrorMessage('')
  }

  const handleConfirmExport = async () => {
    if (!selectedChannel) return
    setStatus('loading')
    setErrorMessage('')
    try {
      await onExport(selectedChannel, sections)
      setStatus('success')
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Export failed')
    }
  }

  const handleCancel = () => {
    setSelectedChannel(null)
    setShowPreview(false)
    setStatus('idle')
  }

  return (
    <div
      className="max-w-sm mx-auto p-4 space-y-4"
      data-testid="export-panel"
    >
      <h2 className="text-sm font-semibold text-gray-700">Export Session</h2>

      {/* Section selection */}
      <div className="space-y-1" data-testid="section-selection">
        <p className="text-xs text-gray-500 mb-1">Include sections:</p>
        {(
          [
            { key: 'summary', label: 'Summary / Key Findings' },
            { key: 'actionItems', label: 'Action Items' },
            { key: 'nextSteps', label: 'Next Steps' },
          ] as Array<{ key: keyof ExportSection; label: string }>
        ).map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={sections[key]}
              onChange={() => handleToggleSection(key)}
              className="rounded"
              data-testid={`section-${key}`}
            />
            {label}
          </label>
        ))}
      </div>

      {/* Channel buttons */}
      {!showPreview && (
        <div className="grid grid-cols-2 gap-2" data-testid="channel-buttons">
          {(Object.keys(CHANNEL_LABELS) as ExportChannel[]).map((channel) => (
            <button
              key={channel}
              onClick={() => handleSelectChannel(channel)}
              className="rounded border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              data-testid={`export-${channel}`}
            >
              {CHANNEL_LABELS[channel]}
            </button>
          ))}
        </div>
      )}

      {/* Preview */}
      {showPreview && selectedChannel && (
        <div className="space-y-3" data-testid="export-preview">
          <div className="rounded border border-gray-200 bg-gray-50 p-3 max-h-48 overflow-y-auto">
            <p className="text-xs text-gray-500 mb-1 font-medium">
              Preview — {CHANNEL_LABELS[selectedChannel]}
            </p>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap">{previewText}</pre>
          </div>

          {/* Status */}
          {status === 'loading' && (
            <p className="text-xs text-blue-600" data-testid="export-loading">
              Exporting…
            </p>
          )}
          {status === 'success' && (
            <p className="text-xs text-green-600" data-testid="export-success">
              Export successful.
            </p>
          )}
          {status === 'error' && (
            <p className="text-xs text-red-600" data-testid="export-error">
              {errorMessage || 'Export failed. Please try again.'}
            </p>
          )}

          {/* Confirm / Cancel */}
          {status !== 'success' && (
            <div className="flex gap-2">
              <button
                onClick={handleConfirmExport}
                disabled={status === 'loading'}
                className="flex-1 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                data-testid="confirm-export"
              >
                {status === 'loading' ? 'Exporting…' : `Export to ${CHANNEL_LABELS[selectedChannel]}`}
              </button>
              <button
                onClick={handleCancel}
                disabled={status === 'loading'}
                className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600 disabled:opacity-50"
                data-testid="cancel-export"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
