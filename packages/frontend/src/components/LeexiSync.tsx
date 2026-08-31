/**
 * LeexiSync
 *
 * Bidirectional Leexi integration panel for the Account Overview.
 * Pull: browse and import Leexi call transcripts for MEDDIC analysis.
 * Push: upload session recordings to Leexi for transcription/archival.
 */

import React, { useCallback, useState } from 'react'

export interface LeexiCall {
  id: string
  title: string
  date: string
  duration: number
  participants: string[]
  hasTranscript: boolean
}

export interface SessionForPush {
  id: string
  title: string
  date: string
  duration: number
  sizeBytes: number
  pushedToLeexi: boolean
}

export interface LeexiSyncProps {
  accountId: string
  sessions?: SessionForPush[]
  apiBaseUrl?: string
  onImportComplete?: (sessionId: string) => void
  onPushComplete?: (leexiCallUuid: string) => void
}

type Panel = 'none' | 'pull' | 'push'

export function LeexiSync({
  accountId,
  sessions = [],
  apiBaseUrl = '/api',
  onImportComplete,
  onPushComplete,
}: LeexiSyncProps): React.ReactElement {
  const [panel, setPanel] = useState<Panel>('none')
  const [calls, setCalls] = useState<LeexiCall[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState<string | null>(null)
  const [pushing, setPushing] = useState<string | null>(null)
  const [pushingAll, setPushingAll] = useState(false)

  // ─── Pull: fetch Leexi calls ──────────────────────────────────────────────

  const openPull = useCallback(async () => {
    setPanel('pull')
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${apiBaseUrl}/leexi/calls?limit=20`)
      if (!res.ok) throw new Error(`Failed: ${res.status}`)
      const data = (await res.json()) as { calls: LeexiCall[] }
      setCalls(data.calls)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Leexi')
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl])

  const handleImport = useCallback(async (callId: string) => {
    setImporting(callId)
    setError('')
    try {
      const res = await fetch(`${apiBaseUrl}/leexi/import/${callId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      if (!res.ok) throw new Error('Import failed')
      const result = (await res.json()) as { sessionId: string }
      onImportComplete?.(result.sessionId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(null)
    }
  }, [apiBaseUrl, accountId, onImportComplete])

  // ─── Push: upload sessions to Leexi ───────────────────────────────────────

  const handlePushOne = useCallback(async (sessionId: string) => {
    setPushing(sessionId)
    try {
      const res = await fetch(`${apiBaseUrl}/leexi/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userUuid: '', title: 'Discovery Coach Session' }),
      })
      if (!res.ok) throw new Error('Push failed')
      const result = (await res.json()) as { leexiCallUuid: string }
      onPushComplete?.(result.leexiCallUuid)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Push failed')
    } finally {
      setPushing(null)
    }
  }, [apiBaseUrl, onPushComplete])

  const handlePushAll = useCallback(async () => {
    setPushingAll(true)
    const pending = sessions.filter((s) => !s.pushedToLeexi)
    for (const s of pending) {
      await handlePushOne(s.id)
    }
    setPushingAll(false)
  }, [sessions, handlePushOne])

  const formatDuration = (sec: number) => `${Math.floor(sec / 60)}m ${sec % 60}s`
  const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
  const pendingSessions = sessions.filter((s) => !s.pushedToLeexi)

  return (
    <div
      className="rounded-xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/5 to-blue-500/5 p-4"
      data-testid="leexi-sync"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔗</span>
        <div>
          <h3 className="text-sm font-semibold text-white">Leexi Audio Sync</h3>
          <p className="text-[11px] text-gray-500">
            Pull transcripts from Leexi or push recordings for AI processing
          </p>
        </div>
      </div>

      {/* Pull / Push buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={openPull}
          className="flex-1 flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 px-3 py-2.5 text-white text-xs font-medium hover:shadow-lg hover:shadow-indigo-500/20 transition-all hover:-translate-y-0.5"
          data-testid="pull-btn"
        >
          <span className="text-base">⬇️</span>
          <span className="text-left">
            <strong>Pull from Leexi</strong>
            <br />
            <span className="text-[10px] opacity-75">Import transcripts</span>
          </span>
        </button>
        <button
          onClick={() => setPanel('push')}
          className="flex-1 flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-3 py-2.5 text-white text-xs font-medium hover:shadow-lg hover:shadow-emerald-500/20 transition-all hover:-translate-y-0.5"
          data-testid="push-btn"
        >
          <span className="text-base">⬆️</span>
          <span className="text-left">
            <strong>Push to Leexi</strong>
            <br />
            <span className="text-[10px] opacity-75">Send recordings</span>
          </span>
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-2" role="alert">{error}</p>
      )}

      {/* Pull Panel */}
      {panel === 'pull' && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3" data-testid="pull-panel">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-white">⬇️ Pull from Leexi</span>
            <button onClick={() => setPanel('none')} className="text-xs text-gray-500 hover:text-white">✕</button>
          </div>
          {loading && <p className="text-xs text-gray-400 py-4 text-center">Loading calls...</p>}
          {!loading && calls.length === 0 && (
            <p className="text-xs text-gray-500 py-4 text-center">No recent calls found in Leexi.</p>
          )}
          <div className="space-y-1.5">
            {calls.map((call) => (
              <div
                key={call.id}
                className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/30 px-3 py-2"
                data-testid={`call-${call.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{call.title}</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-500">{call.date.slice(0, 10)}</span>
                    <span className="text-[10px] text-gray-500">{formatDuration(call.duration)}</span>
                    <span className={`text-[10px] ${call.hasTranscript ? 'text-green-400' : 'text-yellow-400'}`}>
                      {call.hasTranscript ? '✓ Ready' : '⏳ Processing'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleImport(call.id)}
                  disabled={!call.hasTranscript || importing === call.id}
                  className="rounded bg-indigo-600 px-2.5 py-1 text-[10px] font-medium text-white disabled:opacity-40"
                  data-testid={`import-${call.id}`}
                >
                  {importing === call.id ? 'Importing…' : 'Import'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Push Panel */}
      {panel === 'push' && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3" data-testid="push-panel">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-white">⬆️ Push to Leexi</span>
            <button onClick={() => setPanel('none')} className="text-xs text-gray-500 hover:text-white">✕</button>
          </div>
          {sessions.length === 0 && (
            <p className="text-xs text-gray-500 py-4 text-center">No session recordings available.</p>
          )}
          <div className="space-y-1.5">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/30 px-3 py-2 ${s.pushedToLeexi ? 'opacity-50' : ''}`}
                data-testid={`session-${s.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white">{s.title}</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-500">{formatDuration(s.duration)}</span>
                    <span className="text-[10px] text-gray-500">{formatSize(s.sizeBytes)}</span>
                    <span className={`text-[10px] ${s.pushedToLeexi ? 'text-green-400' : 'text-yellow-400'}`}>
                      {s.pushedToLeexi ? '✓ In Leexi' : 'Ready to push'}
                    </span>
                  </div>
                </div>
                {s.pushedToLeexi ? (
                  <span className="text-[10px] text-green-400">✓</span>
                ) : (
                  <button
                    onClick={() => handlePushOne(s.id)}
                    disabled={pushing === s.id}
                    className="rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-medium text-white disabled:opacity-40"
                  >
                    {pushing === s.id ? 'Uploading…' : 'Push'}
                  </button>
                )}
              </div>
            ))}
          </div>
          {pendingSessions.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handlePushAll}
                disabled={pushingAll}
                className="rounded bg-emerald-600 px-3 py-1.5 text-[10px] font-medium text-white disabled:opacity-40"
                data-testid="push-all"
              >
                {pushingAll ? 'Uploading…' : `⬆️ Push All Pending (${pendingSessions.length})`}
              </button>
              <span className="text-[10px] text-gray-500">
                {formatSize(pendingSessions.reduce((sum, s) => sum + s.sizeBytes, 0))} total
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
