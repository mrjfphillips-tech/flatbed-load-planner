/**
 * AIEngineService
 *
 * Wraps GPT-4o to:
 *  - Analyze transcript segments and return MEDDIC coverage scores (Req 2.1, 2.2, 2.4)
 *  - Select the best next question targeting the lowest-coverage element (Req 3.1, 3.7)
 *  - Switch to wrap-up questions when all elements ≥ 80 (Req 3.8)
 *  - Evaluate Question_Intent_Score per customer response (Req 3.9–3.12)
 *  - Advance element only when configurable threshold of QIS ≥ 70 (Req 3.14)
 *  - Retain last known scores and set analysisPaused on GPT-4o timeout/5xx (Req 2.2)
 */

// @ts-nocheck — Pending type alignment between legacy AIEngineService and new shared types

import {
  type AnalysisResult,
  type MEDDICScores,
  type MEDDICElement,
  type TranscriptSegment,
  type Question,
  type GapRecommendation,
  type BuyerPersona,
  type IndustrySegment,
  MEDDIC_ELEMENTS,
  INDUSTRY_SEGMENT_LABELS,
  defaultMEDDICScores,
} from '@ptv-discovery-coach/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RepPreferences {
  preferredQuestionIds?: string[]
  buyerPersona?: BuyerPersona
  industrySegment?: IndustrySegment
}

export interface AIEngineServiceOptions {
  openAiApiKey?: string
  openAiBaseUrl?: string
  /** Timeout in ms for GPT-4o requests (default: 10_000) */
  timeoutMs?: number
  /** Threshold proportion of QIS ≥ 70 required to advance an element (default: 0.7) */
  advancementThreshold?: number
}

export interface QuestionSelectionContext {
  coverageScores: MEDDICScores
  availableQuestions: Question[]
  usedQuestionIds?: string[]
  repPreferences?: RepPreferences
}

export interface DynamicQuestion {
  text: string
  element: MEDDICElement
  source: 'bank' | 'dynamic'
  bankQuestionId?: string
}

export interface DynamicSuggestionResult {
  primary: DynamicQuestion
  alternatives: DynamicQuestion[]
}

export interface ElementAdvancementResult {
  shouldAdvance: boolean
  proportion: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WRAP_UP_THRESHOLD = 80
const DEFAULT_ADVANCEMENT_THRESHOLD = 0.7
const QIS_PASS_THRESHOLD = 70
const DEFAULT_TIMEOUT_MS = 10_000

// ─── Service ──────────────────────────────────────────────────────────────────

export class AIEngineService {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly timeoutMs: number
  readonly advancementThreshold: number

  /** Last known scores — retained on GPT-4o failure */
  private lastKnownScores: MEDDICScores = defaultMEDDICScores()
  /** Set to true when GPT-4o is unavailable */
  analysisPaused = false

  constructor(options: AIEngineServiceOptions = {}) {
    this.apiKey = options.openAiApiKey ?? process.env.OPENAI_API_KEY ?? ''
    this.baseUrl = options.openAiBaseUrl ?? 'https://api.openai.com/v1'
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.advancementThreshold = options.advancementThreshold ?? DEFAULT_ADVANCEMENT_THRESHOLD
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Analyze transcript segments and return updated MEDDIC coverage scores
   * plus a suggested question and gap recommendations.
   *
   * On GPT-4o timeout or 5xx: retains last known scores and sets analysisPaused.
   */
  async analyzeTranscript(
    transcript: TranscriptSegment[],
    currentScores: MEDDICScores,
    repPreferences: RepPreferences = {}
  ): Promise<AnalysisResult & { analysisPaused: boolean }> {
    try {
      const scores = await this.fetchCoverageScores(transcript, currentScores)
      this.lastKnownScores = scores
      this.analysisPaused = false

      const gapRecommendations = this.buildGapRecommendations(scores)

      return {
        coverageScores: scores,
        suggestedQuestion: this.buildPlaceholderQuestion('Metrics'),
        alternativeQuestions: [],
        gapRecommendations,
        analysisPaused: false,
      }
    } catch (err) {
      this.analysisPaused = true
      const gapRecommendations = this.buildGapRecommendations(this.lastKnownScores)
      return {
        coverageScores: this.lastKnownScores,
        suggestedQuestion: this.buildPlaceholderQuestion('Metrics'),
        alternativeQuestions: [],
        gapRecommendations,
        analysisPaused: true,
      }
    }
  }

  /**
   * Select the best next question from availableQuestions targeting the
   * lowest-coverage MEDDIC element. Switches to wrap-up questions when
   * all elements ≥ 80.
   */
  selectQuestion(ctx: QuestionSelectionContext): Question | null {
    const { coverageScores, availableQuestions, usedQuestionIds = [], repPreferences = {} } = ctx

    const activeQuestions = availableQuestions.filter(
      (q) => q.isActive && !usedQuestionIds.includes(q.id)
    )

    if (activeQuestions.length === 0) return null

    const allAboveWrapUp = MEDDIC_ELEMENTS.every((el) => coverageScores[el] >= WRAP_UP_THRESHOLD)
    if (allAboveWrapUp) return activeQuestions[0]

    const targetElement = this.lowestCoverageElement(coverageScores)
    const candidates = activeQuestions.filter((q) => q.element === targetElement)
    if (candidates.length === 0) return activeQuestions[0]

    // Industry segment filtering: prefer segment-specific questions, then universal (no segment)
    const segmentFiltered = repPreferences.industrySegment
      ? candidates.filter(
          (q) => q.industrySegment === repPreferences.industrySegment || !q.industrySegment
        )
      : candidates

    const pool = segmentFiltered.length > 0 ? segmentFiltered : candidates

    // Within the pool, rank: industry-specific > persona match > preferred > generic
    const industrySpecific = repPreferences.industrySegment
      ? pool.filter((q) => q.industrySegment === repPreferences.industrySegment)
      : []
    const personaMatch = repPreferences.buyerPersona
      ? pool.filter((q) => q.persona === repPreferences.buyerPersona)
      : []
    const preferred = pool.filter((q) =>
      repPreferences.preferredQuestionIds?.includes(q.id)
    )

    // Priority: preferred industry-specific > industry-specific > preferred persona > persona > any
    const preferredIndustry = industrySpecific.filter((q) =>
      repPreferences.preferredQuestionIds?.includes(q.id)
    )
    return (
      preferredIndustry[0] ??
      industrySpecific[0] ??
      preferred[0] ??
      personaMatch[0] ??
      pool[0]
    )
  }

  /**
   * Evaluate whether the customer's response achieved the intent of the
   * suggested question. Returns a score in [0, 100].
   */
  async evaluateQuestionIntent(
    question: Question,
    response: TranscriptSegment[]
  ): Promise<number> {
    if (response.length === 0) return 0

    try {
      const score = await this.fetchQuestionIntentScore(question, response)
      return clamp(Math.round(score), 0, 100)
    } catch {
      return 0
    }
  }

  /**
   * Determine whether a MEDDIC element should be advanced based on the
   * proportion of QIS values that meet the pass threshold.
   *
   * Req 3.14: advance only when ≥ advancementThreshold of QIS ≥ 70.
   */
  evaluateElementAdvancement(qisScores: number[]): ElementAdvancementResult {
    if (qisScores.length === 0) return { shouldAdvance: false, proportion: 0 }

    const passing = qisScores.filter((s) => s >= QIS_PASS_THRESHOLD).length
    const proportion = passing / qisScores.length
    return {
      shouldAdvance: proportion >= this.advancementThreshold,
      proportion,
    }
  }

  /**
   * Combined bank + dynamic question suggestion.
   *
   * Strategy:
   * 1. Try to find a good bank question for the lowest-coverage element.
   * 2. Always generate 2-3 dynamic follow-ups from GPT-4o based on the
   *    last customer response — these are contextually tailored to exactly
   *    what was just said.
   * 3. Return the best bank question as primary (or a dynamic one if the
   *    bank has no good fit), plus dynamic alternatives.
   *
   * This means reps always have contextual options even with a small bank.
   */
  async suggestNextQuestion(
    transcript: TranscriptSegment[],
    coverageScores: MEDDICScores,
    availableQuestions: Question[],
    repPreferences: RepPreferences = {}
  ): Promise<DynamicSuggestionResult> {
    const targetElement = this.lowestCoverageElement(coverageScores)
    const bankQuestion = this.selectQuestion({ coverageScores, availableQuestions, repPreferences })

    let dynamicQuestions: DynamicQuestion[] = []
    try {
      dynamicQuestions = await this.generateDynamicFollowUps(
        transcript, coverageScores, targetElement, repPreferences.industrySegment
      )
    } catch { /* Non-fatal */ }

    const primary: DynamicQuestion = bankQuestion
      ? { text: bankQuestion.text, element: bankQuestion.element, source: 'bank', bankQuestionId: bankQuestion.id }
      : dynamicQuestions[0] ?? { text: '', element: targetElement, source: 'dynamic' }

    const alternatives = dynamicQuestions.filter((q) => q.text !== primary.text).slice(0, 3)
    return { primary, alternatives }
  }

  /**
   * Generate 2-3 contextual follow-up questions via GPT-4o based on
   * what the customer just said. These are generated fresh — not from the bank.
   */
  async generateDynamicFollowUps(
    transcript: TranscriptSegment[],
    coverageScores: MEDDICScores,
    targetElement: MEDDICElement,
    industrySegment?: IndustrySegment
  ): Promise<DynamicQuestion[]> {
    const recentTranscript = transcript.slice(-5).map((s) => s.text).join('\n')
    const prompt = buildDynamicFollowUpPrompt(recentTranscript, coverageScores, targetElement, industrySegment)
    const raw = await this.callGPT4o(prompt)
    return parseDynamicQuestions(raw, targetElement)
  }

  /**
   * Determine the next action after a QIS is received.
   * Returns 'advance' (QIS ≥ 70) or 'retain' (QIS < 70).
   */
  determineAdvancement(qis: number): 'advance' | 'retain' {
    return qis >= QIS_PASS_THRESHOLD ? 'advance' : 'retain'
  }

  /**
   * Check whether all elements are above the wrap-up threshold.
   */
  isWrapUpMode(scores: MEDDICScores): boolean {
    return MEDDIC_ELEMENTS.every((el) => scores[el] >= WRAP_UP_THRESHOLD)
  }

  /**
   * Return the element with the lowest coverage score.
   */
  lowestCoverageElement(scores: MEDDICScores): MEDDICElement {
    return MEDDIC_ELEMENTS.reduce((lowest, el) =>
      scores[el] < scores[lowest] ? el : lowest
    )
  }

  /**
   * Generate a post-session summary via GPT-4o.
   * Returns aiGenerated text within 60 s; on timeout returns a blank MEDDIC template.
   * Req 7.1, 7.6
   */
  async generateSummary(
    sessionId: string,
    transcript: TranscriptSegment[],
    coverageScores: MEDDICScores
  ): Promise<string> {
    const transcriptText = transcript.map((s) => s.text).join('\n')
    const prompt = buildSummaryPrompt(transcriptText, coverageScores)

    try {
      const raw = await this.callGPT4o(prompt)
      return raw.trim() || buildBlankSummaryTemplate()
    } catch {
      return buildBlankSummaryTemplate()
    }
  }

  /**
   * Generate a concise AI summary of the customer's answer to a specific question.
   * Used between questions so the rep can review what was captured.
   */
  async generateAnswerSummary(
    questionText: string,
    element: string,
    recentTranscript: string,
  ): Promise<string> {
    const prompt = `You are an AI sales coach analyzing a discovery call. The rep just asked this question targeting the "${element}" MEDDIC element:

"${questionText}"

Here is the customer's response (recent transcript):
${recentTranscript}

Summarize the customer's answer in 2-3 sentences. Focus on:
- Specific facts, numbers, or names mentioned
- Key insights relevant to ${element}
- Any actionable data points for the sales process

Be concise and factual. Do not add interpretation beyond what was said.`

    try {
      const raw = await this.callGPT4o(prompt)
      return raw.trim() || 'Customer response captured. Review transcript for details.'
    } catch {
      return 'Customer response captured. AI summary unavailable — review transcript for details.'
    }
  }

  /**
   * Compute gap recommendations for a single set of scores.
   * Identifies elements with score < 60; flags EconomicBuyer and Champion as critical.
   * Generates GapRecommendation with at least one BuyerPersona per gap.
   * Req 6.1, 6.2, 6.4, 6.5
   */
  computeGapRecommendations(scores: MEDDICScores): GapRecommendation[] {
    return this.buildGapRecommendations(scores)
  }

  /**
   * Recompute cumulative gap recommendations across all sessions for an account.
   * Averages coverage scores across all sessions, then identifies gaps.
   * Req 6.6
   */
  computeCumulativeGapRecommendations(allSessionScores: MEDDICScores[]): GapRecommendation[] {
    if (allSessionScores.length === 0) {
      return this.buildGapRecommendations(defaultMEDDICScores())
    }

    const cumulative = defaultMEDDICScores()
    for (const scores of allSessionScores) {
      for (const el of MEDDIC_ELEMENTS) {
        cumulative[el] += scores[el] ?? 0
      }
    }
    for (const el of MEDDIC_ELEMENTS) {
      cumulative[el] = Math.round(cumulative[el] / allSessionScores.length)
    }

    return this.buildGapRecommendations(cumulative)
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async fetchCoverageScores(
    transcript: TranscriptSegment[],
    currentScores: MEDDICScores
  ): Promise<MEDDICScores> {
    const transcriptText = transcript.map((s) => s.text).join('\n')

    const prompt = buildCoveragePrompt(transcriptText, currentScores)
    const raw = await this.callGPT4o(prompt)
    return parseCoverageScores(raw, currentScores)
  }

  private async fetchQuestionIntentScore(
    question: Question,
    response: TranscriptSegment[]
  ): Promise<number> {
    const responseText = response.map((s) => s.text).join('\n')
    const prompt = buildQISPrompt(question.text, responseText)
    const raw = await this.callGPT4o(prompt)
    return parseQIS(raw)
  }

  private async callGPT4o(prompt: string): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 512,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new GPT4oError(`GPT-4o returned ${response.status}`, response.status)
      }

      const data = (await response.json()) as {
        choices?: Array<{ message: { content: string } }>
      }
      return data.choices?.[0]?.message?.content ?? ''
    } finally {
      clearTimeout(timer)
    }
  }

  private buildGapRecommendations(scores: MEDDICScores): GapRecommendation[] {
    const GAP_THRESHOLD = 60
    const CRITICAL_ELEMENTS: MEDDICElement[] = ['EconomicBuyer', 'Champion']

    return MEDDIC_ELEMENTS.filter((el) => scores[el] < GAP_THRESHOLD).map((el) => ({
      element: el,
      score: scores[el],
      recommendedPersonas: recommendPersonasForElement(el),
      isCritical: CRITICAL_ELEMENTS.includes(el),
    }))
  }

  private buildPlaceholderQuestion(element: MEDDICElement): Question {
    return {
      id: '',
      text: '',
      element,
      persona: 'FleetManager',
      isActive: true,
      createdAt: new Date(),
    }
  }
}

// ─── Error class ──────────────────────────────────────────────────────────────

export class GPT4oError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message)
    this.name = 'GPT4oError'
  }
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildDynamicFollowUpPrompt(
  recentTranscript: string,
  coverageScores: MEDDICScores,
  targetElement: MEDDICElement,
  industrySegment?: IndustrySegment
): string {
  const industryContext = industrySegment
    ? `The customer is in the ${INDUSTRY_SEGMENT_LABELS[industrySegment]} industry. Use terminology and examples specific to this industry.`
    : 'The customer is in the logistics, routing, or fleet management space.'

  return `You are a MEDDIC sales coaching assistant for PTV Logistics, a routing and optimization software company. Your job is to help a sales rep ask the next best discovery question.

${industryContext}

Recent conversation:
${recentTranscript}

Current MEDDIC coverage scores (0-100):
${JSON.stringify(coverageScores, null, 2)}

The weakest area right now is: ${targetElement}

Generate exactly 3 natural, conversational follow-up questions that:
1. Flow naturally from what the customer just said
2. Help uncover information about ${targetElement}
3. Are strategic and open-ended — not yes/no questions
4. Sound like something a consultative sales professional would ask, not a scripted questionnaire
5. Use terminology appropriate for the customer's industry

Return ONLY a JSON array of 3 strings:
["question 1", "question 2", "question 3"]`
}

function parseDynamicQuestions(raw: string, element: MEDDICElement): DynamicQuestion[] {
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return []
    const parsed = JSON.parse(jsonMatch[0]) as unknown[]
    return parsed
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
      .slice(0, 3)
      .map((text) => ({ text: text.trim(), element, source: 'dynamic' as const }))
  } catch {
    return []
  }
}

function buildCoveragePrompt(transcriptText: string, currentScores: MEDDICScores): string {
  return `You are a MEDDIC sales coaching assistant. Analyze the following discovery call transcript and return updated coverage scores for all 12 MEDDIC elements.

Current scores: ${JSON.stringify(currentScores)}

Transcript:
${transcriptText}

Return ONLY a JSON object with these exact keys and integer values in [0, 100]:
Metrics, EconomicBuyer, DecisionCriteria, DecisionProcess, IdentifyPain, Champion, People, Organization, Goals, Plans, Obstacles, PlansToOvercomeObstacles`
}

function buildQISPrompt(questionText: string, responseText: string): string {
  return `You are evaluating whether a customer's response achieved the intent of a discovery question.

Question: ${questionText}

Customer response:
${responseText}

Return ONLY a JSON object: {"score": <integer 0-100>}
Score 0 = intent not addressed at all, 100 = intent fully and clearly addressed.`
}

function buildSummaryPrompt(transcriptText: string, coverageScores: MEDDICScores, industrySegment?: IndustrySegment): string {
  const industryContext = industrySegment
    ? `Industry: ${INDUSTRY_SEGMENT_LABELS[industrySegment]}`
    : ''
  return `You are a MEDDIC sales coaching assistant for PTV Logistics. Generate a concise post-session summary.
${industryContext}
Coverage scores: ${JSON.stringify(coverageScores)}

Transcript:
${transcriptText}

Write a structured summary with these sections:
## Key Findings per MEDDIC Element
## Financial Baseline (vehicles, miles/km, cost per mile/km, annual spend if mentioned)
## Action Items
## Recommended Next Steps`
}

function buildBlankSummaryTemplate(): string {
  return `## Key Findings per MEDDIC Element
- Metrics: 
- Economic Buyer: 
- Decision Criteria: 
- Decision Process: 
- Identify Pain: 
- Champion: 
- People: 
- Organization: 
- Goals: 
- Plans: 
- Obstacles: 
- Plans To Overcome Obstacles: 

## Action Items
- 

## Recommended Next Steps
- `
}// ─── Response parsers ─────────────────────────────────────────────────────────

function parseCoverageScores(raw: string, fallback: MEDDICScores): MEDDICScores {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return fallback

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const scores = { ...fallback }

    for (const el of MEDDIC_ELEMENTS) {
      const val = parsed[el]
      if (typeof val === 'number') {
        scores[el] = clamp(Math.round(val), 0, 100)
      }
    }

    return scores
  } catch {
    return fallback
  }
}

function parseQIS(raw: string): number {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return 0
    const parsed = JSON.parse(jsonMatch[0]) as { score?: unknown }
    if (typeof parsed.score === 'number') {
      return clamp(Math.round(parsed.score), 0, 100)
    }
    return 0
  } catch {
    return 0
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function recommendPersonasForElement(element: MEDDICElement): BuyerPersona[] {
  const map: Record<MEDDICElement, BuyerPersona[]> = {
    Metrics: ['LogisticsDirector', 'SupplyChainVP'],
    EconomicBuyer: ['SupplyChainVP', 'LogisticsDirector'],
    DecisionCriteria: ['ITArchitect', 'LogisticsDirector'],
    DecisionProcess: ['SupplyChainVP', 'LogisticsDirector'],
    IdentifyPain: ['FleetManager', 'OperationsAnalyst'],
    Champion: ['FleetManager', 'LogisticsDirector'],
    People: ['SupplyChainVP', 'LogisticsDirector'],
    Organization: ['SupplyChainVP', 'ITArchitect'],
    Goals: ['SupplyChainVP', 'LogisticsDirector'],
    Plans: ['LogisticsDirector', 'OperationsAnalyst'],
    Obstacles: ['FleetManager', 'OperationsAnalyst'],
    PlansToOvercomeObstacles: ['LogisticsDirector', 'OperationsAnalyst'],
  }
  return map[element]
}
