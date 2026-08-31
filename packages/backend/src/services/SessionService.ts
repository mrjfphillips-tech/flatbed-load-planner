// @ts-nocheck
/**
 * SessionService
 *
 * CRUD for Sessions and Accounts. Handles auto-save, state recovery,
 * and multi-call continuity.
 *
 * Requirements: 2.6, 4.1, 4.2, 4.3, 4.6, 4.7
 */

import { PrismaClient } from '@prisma/client'
import {
  type Session,
  type MEDDICScores,
  type TranscriptSegment,
  type Summary,
  defaultMEDDICScores,
} from '@ptv-discovery-coach/shared'
import { AIEngineService } from './AIEngineService'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionState {
  transcriptSegments?: TranscriptSegment[]
  coverageScores?: MEDDICScores
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class SessionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly aiEngine?: AIEngineService
  ) {}

  /**
   * Create a new live session associated with an account and rep.
   * Req 4.1: every session must be associated with exactly one account.
   */
  async createSession(accountId: string, repId: string): Promise<Session> {
    const record = await this.prisma.session.create({
      data: {
        accountId,
        repId,
        coverageScores: defaultMEDDICScores() as object,
        sessionType: 'live',
      },
    })

    return mapSession(record)
  }

  /**
   * Auto-save transcript segments and coverage scores.
   * Called at intervals ≤ 30 s (Req 4.6).
   */
  async autoSave(sessionId: string, state: SessionState): Promise<void> {
    const updates: Record<string, unknown> = {
      autoSavedAt: new Date(),
    }

    if (state.coverageScores !== undefined) {
      updates.coverageScores = state.coverageScores as object
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: updates,
    })

    if (state.transcriptSegments && state.transcriptSegments.length > 0) {
      // Use allSettled so a single bad segment doesn't abort the rest
      const results = await Promise.allSettled(
        state.transcriptSegments.map((seg) =>
          this.prisma.transcriptSegment.upsert({
            where: { id: seg.id },
            create: {
              id: seg.id,
              sessionId,
              text: seg.text,
              startMs: seg.startMs,
              endMs: seg.endMs,
              source: seg.source,
              ocrLabel: seg.ocrLabel ?? null,
              createdAt: seg.createdAt,
            },
            update: {
              text: seg.text,
              endMs: seg.endMs,
            },
          })
        )
      )
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failed.length > 0) {
        console.warn(`[SessionService] autoSave: ${failed.length} segment(s) failed to upsert`, failed.map((r) => r.reason))
      }
    }
  }

  /**
   * Return all sessions for an account sorted descending by startedAt.
   * Req 4.3.
   */
  async getSessionHistory(accountId: string): Promise<Session[]> {
    const records = await this.prisma.session.findMany({
      where: { accountId },
      orderBy: { startedAt: 'desc' },
    })

    return records.map(mapSession)
  }

  /**
   * Finalize a session: write final coverageScores to the sessions table,
   * set endedAt and durationSeconds.
   * Req 2.6, 4.6.
   */
  async finalizeSession(
    sessionId: string,
    coverageScores?: MEDDICScores
  ): Promise<Session> {
    const existing = await this.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
    })

    const endedAt = new Date()
    const durationSeconds = Math.round(
      (endedAt.getTime() - existing.startedAt.getTime()) / 1000
    )

    const record = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        endedAt,
        durationSeconds,
        coverageScores: (coverageScores ?? existing.coverageScores) as object,
      },
    })

    return mapSession(record)
  }

  /**
   * Retrieve a single session by id.
   */
  async getSession(sessionId: string): Promise<Session> {
    const record = await this.prisma.session.findUniqueOrThrow({
      where: { id: sessionId },
    })
    return mapSession(record)
  }

  // ─── Summary methods ───────────────────────────────────────────────────────

  /**
   * Generate a summary for a session via AIEngineService and persist it.
   * Req 7.1, 7.4
   */
  async generateSummary(sessionId: string): Promise<Summary> {
    const session = await this.prisma.session.findUniqueOrThrow({ where: { id: sessionId } })
    const segments = await this.prisma.transcriptSegment.findMany({ where: { sessionId } })

    const aiEngine = this.aiEngine ?? new AIEngineService()
    const aiText = await aiEngine.generateSummary(
      sessionId,
      segments.map((s) => ({
        id: s.id,
        sessionId: s.sessionId,
        text: s.text,
        startMs: s.startMs,
        endMs: s.endMs,
        source: s.source as 'speech' | 'ocr',
        ocrLabel: s.ocrLabel ?? undefined,
        createdAt: s.createdAt,
      })),
      (session.coverageScores as MEDDICScores) ?? defaultMEDDICScores()
    )

    // Upsert: one summary per session
    const existing = await this.prisma.summary.findFirst({ where: { sessionId } })
    let record
    if (existing) {
      record = await this.prisma.summary.update({
        where: { id: existing.id },
        data: { aiGenerated: aiText, generatedAt: new Date() },
      })
    } else {
      record = await this.prisma.summary.create({
        data: {
          sessionId,
          aiGenerated: aiText,
          repEdited: aiText,
          generatedAt: new Date(),
        },
      })
    }

    return mapSummary(record)
  }

  /**
   * Auto-save rep edits to a summary.
   * Req 7.3, 7.4
   */
  async updateSummary(summaryId: string, repEdited: string): Promise<Summary> {
    const record = await this.prisma.summary.update({
      where: { id: summaryId },
      data: { repEdited, lastEditedAt: new Date() },
    })
    return mapSummary(record)
  }

  /**
   * Retrieve the summary for a session.
   * Req 7.5
   */
  async getSummary(sessionId: string): Promise<Summary | null> {
    const record = await this.prisma.summary.findFirst({ where: { sessionId } })
    return record ? mapSummary(record) : null
  }
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapSession(record: {
  id: string
  accountId: string
  repId: string
  startedAt: Date
  endedAt: Date | null
  durationSeconds: number | null
  coverageScores: unknown
  autoSavedAt: Date | null
  sessionType: string
  audioRecordingUrl: string | null
}): Session {
  return {
    id: record.id,
    accountId: record.accountId,
    repId: record.repId,
    startedAt: record.startedAt,
    endedAt: record.endedAt ?? undefined,
    durationSeconds: record.durationSeconds ?? undefined,
    coverageScores: (record.coverageScores as MEDDICScores) ?? defaultMEDDICScores(),
    autoSavedAt: record.autoSavedAt ?? undefined,
    sessionType: record.sessionType as 'live' | 'offline_recovery',
    audioRecordingUrl: record.audioRecordingUrl ?? undefined,
  }
}

function mapSummary(record: {
  id: string
  sessionId: string
  aiGenerated: string
  repEdited: string
  generatedAt: Date
  lastEditedAt: Date | null
}): Summary {
  return {
    id: record.id,
    sessionId: record.sessionId,
    aiGenerated: record.aiGenerated,
    repEdited: record.repEdited,
    generatedAt: record.generatedAt,
    lastEditedAt: record.lastEditedAt ?? undefined,
  }
}
