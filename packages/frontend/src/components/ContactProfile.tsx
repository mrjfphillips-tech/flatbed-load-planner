// @ts-nocheck
/**
 * ContactProfile
 *
 * Add/edit/delete Contact form with all fields.
 * Integrates BusinessCardScanner for auto-populate.
 * Session attendance linking: checkbox list of sessions for the account.
 * Displays contacts grouped by BuyerPersona (list view).
 *
 * Requirements: 15.1, 15.2, 15.8, 15.9
 */

import React, { useState, useEffect } from 'react'
import type { Contact, ContactInput, Session, BuyerPersona } from '@ptv-discovery-coach/shared'
import { BusinessCardScanner } from './BusinessCardScanner'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContactProfileProps {
  accountId: string
  /** All sessions for this account (for attendance linking) */
  sessions: Session[]
  /** Existing contacts for this account */
  contacts: Contact[]
  /** Called after a contact is created/updated/deleted */
  onContactsChange: () => void
  /** Base URL for the API */
  apiBaseUrl?: string
}

const BUYER_PERSONAS: BuyerPersona[] = [
  'FleetManager',
  'LogisticsDirector',
  'SupplyChainVP',
  'ITArchitect',
  'OperationsAnalyst',
]

const EMPTY_FORM: ContactInput = {
  fullName: '',
  jobTitle: '',
  email: '',
  phone: '',
  address: '',
  linkedInUrl: '',
  buyerPersona: 'FleetManager',
}

function formatPersonaLabel(persona: BuyerPersona): string {
  return persona.replace(/([A-Z])/g, ' $1').trim()
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContactProfile({
  accountId,
  sessions,
  contacts,
  onContactsChange,
  apiBaseUrl = '/api',
}: ContactProfileProps): React.ReactElement {
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [form, setForm] = useState<ContactInput>(EMPTY_FORM)
  const [linkedSessions, setLinkedSessions] = useState<Set<string>>(new Set())
  const [showScanner, setShowScanner] = useState(false)
  const [error, setError] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Load linked sessions when editing
  useEffect(() => {
    if (mode === 'edit' && editingContact) {
      loadLinkedSessions(editingContact.id)
    }
  }, [mode, editingContact])

  const loadLinkedSessions = async (contactId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/contacts/session-links/${contactId}`)
      if (res.ok) {
        const data = (await res.json()) as Array<{ sessionId: string }>
        setLinkedSessions(new Set(data.map((d) => d.sessionId)))
      }
    } catch {
      // Non-fatal
    }
  }

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setLinkedSessions(new Set())
    setEditingContact(null)
    setError('')
    setMode('create')
  }

  const openEdit = (contact: Contact) => {
    setForm({
      fullName: contact.fullName,
      jobTitle: contact.jobTitle,
      email: contact.email,
      phone: contact.phone,
      address: contact.address ?? '',
      linkedInUrl: contact.linkedInUrl ?? '',
      buyerPersona: contact.buyerPersona,
    })
    setEditingContact(contact)
    setError('')
    setMode('edit')
  }

  const handleFieldChange = (key: keyof ContactInput, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleScannerFields = (fields: Partial<ContactInput>) => {
    setForm((prev) => ({ ...prev, ...fields }))
    setShowScanner(false)
  }

  const handleSessionToggle = async (sessionId: string, checked: boolean) => {
    if (!editingContact) return
    try {
      if (checked) {
        await fetch(`${apiBaseUrl}/contacts/${editingContact.id}/sessions/${sessionId}`, {
          method: 'POST',
        })
        setLinkedSessions((prev) => new Set([...prev, sessionId]))
      } else {
        await fetch(`${apiBaseUrl}/contacts/${editingContact.id}/sessions/${sessionId}`, {
          method: 'DELETE',
        })
        setLinkedSessions((prev) => {
          const next = new Set(prev)
          next.delete(sessionId)
          return next
        })
      }
    } catch {
      setError('Failed to update session link.')
    }
  }

  const handleSave = async () => {
    setError('')
    if (!form.fullName.trim() || !form.email.trim()) {
      setError('Full name and email are required.')
      return
    }
    setSaving(true)
    try {
      if (mode === 'create') {
        const res = await fetch(`${apiBaseUrl}/contacts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, ...form }),
        })
        if (!res.ok) throw new Error(await res.text())
        const newContact = (await res.json()) as Contact
        // Link sessions
        for (const sessionId of linkedSessions) {
          await fetch(`${apiBaseUrl}/contacts/${newContact.id}/sessions/${sessionId}`, {
            method: 'POST',
          })
        }
      } else if (mode === 'edit' && editingContact) {
        const res = await fetch(`${apiBaseUrl}/contacts/${editingContact.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error(await res.text())
      }
      onContactsChange()
      setMode('list')
    } catch (err) {
      setError(`Save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (contactId: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/contacts/${contactId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      onContactsChange()
      setDeleteConfirm(null)
    } catch (err) {
      setError(`Delete failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ─── List view ──────────────────────────────────────────────────────────────

  if (mode === 'list') {
    // Group contacts by BuyerPersona (Req 15.9)
    const byPersona = new Map<BuyerPersona, Contact[]>()
    for (const p of BUYER_PERSONAS) byPersona.set(p, [])
    for (const c of contacts) {
      const list = byPersona.get(c.buyerPersona) ?? []
      list.push(c)
      byPersona.set(c.buyerPersona, list)
    }

    return (
      <div className="space-y-4" data-testid="contact-profile-list">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Contacts</h2>
          <button
            onClick={openCreate}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            data-testid="add-contact-btn"
          >
            + Add Contact
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-600" role="alert" data-testid="list-error">
            {error}
          </p>
        )}

        {contacts.length === 0 ? (
          <p className="text-sm text-gray-400" data-testid="no-contacts">
            No contacts yet.
          </p>
        ) : (
          <div className="space-y-4">
            {BUYER_PERSONAS.map((persona) => {
              const list = byPersona.get(persona) ?? []
              if (list.length === 0) return null
              return (
                <div key={persona} data-testid={`persona-group-${persona}`}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                    {formatPersonaLabel(persona)}
                  </h3>
                  <div className="space-y-1">
                    {list.map((contact) => (
                      <ContactListRow
                        key={contact.id}
                        contact={contact}
                        onEdit={() => openEdit(contact)}
                        onDelete={() => setDeleteConfirm(contact.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Delete confirmation */}
        {deleteConfirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            data-testid="delete-confirm-modal"
          >
            <div className="rounded-lg bg-white p-5 shadow-lg max-w-xs w-full mx-4">
              <p className="text-sm text-gray-700 mb-4">Delete this contact? This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="flex-1 rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                  data-testid="confirm-delete-btn"
                >
                  Delete
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm text-gray-600"
                  data-testid="cancel-delete-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Create / Edit form ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4" data-testid="contact-profile-form">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          {mode === 'create' ? 'New Contact' : 'Edit Contact'}
        </h2>
        <button
          onClick={() => setMode('list')}
          className="text-xs text-gray-500 hover:text-gray-700"
          data-testid="back-btn"
        >
          ← Back
        </button>
      </div>

      {/* Business card scanner toggle */}
      <button
        onClick={() => setShowScanner((v) => !v)}
        className="w-full rounded border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50"
        data-testid="toggle-scanner-btn"
      >
        {showScanner ? 'Hide Scanner' : '📷 Scan Business Card to Auto-Fill'}
      </button>

      {showScanner && (
        <BusinessCardScanner
          onFieldsMapped={handleScannerFields}
          apiBaseUrl={apiBaseUrl}
        />
      )}

      {error && (
        <p className="text-xs text-red-600" role="alert" data-testid="form-error">
          {error}
        </p>
      )}

      {/* Contact fields */}
      <div className="space-y-3">
        <FormField label="Full Name *" fieldKey="fullName" value={form.fullName} onChange={handleFieldChange} />
        <FormField label="Job Title *" fieldKey="jobTitle" value={form.jobTitle} onChange={handleFieldChange} />
        <FormField label="Email *" fieldKey="email" value={form.email} onChange={handleFieldChange} type="email" />
        <FormField label="Phone *" fieldKey="phone" value={form.phone} onChange={handleFieldChange} type="tel" />
        <FormField label="Address" fieldKey="address" value={form.address ?? ''} onChange={handleFieldChange} />
        <FormField label="LinkedIn URL" fieldKey="linkedInUrl" value={form.linkedInUrl ?? ''} onChange={handleFieldChange} type="url" />

        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Buyer Persona *</label>
          <select
            value={form.buyerPersona}
            onChange={(e) => handleFieldChange('buyerPersona', e.target.value as BuyerPersona)}
            className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
            data-testid="field-buyerPersona"
          >
            {BUYER_PERSONAS.map((p) => (
              <option key={p} value={p}>
                {formatPersonaLabel(p)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Session attendance linking (Req 15.8) */}
      {sessions.length > 0 && (
        <div data-testid="session-attendance">
          <p className="text-xs font-medium text-gray-600 mb-1">Session Attendance</p>
          <div className="space-y-1 max-h-40 overflow-y-auto rounded border border-gray-200 p-2">
            {sessions.map((session) => (
              <label
                key={session.id}
                className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer"
                data-testid={`session-link-${session.id}`}
              >
                <input
                  type="checkbox"
                  checked={linkedSessions.has(session.id)}
                  onChange={(e) => {
                    if (mode === 'edit') {
                      void handleSessionToggle(session.id, e.target.checked)
                    } else {
                      setLinkedSessions((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(session.id)
                        else next.delete(session.id)
                        return next
                      })
                    }
                  }}
                  className="rounded"
                />
                <span>{formatDate(session.startedAt)}</span>
                {session.sessionType === 'offline_recovery' && (
                  <span className="rounded bg-yellow-100 px-1 py-0.5 text-yellow-700">Offline</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          data-testid="save-btn"
        >
          {saving ? 'Saving…' : mode === 'create' ? 'Create Contact' : 'Save Changes'}
        </button>
        <button
          onClick={() => setMode('list')}
          className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          data-testid="cancel-form-btn"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── ContactListRow ───────────────────────────────────────────────────────────

interface ContactListRowProps {
  contact: Contact
  onEdit: () => void
  onDelete: () => void
}

function ContactListRow({ contact, onEdit, onDelete }: ContactListRowProps): React.ReactElement {
  return (
    <div
      className="flex items-center gap-3 rounded border border-gray-100 bg-gray-50 px-3 py-2"
      data-testid={`contact-row-${contact.id}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{contact.fullName}</p>
        <p className="text-xs text-gray-500 truncate">{contact.jobTitle}</p>
        <p className="text-xs text-gray-400 truncate">{contact.email}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-white"
          data-testid={`edit-contact-${contact.id}`}
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
          data-testid={`delete-contact-${contact.id}`}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// ─── FormField ────────────────────────────────────────────────────────────────

interface FormFieldProps {
  label: string
  fieldKey: keyof ContactInput
  value: string
  onChange: (key: keyof ContactInput, value: string) => void
  type?: string
}

function FormField({ label, fieldKey, value, onChange, type = 'text' }: FormFieldProps): React.ReactElement {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        placeholder={label.replace(' *', '')}
        className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
        data-testid={`field-${fieldKey}`}
      />
    </div>
  )
}
