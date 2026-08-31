// @ts-nocheck
/**
 * ContactService
 *
 * Full CRUD for Contact records scoped to Account, session linking via
 * session_contacts join table, and business card OCR field mapping.
 *
 * Requirements: 15.1, 15.2, 15.4, 15.8
 */

import { PrismaClient } from '@prisma/client'
import {
  type Contact,
  type ContactInput,
  type SessionContact,
} from '@ptv-discovery-coach/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessCardOCRResult {
  mappedFields: Partial<ContactInput>
  unmatchedText: string[]
}

// ─── Regex patterns for OCR field mapping ─────────────────────────────────────

const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/
const PHONE_RE = /(?:\+?[\d\s\-().]{7,20})/
const LINKEDIN_RE = /(?:linkedin\.com\/in\/[\w\-]+)/i
const ADDRESS_RE = /\b\d{1,5}\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)\b/i

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapContact(record: {
  id: string
  accountId: string
  fullName: string
  jobTitle: string
  email: string
  phone: string
  address: string | null
  linkedInUrl: string | null
  buyerPersona: string
  businessCardImageUrl: string | null
  createdAt: Date
  updatedAt: Date
}): Contact {
  return {
    id: record.id,
    accountId: record.accountId,
    fullName: record.fullName,
    jobTitle: record.jobTitle,
    email: record.email,
    phone: record.phone,
    address: record.address ?? undefined,
    linkedInUrl: record.linkedInUrl ?? undefined,
    buyerPersona: record.buyerPersona as Contact['buyerPersona'],
    businessCardImageUrl: record.businessCardImageUrl ?? undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ContactService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Req 15.1: Create a contact scoped to an account */
  async createContact(accountId: string, data: ContactInput & { businessCardImageUrl?: string }): Promise<Contact> {
    const record = await this.prisma.contact.create({
      data: {
        accountId,
        fullName: data.fullName,
        jobTitle: data.jobTitle,
        email: data.email,
        phone: data.phone,
        address: data.address ?? null,
        linkedInUrl: data.linkedInUrl ?? null,
        buyerPersona: data.buyerPersona,
        businessCardImageUrl: data.businessCardImageUrl ?? null,
      },
    })
    return mapContact(record)
  }

  /** Req 15.2: Update a contact */
  async updateContact(contactId: string, data: Partial<ContactInput> & { businessCardImageUrl?: string }): Promise<Contact> {
    const record = await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.jobTitle !== undefined && { jobTitle: data.jobTitle }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.linkedInUrl !== undefined && { linkedInUrl: data.linkedInUrl }),
        ...(data.buyerPersona !== undefined && { buyerPersona: data.buyerPersona }),
        ...(data.businessCardImageUrl !== undefined && { businessCardImageUrl: data.businessCardImageUrl }),
      },
    })
    return mapContact(record)
  }

  /** Req 15.2: Delete a contact (cascade removes session_contacts via Prisma schema) */
  async deleteContact(contactId: string): Promise<void> {
    await this.prisma.contact.delete({ where: { id: contactId } })
  }

  /** Req 15.1: Get all contacts for an account */
  async getContactsByAccount(accountId: string): Promise<Contact[]> {
    const records = await this.prisma.contact.findMany({
      where: { accountId },
      orderBy: { createdAt: 'asc' },
    })
    return records.map(mapContact)
  }

  /** Req 15.8: Link a contact to a session via session_contacts join table */
  async linkContactToSession(contactId: string, sessionId: string): Promise<SessionContact> {
    const record = await this.prisma.sessionContact.upsert({
      where: { sessionId_contactId: { sessionId, contactId } },
      create: { sessionId, contactId },
      update: {},
    })
    return {
      sessionId: record.sessionId,
      contactId: record.contactId,
      linkedAt: record.linkedAt,
    }
  }

  /** Req 15.8: Unlink a contact from a session */
  async unlinkContactFromSession(contactId: string, sessionId: string): Promise<void> {
    await this.prisma.sessionContact.delete({
      where: { sessionId_contactId: { sessionId, contactId } },
    })
  }

  /** Req 15.8: Get all contacts linked to a session */
  async getContactsForSession(sessionId: string): Promise<Contact[]> {
    const records = await this.prisma.sessionContact.findMany({
      where: { sessionId },
      include: { contact: true },
    })
    return records.map((r: { contact: Parameters<typeof mapContact>[0] }) => mapContact(r.contact))
  }

  /**
   * Req 15.4: Map raw OCR text to ContactInput fields using regex patterns.
   * Returns mapped fields and any tokens that could not be matched.
   */
  mapBusinessCardOCR(extractedText: string): BusinessCardOCRResult {
    const mappedFields: Partial<ContactInput> = {}
    const lines = extractedText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    const usedLines = new Set<number>()

    // Email
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(EMAIL_RE)
      if (m && !mappedFields.email) {
        mappedFields.email = m[0]
        usedLines.add(i)
      }
    }

    // LinkedIn URL
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(LINKEDIN_RE)
      if (m && !mappedFields.linkedInUrl) {
        mappedFields.linkedInUrl = `https://${m[0]}`
        usedLines.add(i)
      }
    }

    // Phone (only lines that don't contain email)
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue
      const m = lines[i].match(PHONE_RE)
      if (m && !mappedFields.phone) {
        const candidate = m[0].trim()
        // Must have at least 7 digits
        if ((candidate.match(/\d/g) ?? []).length >= 7) {
          mappedFields.phone = candidate
          usedLines.add(i)
        }
      }
    }

    // Address
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue
      const m = lines[i].match(ADDRESS_RE)
      if (m && !mappedFields.address) {
        mappedFields.address = lines[i]
        usedLines.add(i)
      }
    }

    // Name heuristic: first non-matched line that looks like a name (2+ words, no digits)
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue
      const line = lines[i]
      if (/^\d/.test(line)) continue
      if (/\d{3,}/.test(line)) continue
      if (line.split(/\s+/).length >= 2 && !mappedFields.fullName) {
        mappedFields.fullName = line
        usedLines.add(i)
        break
      }
    }

    // Job title heuristic: next non-matched line after name that looks like a title
    const titleKeywords = /\b(manager|director|vp|vice president|analyst|engineer|architect|officer|lead|head|president|ceo|cto|cfo|coo|founder|partner|consultant|specialist|coordinator|executive|associate|senior|junior|principal)\b/i
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue
      const line = lines[i]
      if (titleKeywords.test(line) && !mappedFields.jobTitle) {
        mappedFields.jobTitle = line
        usedLines.add(i)
        break
      }
    }

    // Remaining unmatched lines
    const unmatchedText = lines.filter((_, i) => !usedLines.has(i))

    return { mappedFields, unmatchedText }
  }
}
