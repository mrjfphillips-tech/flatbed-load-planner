// @ts-nocheck
/**
 * PreferenceService
 *
 * Manages per-rep Preferred_Questions and weighted question ranking.
 *
 * Weight formula:
 *   - preferred questions: +50
 *   - avgIntentScore >= 70: +30
 *   - base weight: 0
 *
 * Requirements: 13.1, 13.2, 13.4, 13.6, 13.9, 13.10
 */

import { PrismaClient } from '@prisma/client'
import {
  type Question,
  type WeightedQuestion,
  type MEDDICElement,
  type BuyerPersona,
} from '@ptv-discovery-coach/shared'

// ─── Service ──────────────────────────────────────────────────────────────────

export class PreferenceService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Star a question for a rep. Upserts RepQuestionPref with isPreferred=true.
   * Req 13.1, 13.2
   */
  async starQuestion(repId: string, questionId: string): Promise<void> {
    await this.prisma.repQuestionPref.upsert({
      where: { repId_questionId: { repId, questionId } },
      create: {
        repId,
        questionId,
        isPreferred: true,
        avgIntentScore: 0,
        useCount: 0,
        starredAt: new Date(),
      },
      update: {
        isPreferred: true,
        starredAt: new Date(),
      },
    })
  }

  /**
   * Unstar a question for a rep. Sets isPreferred=false.
   * Req 13.4
   */
  async unstarQuestion(repId: string, questionId: string): Promise<void> {
    await this.prisma.repQuestionPref.upsert({
      where: { repId_questionId: { repId, questionId } },
      create: {
        repId,
        questionId,
        isPreferred: false,
        avgIntentScore: 0,
        useCount: 0,
      },
      update: {
        isPreferred: false,
        starredAt: null,
      },
    })
  }

  /**
   * Return all preferred questions for a rep.
   * Req 13.8
   */
  async getPreferredQuestions(repId: string): Promise<Question[]> {
    const prefs = await this.prisma.repQuestionPref.findMany({
      where: { repId, isPreferred: true },
      include: { question: true },
    })
    return prefs
      .filter((p) => p.question.isActive)
      .map((p) => mapQuestion(p.question))
  }

  /**
   * Return questions ranked by weight for a given element + persona.
   * Weight: preferred +50, avgIntentScore >= 70 +30, base 0.
   * Req 13.6, 13.9
   */
  async getWeightedQuestions(
    repId: string,
    element: MEDDICElement,
    persona: BuyerPersona
  ): Promise<WeightedQuestion[]> {
    const questions = await this.prisma.question.findMany({
      where: { element, persona, isActive: true },
    })

    const prefMap = new Map<string, { isPreferred: boolean; avgIntentScore: number }>()
    if (questions.length > 0) {
      const prefs = await this.prisma.repQuestionPref.findMany({
        where: {
          repId,
          questionId: { in: questions.map((q) => q.id) },
        },
      })
      for (const p of prefs) {
        prefMap.set(p.questionId, {
          isPreferred: p.isPreferred,
          avgIntentScore: p.avgIntentScore,
        })
      }
    }

    const weighted: WeightedQuestion[] = questions.map((q) => {
      const pref = prefMap.get(q.id)
      const isPreferred = pref?.isPreferred ?? false
      const avgIntentScore = pref?.avgIntentScore ?? 0

      let weight = 0
      if (isPreferred) weight += 50
      if (avgIntentScore >= 70) weight += 30

      return {
        question: mapQuestion(q),
        weight,
        isPreferred,
        avgIntentScore,
      }
    })

    // Sort descending by weight
    return weighted.sort((a, b) => b.weight - a.weight)
  }

  /**
   * Update the rolling average intent score for a rep+question pair.
   * Req 13.9
   */
  async updateIntentScore(repId: string, questionId: string, newScore: number): Promise<void> {
    const existing = await this.prisma.repQuestionPref.findUnique({
      where: { repId_questionId: { repId, questionId } },
    })

    if (existing) {
      // Rolling average: (avgIntentScore * useCount + newScore) / (useCount + 1)
      const newCount = existing.useCount + 1
      const newAvg = (existing.avgIntentScore * existing.useCount + newScore) / newCount
      await this.prisma.repQuestionPref.update({
        where: { repId_questionId: { repId, questionId } },
        data: {
          avgIntentScore: Math.round(newAvg * 100) / 100,
          useCount: newCount,
        },
      })
    } else {
      await this.prisma.repQuestionPref.create({
        data: {
          repId,
          questionId,
          isPreferred: false,
          avgIntentScore: newScore,
          useCount: 1,
        },
      })
    }
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
