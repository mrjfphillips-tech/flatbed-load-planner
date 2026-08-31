// @ts-nocheck
/**
 * Unit tests for SessionService
 *
 * Uses a mocked PrismaClient to avoid a real database connection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionService } from '../services/SessionService'
import { defaultMEDDICScores, MEDDIC_ELEMENTS, type MEDDICScores } from '@ptv-discovery-coach/shared'

// ─── Prisma mock factory ──────────────────────────────────────────────────────

function makeSessionRecord(overrides: Partial<ReturnType<typeof baseRecord>> = {}) {
  return { ...baseRecord(), ...overrides }
}

function baseRecord() {
  return {
    id: 'session-1',
    accountId: 'account-1',
    repId: 'rep-1',
    startedAt: new Date('2024-01-01T10:00:00Z'),
    endedAt: null as Date | null,
    durationSeconds: null as number | null,
    coverageScores: defaultMEDDICScores(),
    autoSavedAt: null,
    sessionType: 'live',
    audioRecordingUrl: null,
  }
}

function makePrisma() {
  return {
    session: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    transcriptSegment: {
      upsert: vi.fn(),
    },
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SessionService', () => {
  let prisma: ReturnType<typeof makePrisma>
  let service: SessionService

  beforeEach(() => {
    prisma = makePrisma()
    service = new SessionService(prisma as never)
  })

  // ── createSession ──────────────────────────────────────────────────────────

  describe('createSession', () => {
    it('creates a session with the given accountId and repId', async () => {
      const record = makeSessionRecord()
      prisma.session.create.mockResolvedValue(record)

      const session = await service.createSession('account-1', 'rep-1')

      expect(prisma.session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: 'account-1',
            repId: 'rep-1',
            sessionType: 'live',
          }),
        })
      )
      expect(session.accountId).toBe('account-1')
      expect(session.repId).toBe('rep-1')
      expect(session.sessionType).toBe('live')
    })

    it('initialises coverageScores to all zeros', async () => {
      const record = makeSessionRecord()
      prisma.session.create.mockResolvedValue(record)

      const session = await service.createSession('account-1', 'rep-1')

      for (const el of MEDDIC_ELEMENTS) {
        expect(session.coverageScores[el]).toBe(0)
      }
    })
  })

  // ── autoSave ───────────────────────────────────────────────────────────────

  describe('autoSave', () => {
    it('updates autoSavedAt and coverageScores', async () => {
      prisma.session.update.mockResolvedValue(makeSessionRecord())

      const scores: MEDDICScores = defaultMEDDICScores()
      scores['Metrics'] = 55

      await service.autoSave('session-1', { coverageScores: scores })

      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            coverageScores: scores,
          }),
        })
      )
    })

    it('upserts transcript segments when provided', async () => {
      prisma.session.update.mockResolvedValue(makeSessionRecord())
      prisma.transcriptSegment.upsert.mockResolvedValue({})

      const segment = {
        id: 'seg-1',
        sessionId: 'session-1',
        text: 'Hello',
        startMs: 0,
        endMs: 500,
        source: 'speech' as const,
        createdAt: new Date(),
      }

      await service.autoSave('session-1', { transcriptSegments: [segment] })

      expect(prisma.transcriptSegment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'seg-1' },
          create: expect.objectContaining({ text: 'Hello' }),
        })
      )
    })

    it('does not upsert segments when none are provided', async () => {
      prisma.session.update.mockResolvedValue(makeSessionRecord())

      await service.autoSave('session-1', {})

      expect(prisma.transcriptSegment.upsert).not.toHaveBeenCalled()
    })
  })

  // ── getSessionHistory ──────────────────────────────────────────────────────

  describe('getSessionHistory', () => {
    it('returns sessions sorted descending by startedAt', async () => {
      const older = makeSessionRecord({
        id: 'session-old',
        startedAt: new Date('2024-01-01T09:00:00Z'),
      })
      const newer = makeSessionRecord({
        id: 'session-new',
        startedAt: new Date('2024-01-02T10:00:00Z'),
      })

      // Prisma returns them in the order we specify (already sorted by the query)
      prisma.session.findMany.mockResolvedValue([newer, older])

      const sessions = await service.getSessionHistory('account-1')

      expect(prisma.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId: 'account-1' },
          orderBy: { startedAt: 'desc' },
        })
      )
      expect(sessions[0].id).toBe('session-new')
      expect(sessions[1].id).toBe('session-old')
    })

    it('returns an empty array when no sessions exist', async () => {
      prisma.session.findMany.mockResolvedValue([])
      const sessions = await service.getSessionHistory('account-1')
      expect(sessions).toHaveLength(0)
    })
  })

  // ── finalizeSession ────────────────────────────────────────────────────────

  describe('finalizeSession', () => {
    it('writes coverageScores, endedAt, and durationSeconds', async () => {
      const startedAt = new Date('2024-01-01T10:00:00Z')
      prisma.session.findUniqueOrThrow.mockResolvedValue(makeSessionRecord({ startedAt }))

      const finalScores: MEDDICScores = defaultMEDDICScores()
      for (const el of MEDDIC_ELEMENTS) finalScores[el] = 75

      const finalRecord = makeSessionRecord({
        startedAt,
        endedAt: new Date(),
        durationSeconds: 3600,
        coverageScores: finalScores,
      })
      prisma.session.update.mockResolvedValue(finalRecord)

      const session = await service.finalizeSession('session-1', finalScores)

      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            coverageScores: finalScores,
          }),
        })
      )
      expect(session.coverageScores).toEqual(finalScores)
    })

    it('uses existing scores when no coverageScores argument is provided', async () => {
      const existingScores: MEDDICScores = defaultMEDDICScores()
      existingScores['Metrics'] = 60

      prisma.session.findUniqueOrThrow.mockResolvedValue(
        makeSessionRecord({ coverageScores: existingScores })
      )
      prisma.session.update.mockResolvedValue(
        makeSessionRecord({ coverageScores: existingScores, endedAt: new Date() })
      )

      await service.finalizeSession('session-1')

      expect(prisma.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            coverageScores: existingScores,
          }),
        })
      )
    })
  })
})
