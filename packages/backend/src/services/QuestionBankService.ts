// @ts-nocheck
/**
 * QuestionBankService
 *
 * Manages question CRUD, bulk CSV ingestion, and question retrieval
 * with persona/element filtering.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

import { PrismaClient, IndustrySegment } from '@prisma/client'
import {
  type Question,
  type MEDDICElement,
  type BuyerPersona,
  MEDDIC_ELEMENTS,
} from '@ptv-discovery-coach/shared'

const VALID_INDUSTRY_SEGMENTS = new Set(Object.values(IndustrySegment))

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BulkUploadResult {
  totalRows: number
  successCount: number
  failedRows: Array<{ rowNumber: number; reason: string }>
}

export interface QuestionInput {
  text: string
  element: MEDDICElement
  persona: BuyerPersona
}

export interface QuestionUpdate {
  text?: string
  element?: MEDDICElement
  persona?: BuyerPersona
}

const VALID_ELEMENTS = new Set<string>(MEDDIC_ELEMENTS)
const VALID_PERSONAS = new Set<string>([
  'FleetManager',
  'LogisticsDirector',
  'SupplyChainVP',
  'ITArchitect',
  'OperationsAnalyst',
])

// ─── Service ──────────────────────────────────────────────────────────────────

export class QuestionBankService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Return active questions filtered by element and persona.
   * Req 9.6: only active questions are returned.
   */
  async getQuestions(element: MEDDICElement, persona: BuyerPersona): Promise<Question[]> {
    const records = await this.prisma.question.findMany({
      where: { element, persona, isActive: true },
      orderBy: { createdAt: 'asc' },
    })
    return records.map(mapQuestion)
  }

  /**
   * Add a single question. Admin only (enforced at route level).
   * Req 9.1
   */
  async addQuestion(input: QuestionInput): Promise<Question> {
    const record = await this.prisma.question.create({
      data: {
        text: input.text,
        element: input.element,
        persona: input.persona,
        isActive: true,
      },
    })
    return mapQuestion(record)
  }

  /**
   * Bulk upload questions from CSV string.
   * Expected columns: text, element, persona (header row required).
   * Imports valid rows, reports invalid rows with row number + reason.
   * Req 9.2, 9.3
   */
  async bulkUpload(csv: string): Promise<BulkUploadResult> {
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length < 2) {
      return { totalRows: 0, successCount: 0, failedRows: [] }
    }

    const [headerLine, ...dataLines] = lines
    const headers = headerLine.split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))

    // Support both short format (text, element, persona) and full format
    const textIdx = Math.max(headers.indexOf('text'), headers.indexOf('question_text'))
    const elementIdx = Math.max(headers.indexOf('element'), headers.indexOf('meddic_element'))
    const personaIdx = Math.max(headers.indexOf('persona'), headers.indexOf('buyer_persona'))
    const noteIdx = Math.max(headers.indexOf('coaching_note'), headers.indexOf('note'))
    const segmentIdx = Math.max(headers.indexOf('industry_segment'), headers.indexOf('segment'))

    const failedRows: BulkUploadResult['failedRows'] = []
    const validInputs: Array<QuestionInput & { coachingNote?: string; industrySegment?: string }> = []

    for (let i = 0; i < dataLines.length; i++) {
      const rowNumber = i + 2
      const cols = parseCSVLine(dataLines[i])

      const text = textIdx >= 0 ? (cols[textIdx] ?? '').trim() : ''
      const element = elementIdx >= 0 ? (cols[elementIdx] ?? '').trim() : ''
      const persona = personaIdx >= 0 ? (cols[personaIdx] ?? '').trim() : ''
      const coachingNote = noteIdx >= 0 ? (cols[noteIdx] ?? '').trim() : ''
      const industrySegment = segmentIdx >= 0 ? (cols[segmentIdx] ?? '').trim() : ''

      if (!text) {
        failedRows.push({ rowNumber, reason: 'Missing question text' })
        continue
      }
      if (!VALID_ELEMENTS.has(element)) {
        failedRows.push({ rowNumber, reason: `Invalid element: "${element}"` })
        continue
      }
      // Allow "Any" as a wildcard persona
      if (persona !== 'Any' && !VALID_PERSONAS.has(persona)) {
        failedRows.push({ rowNumber, reason: `Invalid persona: "${persona}"` })
        continue
      }

      if (industrySegment && !VALID_INDUSTRY_SEGMENTS.has(industrySegment as IndustrySegment)) {
        failedRows.push({ rowNumber, reason: `Invalid industrySegment: "${industrySegment}"` })
        continue
      }

      validInputs.push({
        text,
        element: element as MEDDICElement,
        persona: (persona === 'Any' ? 'FleetManager' : persona) as BuyerPersona,
        coachingNote: coachingNote || undefined,
        industrySegment: industrySegment || undefined,
      })
    }

    if (validInputs.length > 0) {
      await this.prisma.question.createMany({
        data: validInputs.map((q) => ({
          text: q.text,
          element: q.element,
          persona: q.persona,
          isActive: true,
          coachingNote: q.coachingNote ?? null,
          industrySegment: (q.industrySegment as IndustrySegment | undefined) ?? null,
        })),
      })
    }

    return {
      totalRows: dataLines.length,
      successCount: validInputs.length,
      failedRows,
    }
  }

  /**
   * Deactivate a question. Sets isActive=false and deactivatedAt.
   * Historical session references are preserved (Req 9.4).
   * Admin only (enforced at route level).
   */
  async deactivateQuestion(id: string): Promise<void> {
    await this.prisma.question.update({
      where: { id },
      data: { isActive: false, deactivatedAt: new Date() },
    })
  }

  /**
   * Edit a question's text, element, or persona.
   * Admin only (enforced at route level).
   * Req 9.1
   */
  async editQuestion(id: string, updates: QuestionUpdate): Promise<Question> {
    const record = await this.prisma.question.update({
      where: { id },
      data: {
        ...(updates.text !== undefined && { text: updates.text }),
        ...(updates.element !== undefined && { element: updates.element }),
        ...(updates.persona !== undefined && { persona: updates.persona }),
      },
    })
    return mapQuestion(record)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapQuestion(record: {
  id: string
  text: string
  element: string
  persona: string
  isActive: boolean
  createdAt: Date
  deactivatedAt: Date | null
}): Question {
  return {
    id: record.id,
    text: record.text,
    element: record.element as MEDDICElement,
    persona: record.persona as BuyerPersona,
    isActive: record.isActive,
    createdAt: record.createdAt,
    deactivatedAt: record.deactivatedAt ?? undefined,
  }
}

/**
 * Minimal CSV line parser that handles quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}
