/**
 * LeexiImport
 *
 * Allows reps to browse recent Leexi calls and import them into
 * Discovery Coach for MEDDIC analysis. Also shows status of
 * webhook-imported calls.
 */

import React, { useCallback, useEffect, useState } from 'react'
import type { Account } from '@ptv-discovery-coach/shared'

export interface LeexiCall {
  id: string
  title: string
  date: string
  duration: number
  participants: string[]
  hasTranscript: boolean
}

export interface LeexiImportProps {
  accounts: Account[]
  onImportComplete?: (sessionId: string) => void
  apiBaseUrl?: string
}

export function LeexiImport({
  accounts,
  onImportComplete,
  apiBaseUrl = '/api',
}: LeexiImportProps): React.ReactElement {
  const [calls, setCalls] = useState<LeexiCall[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState<string | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? '')
  const [importResult, setImportResult] = useState<{
    sessionId: string
    segmentsImported: number
  } | null>(null)

  const fetchCalls = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${apiBaseUrl}/leexi/calls?limit=20`)
      if (!res.ok) throw new Error('Failed to fetch Leexi calls')
      const data = (await res.json()) as { calls: LeexiCall[] }
      setCalls(data.calls)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Leexi')
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl])

  useEffect(() => {
    fetchCalls()
  }, [fetchCalls])

  const handleImport = async (callId: string) => {
    if (!selectedAccountId) {
      setError('Please select an account first')
      return
    }
    setImporting(callId)
    setError('')
    setImportResult(null)
    try {
      const res = await fetch(`${apiBaseUrl}/leexi/import/${callId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccountId }),
      })
      if (!res.ok) throw new Error('Import failed')
      const result = (await res.json()) as {
        sessionId: string
        segmentsImported: number
        summaryGenerated: boolean
      }
      setImportResult({
        sessionId: result.sessionId,
        segmentsImported: result.segmentsImported,
      })
      onImportComplete?.(result.sessionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(null)
    }
  }

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
  }

  return (
    <div className="space-y-4" data-testid="leexi-import">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Import from Leexi</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Select a recent call to run MEDDIC analysis
          </p>
        </div>
        <button
          onClick={fetchCalls}
          disabled={loading}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          data-testid="refresh-calls"
        >
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {/* Account selector */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Import to account:</label>
        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          data-testid="account-select"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-xs text-red-600" role="alert" data-testid="error">
          {error}
        </p>
      )}

      {importResult && (
        <div
          className="rounded bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700"
          data-testid="import-success"
        >
          Imported {importResult.segmentsImported} transcript segments.
          MEDDIC analysis complete.
        </div>
      )}

      {/* Call list */}
      {calls.length === 0 && !loading && (
        <p className="text-xs text-gray-400 text-center py-4" data-testid="no-calls">
          No recent calls found in Leexi. Make sure your Leexi API key is configured.
        </p>
      )}

      <div className="space-y-2">
        {calls.map((call) => (
          <div
            key={call.id}
            className="rounded-lg border border-gray-200 bg-white p-3 flex items-center gap-3"
            data-testid={`call-${call.id}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {call.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400">{call.date}</span>
                <span className="text-xs text-gray-400">
                  {formatDuration(call.duration)}
                </span>
                <span className="text-xs text-gray-400">
                  {call.participants.join(', ')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {call.hasTranscript ? (
                <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                  Transcript ready
                </span>
              ) : (
                <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                  Processing…
                </span>
              )}
              <button
                onClick={() => handleImport(call.id)}
                disabled={!call.hasTranscript || importing === call.id}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                data-testid={`import-${call.id}`}
              >
                {importing === call.id ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
