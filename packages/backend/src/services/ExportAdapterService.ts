// @ts-nocheck
/**
 * ExportAdapterService
 *
 * Extensible export interface with Salesforce and Microsoft Graph adapters.
 * Exponential backoff retry: 1s, 2s, 4s, max 3 attempts on network/API errors.
 * Re-auth prompt flag on 401 errors.
 *
 * Requirements: 8.1, 8.2, 8.4, 8.5, 8.6, 15.6, 15.7, 15.10
 */

import {
  type Summary,
  type MEDDICScores,
  type Contact,
} from '@ptv-discovery-coach/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportPayload {
  sessionId: string
  accountId: string
  summary: Summary
  coverageScores: MEDDICScores
  contacts: Contact[]
}

export interface ExportResult {
  success: boolean
  channel: string
  exportedAt: Date
  errorMessage?: string
  requiresReAuth?: boolean
  /** Number of contacts upserted in the CRM */
  contactUpsertCount: number
}

export interface ExportAdapter {
  export(payload: ExportPayload): Promise<ExportResult>
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = MAX_RETRIES
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      // Don't retry on auth errors — surface immediately
      if (err instanceof ExportAuthError) throw err
      if (attempt < maxRetries - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt))
      }
    }
  }
  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Error classes ────────────────────────────────────────────────────────────

export class ExportAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportAuthError'
  }
}

export class ExportNetworkError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message)
    this.name = 'ExportNetworkError'
  }
}

// ─── SalesforceAdapter ────────────────────────────────────────────────────────

export interface SalesforceAdapterOptions {
  instanceUrl: string
  accessToken: string
}

/**
 * Exports Summary + MEDDIC scores to Salesforce via REST API.
 * Upserts contacts on email (Req 15.10).
 */
export class SalesforceAdapter implements ExportAdapter {
  constructor(private readonly options: SalesforceAdapterOptions) {}

  async export(payload: ExportPayload): Promise<ExportResult> {
    try {
      const result = await withExponentialBackoff(() => this.doExport(payload))
      return result
    } catch (err) {
      if (err instanceof ExportAuthError) {
        return {
          success: false,
          channel: 'salesforce',
          exportedAt: new Date(),
          errorMessage: err.message,
          requiresReAuth: true,
          contactUpsertCount: 0,
        }
      }
      return {
        success: false,
        channel: 'salesforce',
        exportedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
        contactUpsertCount: 0,
      }
    }
  }

  private async doExport(payload: ExportPayload): Promise<ExportResult> {
    const { instanceUrl, accessToken } = this.options
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    }

    // 1. Create/update Opportunity Note with summary text
    const noteBody = {
      Title: `Discovery Session Summary — ${payload.sessionId}`,
      Body: payload.summary.repEdited || payload.summary.aiGenerated,
      // Attach to the Salesforce Opportunity linked to accountId
      ParentId: payload.accountId,
    }

    const noteRes = await fetch(`${instanceUrl}/services/data/v58.0/sobjects/Note`, {
      method: 'POST',
      headers,
      body: JSON.stringify(noteBody),
    })

    if (noteRes.status === 401) throw new ExportAuthError('Salesforce token expired')
    if (!noteRes.ok) throw new ExportNetworkError(`Salesforce Note POST failed: ${noteRes.status}`, noteRes.status)

    // 2. Create/update custom MEDDIC scores object
    const meddicBody = {
      Session_Id__c: payload.sessionId,
      Metrics__c: payload.coverageScores.Metrics,
      Economic_Buyer__c: payload.coverageScores.EconomicBuyer,
      Decision_Criteria__c: payload.coverageScores.DecisionCriteria,
      Decision_Process__c: payload.coverageScores.DecisionProcess,
      Identify_Pain__c: payload.coverageScores.IdentifyPain,
      Champion__c: payload.coverageScores.Champion,
    }

    const meddicRes = await fetch(
      `${instanceUrl}/services/data/v58.0/sobjects/MEDDIC_Score__c`,
      { method: 'POST', headers, body: JSON.stringify(meddicBody) }
    )

    if (meddicRes.status === 401) throw new ExportAuthError('Salesforce token expired')
    if (!meddicRes.ok) throw new ExportNetworkError(`Salesforce MEDDIC POST failed: ${meddicRes.status}`, meddicRes.status)

    // 3. Upsert contacts on email (Req 15.10)
    let contactUpsertCount = 0
    for (const contact of payload.contacts) {
      const sfContact = {
        // Salesforce Contact field mapping (Req 15.6)
        LastName: contact.fullName.split(' ').slice(-1)[0] ?? contact.fullName,
        FirstName: contact.fullName.split(' ').slice(0, -1).join(' ') || undefined,
        Title: contact.jobTitle,
        Email: contact.email,
        Phone: contact.phone,
        MailingStreet: contact.address,
      }

      // Upsert on Email external ID
      const upsertRes = await fetch(
        `${instanceUrl}/services/data/v58.0/sobjects/Contact/Email/${encodeURIComponent(contact.email)}`,
        { method: 'PATCH', headers, body: JSON.stringify(sfContact) }
      )

      if (upsertRes.status === 401) throw new ExportAuthError('Salesforce token expired')
      if (upsertRes.ok || upsertRes.status === 204) {
        contactUpsertCount++
      }
    }

    return {
      success: true,
      channel: 'salesforce',
      exportedAt: new Date(),
      contactUpsertCount,
    }
  }
}

// ─── MicrosoftGraphAdapter ────────────────────────────────────────────────────

export interface MicrosoftGraphAdapterOptions {
  accessToken: string
  userId: string
}

/**
 * Exports Summary to Microsoft 365 via Graph API.
 * Upserts contacts on email (Req 15.10).
 */
export class MicrosoftGraphAdapter implements ExportAdapter {
  private readonly baseUrl = 'https://graph.microsoft.com/v1.0'

  constructor(private readonly options: MicrosoftGraphAdapterOptions) {}

  async export(payload: ExportPayload): Promise<ExportResult> {
    try {
      const result = await withExponentialBackoff(() => this.doExport(payload))
      return result
    } catch (err) {
      if (err instanceof ExportAuthError) {
        return {
          success: false,
          channel: 'microsoft365',
          exportedAt: new Date(),
          errorMessage: err.message,
          requiresReAuth: true,
          contactUpsertCount: 0,
        }
      }
      return {
        success: false,
        channel: 'microsoft365',
        exportedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
        contactUpsertCount: 0,
      }
    }
  }

  private async doExport(payload: ExportPayload): Promise<ExportResult> {
    const { accessToken, userId } = this.options
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    }

    // 1. Create OneNote page with summary (Microsoft Graph OneNote API)
    const summaryText = payload.summary.repEdited || payload.summary.aiGenerated
    const pageContent = `<!DOCTYPE html><html><head><title>Discovery Session Summary</title></head><body><p>${summaryText.replace(/\n/g, '<br/>')}</p></body></html>`

    const noteRes = await fetch(
      `${this.baseUrl}/users/${userId}/onenote/pages`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'text/html' },
        body: pageContent,
      }
    )

    if (noteRes.status === 401) throw new ExportAuthError('Microsoft Graph token expired')
    if (!noteRes.ok) throw new ExportNetworkError(`Graph OneNote POST failed: ${noteRes.status}`, noteRes.status)

    // 2. Upsert contacts via People API (Req 15.6, 15.10)
    let contactUpsertCount = 0
    for (const contact of payload.contacts) {
      // Microsoft 365 People API field mapping (Req 15.6)
      const graphContact = {
        displayName: contact.fullName,
        jobTitle: contact.jobTitle,
        emailAddresses: [{ address: contact.email, name: contact.fullName }],
        businessPhones: [contact.phone],
        businessAddress: contact.address ? { street: contact.address } : undefined,
      }

      // Check if contact exists by email
      const searchRes = await fetch(
        `${this.baseUrl}/users/${userId}/contacts?$filter=emailAddresses/any(e:e/address eq '${encodeURIComponent(contact.email)}')`,
        { headers }
      )

      if (searchRes.status === 401) throw new ExportAuthError('Microsoft Graph token expired')

      let contactId: string | undefined
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as { value?: Array<{ id: string }> }
        contactId = searchData.value?.[0]?.id
      }

      if (contactId) {
        // Update existing
        const updateRes = await fetch(
          `${this.baseUrl}/users/${userId}/contacts/${contactId}`,
          { method: 'PATCH', headers, body: JSON.stringify(graphContact) }
        )
        if (updateRes.ok || updateRes.status === 204) contactUpsertCount++
      } else {
        // Create new
        const createRes = await fetch(
          `${this.baseUrl}/users/${userId}/contacts`,
          { method: 'POST', headers, body: JSON.stringify(graphContact) }
        )
        if (createRes.ok) contactUpsertCount++
      }
    }

    return {
      success: true,
      channel: 'microsoft365',
      exportedAt: new Date(),
      contactUpsertCount,
    }
  }
}
