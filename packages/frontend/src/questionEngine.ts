/**
 * Question Engine — Intelligent question selection and answer analysis
 *
 * Flow per question:
 * 1. analyzeAnswer()  — scan transcript text for MEDDIC-relevant keywords
 * 2. scoreAnswer()    — compute quality score (0-100) based on specificity
 * 3. categorize()     — map answer content to MEDDIC elements it covers
 * 4. pickNextQuestion() — choose the best follow-up based on:
 *    a) Conversation continuity (follow-up within same topic if depth is low)
 *    b) Lowest-scoring KPI that still needs information
 *    c) Never repeat an already-asked question
 */

import { QUESTIONS, type QuestionEntry } from './questions'

// ─── MEDDIC Elements ──────────────────────────────────────────────────────────

export const MEDDIC_ELEMENTS = [
  'Goals', 'IdentifyPain', 'Metrics', 'EconomicBuyer', 'Champion',
  'DecisionCriteria', 'DecisionProcess', 'Obstacles',
  'People', 'Organization', 'Plans', 'PlansToOvercomeObstacles',
] as const

export type MEDDICElement = typeof MEDDIC_ELEMENTS[number]

// ─── Keyword dictionaries for each element ────────────────────────────────────

const ELEMENT_KEYWORDS: Record<string, string[]> = {
  Goals: [
    'success', 'goal', 'target', 'objective', 'priority', 'strategy', 'vision',
    'achieve', 'outcome', 'milestone', 'roadmap', 'initiative', 'improve',
    'reduce cost', 'increase', 'growth', 'expand', 'consolidate', 'optimize',
    '12 months', 'next year', 'long term', 'kpi', 'performance',
  ],
  IdentifyPain: [
    'pain', 'problem', 'challenge', 'frustrat', 'struggle', 'difficult',
    'manual', 'time consuming', 'inefficien', 'waste', 'error', 'mistake',
    'late deliver', 'missed', 'overtime', 'tribal knowledge', 'workaround',
    'bottleneck', 'breakdown', 'complaint', 'headache', 'broken',
  ],
  Metrics: [
    'metric', 'measure', 'kpi', 'on-time', 'otd', 'cost per', 'utilization',
    'percent', '%', 'rate', 'average', 'baseline', 'benchmark', 'track',
    'report', 'dashboard', 'number', 'data', 'volume', 'stops per',
    'fuel cost', 'hours per', 'delivery rate', 'efficiency',
  ],
  EconomicBuyer: [
    'budget', 'approve', 'decision maker', 'cfo', 'coo', 'vp', 'executive',
    'sign off', 'authority', 'sponsor', 'investment', 'funding', 'p&l',
    'board', 'committee', 'procurement', 'capital', 'financial',
  ],
  Champion: [
    'champion', 'advocate', 'internal', 'push', 'support', 'believe',
    'frustrated', 'research', 'pilot', 'adoption', 'change agent',
    'project lead', 'day-to-day', 'hands on', 'passionate',
  ],
  DecisionCriteria: [
    'criteria', 'requirement', 'must have', 'integration', 'scalab',
    'security', 'compliance', 'ease of use', 'roi', 'payback',
    'total cost', 'customiz', 'mobile', 'offline', 'vendor',
    'reference', 'proof', 'demo', 'fit',
  ],
  DecisionProcess: [
    'timeline', 'process', 'evaluation', 'rfp', 'stage', 'phase',
    'comparing', 'vendor', 'shortlist', 'pilot', 'proof of concept',
    'go-live', 'implementation', 'rollout', 'procurement', 'contract',
  ],
  Obstacles: [
    'obstacle', 'block', 'prevent', 'resist', 'concern', 'risk',
    'failed', 'tried before', 'legacy', 'data quality', 'political',
    'budget constraint', 'it capacity', 'change management', 'scar tissue',
  ],
  People: [
    'team', 'dispatcher', 'planner', 'driver', 'coordinator', 'stakeholder',
    'headcount', 'user', 'third party', 'carrier', 'subcontract', 'union',
  ],
  Organization: [
    'fleet', 'depot', 'warehouse', 'region', 'centralized', 'distributed',
    'erp', 'tms', 'wms', 'sap', 'infrastructure', 'cloud', 'on-premise',
  ],
  Plans: [
    'roadmap', 'initiative', 'project', 'migration', 'expansion',
    'hiring', 'sustainability', 'emission', 'evaluated', 'business case',
  ],
  PlansToOvercomeObstacles: [
    'phased', 'pilot', 'minimum viable', 'low risk', 'change management',
    'support', 'adoption', 'training', 'overcome', 'address concern',
  ],
}

// ─── Answer quality signals ───────────────────────────────────────────────────

const SPECIFICITY_SIGNALS = [
  // Numbers and percentages indicate concrete data
  /\d+%/,
  /\$[\d,]+/,
  /€[\d,]+/,
  /\d+ (hours?|minutes?|days?|weeks?|months?|years?)/i,
  /\d+ (vehicles?|trucks?|drivers?|routes?|stops?|deliveries)/i,
  // Named people/roles indicate organizational knowledge
  /\b(cfo|coo|cto|vp|director|manager|ceo)\b/i,
  // Specific tools/systems
  /\b(sap|oracle|salesforce|excel|spreadsheet)\b/i,
  // Comparative language shows depth
  /\b(compared to|versus|better than|worse than|increased|decreased)\b/i,
  // Timeline specificity
  /\b(q[1-4]|january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  /\b(next quarter|this year|by end of|within \d+)\b/i,
]

const VAGUE_SIGNALS = [
  /\b(maybe|perhaps|i think|not sure|i guess|kind of|sort of)\b/i,
  /\b(we'll see|it depends|hard to say|i don't know)\b/i,
]

// ─── Engine ───────────────────────────────────────────────────────────────────

export interface AnswerAnalysis {
  /** Which MEDDIC elements this answer covers */
  coveredElements: { element: string; confidence: number }[]
  /** Primary element (highest confidence match) */
  primaryElement: string
  /** Quality score 0-100 */
  qualityScore: number
  /** Extracted key phrases */
  keyPhrases: string[]
  /** Brief AI-generated summary of the answer */
  summary: string
}

export interface SessionState {
  /** Current scores per element (0-100) */
  scores: Record<string, number>
  /** Questions already asked (by index in QUESTIONS array) */
  askedIndices: Set<number>
  /** Elements covered in the current conversation thread */
  currentThread: string[]
  /** Full transcript segments */
  transcriptSegments: string[]
}

/**
 * Analyze a transcript segment to determine what MEDDIC elements it covers
 * and how specific/useful the answer is.
 */
export function analyzeAnswer(text: string, currentElement: string): AnswerAnalysis {
  const lower = text.toLowerCase()
  const words = lower.split(/\s+/)

  // 1. Score each element by keyword matches
  const elementScores: { element: string; confidence: number }[] = []
  for (const [element, keywords] of Object.entries(ELEMENT_KEYWORDS)) {
    let hits = 0
    for (const kw of keywords) {
      if (lower.includes(kw)) hits++
    }
    if (hits > 0) {
      // Normalize: more hits = higher confidence, cap at 1.0
      const confidence = Math.min(1.0, hits / Math.max(3, keywords.length * 0.25))
      elementScores.push({ element, confidence })
    }
  }

  // Sort by confidence
  elementScores.sort((a, b) => b.confidence - a.confidence)

  // If no keywords matched, default to the current element
  if (elementScores.length === 0) {
    elementScores.push({ element: currentElement, confidence: 0.3 })
  }

  // 2. Quality score based on specificity
  let qualityScore = 20 // base score for any answer
  // Length bonus (longer = more detail, up to a point)
  qualityScore += Math.min(30, words.length * 0.5)
  // Specificity signals
  for (const regex of SPECIFICITY_SIGNALS) {
    if (regex.test(text)) qualityScore += 5
  }
  // Vague penalty
  for (const regex of VAGUE_SIGNALS) {
    if (regex.test(text)) qualityScore -= 8
  }
  qualityScore = Math.max(5, Math.min(100, Math.round(qualityScore)))

  // 3. Extract key phrases (sentences with high keyword density)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10)
  const keyPhrases = sentences
    .filter(s => {
      const sl = s.toLowerCase()
      return SPECIFICITY_SIGNALS.some(r => r.test(s)) ||
        Object.values(ELEMENT_KEYWORDS).flat().some(kw => sl.includes(kw))
    })
    .slice(0, 3)
    .map(s => s.trim())

  // 4. Generate summary from the transcript
  const summary = generateSummary(text, elementScores[0]?.element || currentElement, keyPhrases)

  return {
    coveredElements: elementScores.slice(0, 3),
    primaryElement: elementScores[0]?.element || currentElement,
    qualityScore,
    keyPhrases,
    summary,
  }
}

/**
 * Generate a concise summary of the customer's answer.
 */
function generateSummary(text: string, element: string, keyPhrases: string[]): string {
  const words = text.split(/\s+/)

  // If we have key phrases, use them
  if (keyPhrases.length > 0) {
    const combined = keyPhrases.join('. ')
    if (combined.length > 20 && combined.length < 300) {
      return combined
    }
  }

  // Otherwise, take the most information-dense sentences
  if (words.length > 30) {
    // Take first ~50 words as summary
    return words.slice(0, 50).join(' ') + '...'
  }

  return text.length > 10 ? text : `Customer response captured for ${element.replace(/([A-Z])/g, ' $1').trim()}.`
}

/**
 * Compute the score delta for a MEDDIC element based on answer quality.
 * Better answers = bigger score increase.
 */
export function computeScoreDelta(analysis: AnswerAnalysis): Record<string, number> {
  const deltas: Record<string, number> = {}

  for (const { element, confidence } of analysis.coveredElements) {
    // Base delta scaled by quality and confidence
    // High quality + high confidence = up to +25
    // Low quality + low confidence = +3
    const delta = Math.round(3 + (analysis.qualityScore / 100) * 22 * confidence)
    deltas[element] = Math.max(3, Math.min(25, delta))
  }

  return deltas
}

/**
 * Pick the next best question based on:
 * 1. If the current topic still has depth to explore (score < 60), stay on topic
 * 2. Otherwise, find the lowest-scoring element and pick a question from it
 * 3. Never repeat an already-asked question
 * 4. Prefer questions that follow naturally from the conversation
 */
export function pickNextQuestion(state: SessionState, lastElement: string): {
  question: QuestionEntry
  index: number
  reason: string
} {
  const { scores, askedIndices, currentThread } = state

  // Build list of available questions (not yet asked)
  const available = QUESTIONS
    .map((q, i) => ({ q, i }))
    .filter(({ i }) => !askedIndices.has(i))

  if (available.length === 0) {
    // All questions asked — wrap around
    return {
      question: QUESTIONS[0],
      index: 0,
      reason: 'All questions have been asked — restarting from the beginning.',
    }
  }

  // Deduplicate scores by element (aggregate unique elements)
  const elementScores: Record<string, number> = {}
  for (const el of MEDDIC_ELEMENTS) {
    elementScores[el] = scores[el] ?? 0
  }

  // Strategy 1: Continue current topic if score is still low
  const currentScore = elementScores[lastElement] ?? 0
  if (currentScore < 60) {
    const sameTopicQs = available.filter(({ q }) => q.element === lastElement)
    if (sameTopicQs.length > 0) {
      // Pick the one with the best coaching note (longest = most detailed)
      const best = sameTopicQs.sort((a, b) => (b.q.note?.length || 0) - (a.q.note?.length || 0))[0]
      return {
        question: best.q,
        index: best.i,
        reason: `Continuing ${lastElement.replace(/([A-Z])/g, ' $1').trim()} — score is ${currentScore}/100, needs more depth.`,
      }
    }
  }

  // Strategy 2: Find the lowest-scoring element that has available questions
  const elementsByScore = MEDDIC_ELEMENTS
    .filter(el => available.some(({ q }) => q.element === el))
    .sort((a, b) => (elementScores[a] ?? 0) - (elementScores[b] ?? 0))

  if (elementsByScore.length > 0) {
    const targetElement = elementsByScore[0]
    const targetScore = elementScores[targetElement] ?? 0
    const candidates = available.filter(({ q }) => q.element === targetElement)

    // If we've been on the same thread for 3+ questions, force a topic change
    const threadLength = currentThread.filter(e => e === lastElement).length
    const forceChange = threadLength >= 3 && elementsByScore.length > 1

    const finalElement = forceChange ? elementsByScore[1] : targetElement
    const finalCandidates = forceChange
      ? available.filter(({ q }) => q.element === finalElement)
      : candidates

    if (finalCandidates.length > 0) {
      const pick = finalCandidates[0]
      return {
        question: pick.q,
        index: pick.i,
        reason: forceChange
          ? `Switching to ${finalElement.replace(/([A-Z])/g, ' $1').trim()} (score: ${elementScores[finalElement] ?? 0}) — diversifying coverage.`
          : `Targeting ${targetElement.replace(/([A-Z])/g, ' $1').trim()} — lowest score at ${targetScore}/100.`,
      }
    }
  }

  // Fallback: just pick the first available
  const fallback = available[0]
  return {
    question: fallback.q,
    index: fallback.i,
    reason: 'Continuing discovery.',
  }
}

/**
 * Get the coaching note for a question.
 * Uses the per-question note from the CSV, or falls back to element-level notes.
 */
export function getCoachingNote(question: QuestionEntry): string {
  if (question.note && question.note.length > 10) {
    // Truncate very long notes for display
    return question.note.length > 200 ? question.note.substring(0, 200) + '...' : question.note
  }
  // Fallback element-level notes
  const fallbacks: Record<string, string> = {
    Goals: 'Listen for specific metrics, timelines, or strategic language.',
    IdentifyPain: 'Pain is the foundation of value selling. Push for specifics.',
    Metrics: 'You cannot sell improvement without a baseline. Get the number.',
    EconomicBuyer: 'Without the economic buyer, deals stall.',
    Champion: 'A champion keeps the deal alive when you\'re not in the room.',
    DecisionProcess: 'Understanding where they are tells you timing and competition.',
    DecisionCriteria: 'Understanding criteria tells you what to prove.',
    Obstacles: 'Prior attempts reveal what hasn\'t worked.',
    People: 'Map the stakeholders — who influences, who decides, who blocks.',
    Organization: 'Understand the structure to scope the solution correctly.',
    Plans: 'Existing initiatives are either competitors or opportunities.',
    PlansToOvercomeObstacles: 'Help them see a path forward that reduces risk.',
  }
  return fallbacks[question.element] || 'Listen carefully and probe for specifics.'
}

/** Get total question count */
export function getTotalQuestionCount(): number {
  return QUESTIONS.length
}

/** Get questions grouped by element */
export function getQuestionsByElement(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const q of QUESTIONS) {
    counts[q.element] = (counts[q.element] || 0) + 1
  }
  return counts
}
