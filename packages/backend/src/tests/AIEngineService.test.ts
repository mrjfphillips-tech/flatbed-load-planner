// @ts-nocheck
/**
 * Unit tests for AIEngineService
 *
 * Uses a mocked fetch to avoid real OpenAI calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIEngineService, GPT4oError } from '../services/AIEngineService'
import {
  defaultMEDDICScores,
  MEDDIC_ELEMENTS,
  type TranscriptSegment,
  type Question,
  type MEDDICScores,
} from '@ptv-discovery-coach/shared'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSegment(text: string): TranscriptSegment {
  return {
    id: crypto.randomUUID(),
    sessionId: 'session-1',
    text,
    startMs: 0,
    endMs: 1000,
    source: 'speech',
    createdAt: new Date(),
  }
}

function makeQuestion(element: string, id = 'q1'): Question {
  return {
    id,
    text: `Tell me about your ${element}`,
    element: element as Question['element'],
    persona: 'FleetManager',
    isActive: true,
    createdAt: new Date(),
  }
}

function mockFetchOk(body: object) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(body) } }],
    }),
  })
}

function mockFetchError(status: number) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AIEngineService', () => {
  let service: AIEngineService

  beforeEach(() => {
    service = new AIEngineService({ openAiApiKey: 'test-key' })
    vi.restoreAllMocks()
  })

  // ── analyzeTranscript ──────────────────────────────────────────────────────

  describe('analyzeTranscript', () => {
    it('returns all 12 MEDDIC scores in [0, 100] on success', async () => {
      const scores: Record<string, number> = {}
      for (const el of MEDDIC_ELEMENTS) scores[el] = 50

      vi.stubGlobal('fetch', mockFetchOk(scores))

      const result = await service.analyzeTranscript(
        [makeSegment('We need to reduce fleet costs by 20%')],
        defaultMEDDICScores()
      )

      expect(Object.keys(result.coverageScores)).toHaveLength(12)
      for (const el of MEDDIC_ELEMENTS) {
        expect(result.coverageScores[el]).toBeGreaterThanOrEqual(0)
        expect(result.coverageScores[el]).toBeLessThanOrEqual(100)
      }
      expect(result.analysisPaused).toBe(false)
    })

    it('clamps out-of-range scores to [0, 100]', async () => {
      const scores: Record<string, number> = {}
      for (const el of MEDDIC_ELEMENTS) scores[el] = 150 // out of range

      vi.stubGlobal('fetch', mockFetchOk(scores))

      const result = await service.analyzeTranscript([makeSegment('test')], defaultMEDDICScores())

      for (const el of MEDDIC_ELEMENTS) {
        expect(result.coverageScores[el]).toBeLessThanOrEqual(100)
      }
    })

    it('retains last known scores and sets analysisPaused on 5xx', async () => {
      // First call succeeds
      const goodScores: Record<string, number> = {}
      for (const el of MEDDIC_ELEMENTS) goodScores[el] = 40

      vi.stubGlobal('fetch', mockFetchOk(goodScores))
      await service.analyzeTranscript([makeSegment('first')], defaultMEDDICScores())

      // Second call fails with 503
      vi.stubGlobal('fetch', mockFetchError(503))
      const result = await service.analyzeTranscript([makeSegment('second')], defaultMEDDICScores())

      expect(result.analysisPaused).toBe(true)
      // Should retain last known scores (40 for each element)
      for (const el of MEDDIC_ELEMENTS) {
        expect(result.coverageScores[el]).toBe(40)
      }
    })

    it('sets analysisPaused on timeout (fetch abort)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'))
      )

      const result = await service.analyzeTranscript([makeSegment('test')], defaultMEDDICScores())
      expect(result.analysisPaused).toBe(true)
    })

    it('returns gap recommendations for elements below 60', async () => {
      const scores: Record<string, number> = {}
      for (const el of MEDDIC_ELEMENTS) scores[el] = 80
      scores['EconomicBuyer'] = 30 // below 60 → critical gap

      vi.stubGlobal('fetch', mockFetchOk(scores))

      const result = await service.analyzeTranscript([makeSegment('test')], defaultMEDDICScores())

      const economicBuyerGap = result.gapRecommendations.find(
        (g) => g.element === 'EconomicBuyer'
      )
      expect(economicBuyerGap).toBeDefined()
      expect(economicBuyerGap?.isCritical).toBe(true)
      expect(economicBuyerGap?.recommendedPersonas.length).toBeGreaterThan(0)
    })
  })

  // ── selectQuestion ─────────────────────────────────────────────────────────

  describe('selectQuestion', () => {
    it('selects a question targeting the lowest-coverage element', () => {
      const scores = defaultMEDDICScores()
      scores['Metrics'] = 10
      scores['EconomicBuyer'] = 50

      const questions: Question[] = [
        makeQuestion('Metrics', 'q-metrics'),
        makeQuestion('EconomicBuyer', 'q-eb'),
      ]

      const result = service.selectQuestion({ coverageScores: scores, availableQuestions: questions })
      expect(result?.element).toBe('Metrics')
    })

    it('returns null when no active questions are available', () => {
      const scores = defaultMEDDICScores()
      const result = service.selectQuestion({ coverageScores: scores, availableQuestions: [] })
      expect(result).toBeNull()
    })

    it('excludes already-used questions', () => {
      const scores = defaultMEDDICScores()
      scores['Metrics'] = 0

      const q1 = makeQuestion('Metrics', 'q1')
      const q2 = makeQuestion('Metrics', 'q2')

      const result = service.selectQuestion({
        coverageScores: scores,
        availableQuestions: [q1, q2],
        usedQuestionIds: ['q1'],
      })
      expect(result?.id).toBe('q2')
    })

    it('returns a question from any element when all are above wrap-up threshold', () => {
      const scores = defaultMEDDICScores()
      for (const el of MEDDIC_ELEMENTS) scores[el] = 85

      const questions: Question[] = [makeQuestion('Metrics', 'wrap-up-q')]
      const result = service.selectQuestion({ coverageScores: scores, availableQuestions: questions })
      expect(result).not.toBeNull()
    })
  })

  // ── evaluateQuestionIntent ─────────────────────────────────────────────────

  describe('evaluateQuestionIntent', () => {
    it('returns a score in [0, 100]', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ score: 85 }))

      const score = await service.evaluateQuestionIntent(
        makeQuestion('Metrics'),
        [makeSegment('We aim to cut costs by 20%')]
      )

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
      expect(score).toBe(85)
    })

    it('returns 0 for empty response', async () => {
      const score = await service.evaluateQuestionIntent(makeQuestion('Metrics'), [])
      expect(score).toBe(0)
    })

    it('clamps out-of-range scores', async () => {
      vi.stubGlobal('fetch', mockFetchOk({ score: 150 }))
      const score = await service.evaluateQuestionIntent(
        makeQuestion('Metrics'),
        [makeSegment('response')]
      )
      expect(score).toBe(100)
    })

    it('returns 0 on fetch error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
      const score = await service.evaluateQuestionIntent(
        makeQuestion('Metrics'),
        [makeSegment('response')]
      )
      expect(score).toBe(0)
    })
  })

  // ── evaluateElementAdvancement ─────────────────────────────────────────────

  describe('evaluateElementAdvancement', () => {
    it('advances when proportion of QIS ≥ 70 meets threshold (default 70%)', () => {
      // 3 out of 4 = 75% ≥ 70% threshold
      const result = service.evaluateElementAdvancement([80, 75, 70, 50])
      expect(result.shouldAdvance).toBe(true)
      expect(result.proportion).toBeCloseTo(0.75)
    })

    it('does not advance when proportion is below threshold', () => {
      // 1 out of 4 = 25% < 70% threshold
      const result = service.evaluateElementAdvancement([80, 50, 40, 30])
      expect(result.shouldAdvance).toBe(false)
    })

    it('returns false for empty scores', () => {
      const result = service.evaluateElementAdvancement([])
      expect(result.shouldAdvance).toBe(false)
      expect(result.proportion).toBe(0)
    })

    it('respects custom advancement threshold', () => {
      const customService = new AIEngineService({
        openAiApiKey: 'key',
        advancementThreshold: 0.5,
      })
      // 2 out of 4 = 50% ≥ 50% threshold
      const result = customService.evaluateElementAdvancement([80, 75, 40, 30])
      expect(result.shouldAdvance).toBe(true)
    })
  })

  // ── determineAdvancement ───────────────────────────────────────────────────

  describe('determineAdvancement', () => {
    it('returns advance for QIS ≥ 70', () => {
      expect(service.determineAdvancement(70)).toBe('advance')
      expect(service.determineAdvancement(100)).toBe('advance')
    })

    it('returns retain for QIS < 70', () => {
      expect(service.determineAdvancement(69)).toBe('retain')
      expect(service.determineAdvancement(0)).toBe('retain')
    })
  })

  // ── isWrapUpMode ───────────────────────────────────────────────────────────

  describe('isWrapUpMode', () => {
    it('returns true when all elements are ≥ 80', () => {
      const scores = defaultMEDDICScores()
      for (const el of MEDDIC_ELEMENTS) scores[el] = 80
      expect(service.isWrapUpMode(scores)).toBe(true)
    })

    it('returns false when any element is below 80', () => {
      const scores = defaultMEDDICScores()
      for (const el of MEDDIC_ELEMENTS) scores[el] = 80
      scores['Metrics'] = 79
      expect(service.isWrapUpMode(scores)).toBe(false)
    })
  })

  // ── lowestCoverageElement ──────────────────────────────────────────────────

  describe('lowestCoverageElement', () => {
    it('returns the element with the lowest score', () => {
      const scores = defaultMEDDICScores()
      for (const el of MEDDIC_ELEMENTS) scores[el] = 50
      scores['Champion'] = 5
      expect(service.lowestCoverageElement(scores)).toBe('Champion')
    })
  })
})
