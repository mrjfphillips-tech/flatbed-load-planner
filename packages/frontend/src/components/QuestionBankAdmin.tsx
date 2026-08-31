// @ts-nocheck
/**
 * QuestionBankAdmin
 *
 * Admin-only component for managing the Question Bank.
 * - Add individual question form
 * - Bulk CSV upload with validation feedback
 * - List of active questions with edit/deactivate controls
 *
 * Requirements: 9.1, 9.2, 9.5
 */

import React, { useState } from 'react'
import {
  MEDDIC_ELEMENTS,
  type MEDDICElement,
  type BuyerPersona,
  type Question,
  type UserRole,
} from '@ptv-discovery-coach/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

/** Locally defined — not exported from shared */
interface BulkUploadResult {
  totalRows: number
  successCount: number
  failedRows: Array<{ rowNumber: number; reason: string }>
}

export interface QuestionBankAdminProps {
  userRole: UserRole
  questions: Question[]
  onAddQuestion: (text: string, element: MEDDICElement, persona: BuyerPersona) => Promise<void>
  onEditQuestion: (id: string, text: string, element: MEDDICElement, persona: BuyerPersona) => Promise<void>
  onDeactivateQuestion: (id: string) => Promise<void>
  onBulkUpload: (csv: string) => Promise<BulkUploadResult>
}

const BUYER_PERSONAS: BuyerPersona[] = [
  'FleetManager',
  'LogisticsDirector',
  'SupplyChainVP',
  'ITArchitect',
  'OperationsAnalyst',
]

function formatLabel(s: string): string {
  return s.replace(/([A-Z])/g, ' $1').trim()
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuestionBankAdmin({
  userRole,
  questions,
  onAddQuestion,
  onEditQuestion,
  onDeactivateQuestion,
  onBulkUpload,
}: QuestionBankAdminProps): React.ReactElement | null {
  if (userRole !== 'Admin') {
    return (
      <div className="p-4 text-sm text-red-600" data-testid="access-denied">
        Access denied. Admin role required.
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8" data-testid="question-bank-admin">
      <h1 className="text-xl font-semibold text-gray-800">Question Bank Admin</h1>
      <AddQuestionForm onAdd={onAddQuestion} />
      <BulkUploadForm onUpload={onBulkUpload} />
      <QuestionList
        questions={questions}
        onEdit={onEditQuestion}
        onDeactivate={onDeactivateQuestion}
      />
    </div>
  )
}

// ─── AddQuestionForm ──────────────────────────────────────────────────────────

interface AddQuestionFormProps {
  onAdd: (text: string, element: MEDDICElement, persona: BuyerPersona) => Promise<void>
}

function AddQuestionForm({ onAdd }: AddQuestionFormProps): React.ReactElement {
  const [text, setText] = useState('')
  const [element, setElement] = useState<MEDDICElement>('Metrics')
  const [persona, setPersona] = useState<BuyerPersona>('FleetManager')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) { setError('Question text is required'); return }
    setLoading(true)
    setError('')
    try {
      await onAdd(text.trim(), element, persona)
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add question')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-label="Add question" data-testid="add-question-form">
      <h2 className="text-sm font-medium text-gray-600 mb-3">Add Question</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Question text…"
          rows={2}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm resize-none"
          data-testid="question-text-input"
        />
        <div className="flex gap-2">
          <select
            value={element}
            onChange={(e) => setElement(e.target.value as MEDDICElement)}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
            data-testid="element-select"
          >
            {MEDDIC_ELEMENTS.map((el) => (
              <option key={el} value={el}>{formatLabel(el)}</option>
            ))}
          </select>
          <select
            value={persona}
            onChange={(e) => setPersona(e.target.value as BuyerPersona)}
            className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
            data-testid="persona-select"
          >
            {BUYER_PERSONAS.map((p) => (
              <option key={p} value={p}>{formatLabel(p)}</option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          data-testid="add-question-submit"
        >
          {loading ? 'Adding…' : 'Add Question'}
        </button>
      </form>
    </section>
  )
}

// ─── BulkUploadForm ───────────────────────────────────────────────────────────

interface BulkUploadFormProps {
  onUpload: (csv: string) => Promise<BulkUploadResult>
}

function BulkUploadForm({ onUpload }: BulkUploadFormProps): React.ReactElement {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BulkUploadResult | null>(null)
  const [error, setError] = useState('')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const csv = await file.text()
      const res = await onUpload(csv)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  return (
    <section aria-label="Bulk CSV upload" data-testid="bulk-upload-form">
      <h2 className="text-sm font-medium text-gray-600 mb-2">Bulk CSV Upload</h2>
      <p className="text-xs text-gray-400 mb-2">
        CSV columns: <code>question_text, meddic_element, buyer_persona, coaching_note, industry_segment</code>
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileChange}
        disabled={loading}
        className="text-sm"
        data-testid="csv-file-input"
      />
      {loading && <p className="text-xs text-blue-600 mt-1">Uploading…</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {result && (
        <div className="mt-2 rounded border border-gray-200 bg-gray-50 p-3 text-xs space-y-1" data-testid="bulk-upload-result">
          <p className="font-medium text-gray-700">
            {result.successCount} / {result.totalRows} rows imported
          </p>
          {result.failedRows.length > 0 && (
            <div>
              <p className="text-red-600 font-medium">Failed rows:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {result.failedRows.map((r: { rowNumber: number; reason: string }) => (
                  <li key={r.rowNumber} className="text-red-500">
                    Row {r.rowNumber}: {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

// ─── QuestionList ─────────────────────────────────────────────────────────────

interface QuestionListProps {
  questions: Question[]
  onEdit: (id: string, text: string, element: MEDDICElement, persona: BuyerPersona) => Promise<void>
  onDeactivate: (id: string) => Promise<void>
}

function QuestionList({ questions, onEdit, onDeactivate }: QuestionListProps): React.ReactElement {
  const active = questions.filter((q) => q.isActive)

  return (
    <section aria-label="Active questions" data-testid="question-list">
      <h2 className="text-sm font-medium text-gray-600 mb-3">
        Active Questions ({active.length})
      </h2>
      {active.length === 0 ? (
        <p className="text-sm text-gray-400">No active questions.</p>
      ) : (
        <div className="space-y-2">
          {active.map((q) => (
            <QuestionRow
              key={q.id}
              question={q}
              onEdit={onEdit}
              onDeactivate={onDeactivate}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── QuestionRow ──────────────────────────────────────────────────────────────

interface QuestionRowProps {
  question: Question
  onEdit: (id: string, text: string, element: MEDDICElement, persona: BuyerPersona) => Promise<void>
  onDeactivate: (id: string) => Promise<void>
}

function QuestionRow({ question, onEdit, onDeactivate }: QuestionRowProps): React.ReactElement {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(question.text)
  const [element, setElement] = useState<MEDDICElement>(question.element)
  const [persona, setPersona] = useState<BuyerPersona>(question.persona)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      await onEdit(question.id, text, element, persona)
      setEditing(false)
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivate = async () => {
    setLoading(true)
    try {
      await onDeactivate(question.id)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="rounded border border-gray-200 bg-white p-3 space-y-2"
      data-testid={`question-row-${question.id}`}
    >
      {editing ? (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm resize-none"
          />
          <div className="flex gap-2">
            <select
              value={element}
              onChange={(e) => setElement(e.target.value as MEDDICElement)}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
            >
              {MEDDIC_ELEMENTS.map((el) => (
                <option key={el} value={el}>{formatLabel(el)}</option>
              ))}
            </select>
            <select
              value={persona}
              onChange={(e) => setPersona(e.target.value as BuyerPersona)}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
            >
              {BUYER_PERSONAS.map((p) => (
                <option key={p} value={p}>{formatLabel(p)}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800">{question.text}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatLabel(question.element)} · {formatLabel(question.persona)}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
              data-testid={`edit-${question.id}`}
            >
              Edit
            </button>
            <button
              onClick={handleDeactivate}
              disabled={loading}
              className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
              data-testid={`deactivate-${question.id}`}
            >
              Deactivate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
