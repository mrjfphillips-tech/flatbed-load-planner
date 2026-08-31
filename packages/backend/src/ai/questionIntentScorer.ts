/**
 * QuestionIntentScorerImpl
 *
 * Evaluates whether the intent of a suggested question was achieved based on
 * the customer's response, regardless of the exact wording used by the Rep.
 *
 * Uses speaker diarization labels to filter transcript segments — only
 * customer-labeled segments (customer_1, customer_2, etc.) are assessed.
 * The Rep's segments are excluded from intent evaluation.
 *
 * Scoring:
 *   - 0–100 scale measuring how well the customer's response addresses
 *     the question's intent
 *   - intentMet = score >= 70 (configurable threshold)
 *   - followUpNeeded = score < 70 (indicating the question objective was
 *     not met and a rephrased or follow-up probe should be suggested)
 *
 * Supports streaming partial score updates via an onScoreUpdate callback
 * as analysis progresses.
 *
 * Requirements: 3.10, 3.11, 3.12, 3.13, 27.3
 */

import type {
  QuestionIntentScorer,
  QuestionIntentScore,
  TranscriptSegment,
} from '@ptv-discovery-coach/shared';

// ─── LLM Client Interface ─────────────────────────────────────────────────────

/**
 * Abstracted LLM interface for testability.
 * Implementations can use Azure OpenAI, a mock, or any other provider.
 */
export interface LLMClient {
  /**
   * Send a prompt and get a complete response.
   */
  complete(prompt: string): Promise<string>;

  /**
   * Send a prompt and stream the response token by token.
   * Each yielded string is a partial token or chunk from the LLM.
   */
  completeStream(prompt: string): AsyncIterable<string>;
}

// ─── Score Update Callback ────────────────────────────────────────────────────

/**
 * Callback invoked with partial score updates as analysis progresses.
 */
export type ScoreUpdateCallback = (update: PartialScoreUpdate) => void;

/**
 * A partial score update emitted during streaming analysis.
 */
export interface PartialScoreUpdate {
  questionId: string;
  partialScore: number;
  isComplete: boolean;
  reasoning?: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────

export interface QuestionIntentScorerOptions {
  /** LLM client for making inference calls */
  llmClient: LLMClient;

  /** Score threshold to consider intent met (default: 70) */
  intentMetThreshold?: number;

  /** Optional callback for streaming partial score updates */
  onScoreUpdate?: ScoreUpdateCallback;
}

// ─── Intent Met Threshold ─────────────────────────────────────────────────────

const DEFAULT_INTENT_MET_THRESHOLD = 70;

// ─── Prompt Template ──────────────────────────────────────────────────────────

/**
 * Builds the prompt for evaluating question intent fulfillment.
 * The prompt instructs the LLM to assess whether the customer's response
 * addresses the intent of the suggested question on a 0–100 scale.
 */
export function buildIntentScoringPrompt(
  questionText: string,
  customerResponseText: string,
): string {
  return `You are an expert sales coach evaluating whether a customer's response addresses the intent of a discovery question. You must assess intent fulfillment — not whether the exact words were used.

## Question Asked (Intent to Evaluate)
"${questionText}"

## Customer's Response (from transcript, customer segments only)
${customerResponseText}

## Scoring Guidelines
- Score 0–20: The customer did not address the question's intent at all. They may have deflected, changed the subject, or given an irrelevant response.
- Score 21–40: The customer partially acknowledged the topic but provided minimal substance. The core intent remains unaddressed.
- Score 41–60: The customer provided some relevant information but key aspects of the question's intent remain uncovered. More probing is needed.
- Score 61–69: The customer provided substantial information addressing most of the intent, but one or more important dimensions are still missing.
- Score 70–85: The customer clearly addressed the intent of the question with specific, actionable information. The core objective is met.
- Score 86–100: The customer provided comprehensive, detailed information that fully satisfies and exceeds the question's intent.

## Instructions
1. Identify the core intent of the question (what information or commitment was being sought).
2. Evaluate how well the customer's response addresses that intent.
3. Determine if a follow-up question is needed to fully satisfy the intent.
4. Provide brief reasoning (1-2 sentences) explaining your score.

Return ONLY a JSON object in this exact format:
{"score": <integer 0-100>, "reasoning": "<1-2 sentence explanation>", "followUpNeeded": <boolean>}`;
}

// ─── Response Parser ──────────────────────────────────────────────────────────

interface ParsedIntentResponse {
  score: number;
  reasoning: string;
  followUpNeeded: boolean;
}

/**
 * Parses the LLM response into a structured intent score result.
 * Handles malformed responses gracefully with fallback defaults.
 */
export function parseIntentResponse(raw: string): ParsedIntentResponse {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { score: 0, reasoning: 'Unable to parse LLM response', followUpNeeded: true };
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const score = typeof parsed.score === 'number'
      ? clamp(Math.round(parsed.score), 0, 100)
      : 0;

    const reasoning = typeof parsed.reasoning === 'string'
      ? parsed.reasoning
      : 'No reasoning provided';

    const followUpNeeded = typeof parsed.followUpNeeded === 'boolean'
      ? parsed.followUpNeeded
      : score < DEFAULT_INTENT_MET_THRESHOLD;

    return { score, reasoning, followUpNeeded };
  } catch {
    return { score: 0, reasoning: 'Failed to parse LLM response', followUpNeeded: true };
  }
}

// ─── Speaker Label Filtering ──────────────────────────────────────────────────

/**
 * Filters transcript segments to only include customer-labeled segments.
 * Uses speaker diarization labels: any speaker matching `customer_N` pattern.
 * The rep's segments are excluded from intent evaluation.
 *
 * Requirement 27.3: Use speaker labels to assess only customer-labeled segments.
 */
export function filterCustomerSegments(
  segments: TranscriptSegment[],
): TranscriptSegment[] {
  return segments.filter((segment) => segment.speaker.startsWith('customer_'));
}

// ─── Service Implementation ───────────────────────────────────────────────────

export class QuestionIntentScorerImpl implements QuestionIntentScorer {
  private readonly llmClient: LLMClient;
  private readonly intentMetThreshold: number;
  private readonly onScoreUpdate?: ScoreUpdateCallback;

  constructor(options: QuestionIntentScorerOptions) {
    this.llmClient = options.llmClient;
    this.intentMetThreshold = options.intentMetThreshold ?? DEFAULT_INTENT_MET_THRESHOLD;
    this.onScoreUpdate = options.onScoreUpdate;
  }

  /**
   * Score customer response against suggested question intent.
   *
   * Workflow:
   * 1. Filter segments to customer-only using speaker diarization labels
   * 2. Build prompt with question text and customer response
   * 3. Call LLM (streaming if callback provided, otherwise complete)
   * 4. Parse response and return structured QuestionIntentScore
   *
   * Requirements: 3.10, 3.11, 3.12, 3.13, 27.3
   */
  async scoreIntent(
    _sessionId: string,
    questionId: string,
    responseSegments: TranscriptSegment[],
  ): Promise<QuestionIntentScore> {
    // Step 1: Filter to customer segments only (Req 27.3)
    const customerSegments = filterCustomerSegments(responseSegments);

    // If no customer segments exist, score is 0 (customer hasn't responded)
    if (customerSegments.length === 0) {
      const emptyResult: QuestionIntentScore = {
        questionId,
        score: 0,
        isMet: false,
        reasoning: 'No customer response detected in transcript segments',
        followUpNeeded: true,
        evaluatedAt: new Date(),
      };

      this.onScoreUpdate?.({
        questionId,
        partialScore: 0,
        isComplete: true,
        reasoning: emptyResult.reasoning,
      });

      return emptyResult;
    }

    // Step 2: Concatenate customer response text
    const customerResponseText = customerSegments
      .map((seg) => seg.text)
      .join('\n');

    // Step 3: Build the scoring prompt
    // Note: questionId is used to look up question text; for now we use
    // the text from the most recent segments' context. In production this
    // would fetch question text from the Question Bank via questionId.
    const questionText = questionId; // Placeholder — in full integration, resolve from Question Bank
    const prompt = buildIntentScoringPrompt(questionText, customerResponseText);

    // Step 4: Call LLM with streaming support
    let parsedResult: ParsedIntentResponse;

    if (this.onScoreUpdate) {
      parsedResult = await this.scoreWithStreaming(prompt, questionId);
    } else {
      const raw = await this.llmClient.complete(prompt);
      parsedResult = parseIntentResponse(raw);
    }

    // Step 5: Build final result
    const isMet = parsedResult.score >= this.intentMetThreshold;
    const result: QuestionIntentScore = {
      questionId,
      score: parsedResult.score,
      isMet,
      reasoning: parsedResult.reasoning,
      followUpNeeded: parsedResult.followUpNeeded,
      evaluatedAt: new Date(),
    };

    // Final score update
    this.onScoreUpdate?.({
      questionId,
      partialScore: result.score,
      isComplete: true,
      reasoning: result.reasoning,
    });

    return result;
  }

  /**
   * Perform scoring with streaming, emitting partial updates as tokens arrive.
   * Streams the LLM response and attempts to parse partial JSON as it comes in,
   * emitting score updates progressively.
   */
  private async scoreWithStreaming(
    prompt: string,
    questionId: string,
  ): Promise<ParsedIntentResponse> {
    let accumulated = '';
    let lastEmittedScore = 0;

    for await (const chunk of this.llmClient.completeStream(prompt)) {
      accumulated += chunk;

      // Attempt to extract a partial score from the accumulated response
      const partialScore = this.extractPartialScore(accumulated);
      if (partialScore !== null && partialScore !== lastEmittedScore) {
        lastEmittedScore = partialScore;
        this.onScoreUpdate?.({
          questionId,
          partialScore,
          isComplete: false,
        });
      }
    }

    return parseIntentResponse(accumulated);
  }

  /**
   * Attempts to extract a score value from a partially accumulated LLM response.
   * Handles cases where the JSON is incomplete but the score field is visible.
   */
  private extractPartialScore(partialResponse: string): number | null {
    const scoreMatch = partialResponse.match(/"score"\s*:\s*(\d+)/);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1], 10);
      return clamp(score, 0, 100);
    }
    return null;
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
