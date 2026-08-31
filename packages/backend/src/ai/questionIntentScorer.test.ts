/**
 * QuestionIntentScorerImpl Tests
 *
 * Tests for the Question Intent Scorer component covering:
 * - Customer segment filtering using speaker diarization labels (Req 27.3)
 * - Intent scoring with LLM responses (Req 3.10)
 * - Intent met threshold logic (score >= 70) (Req 3.11)
 * - Follow-up determination (score < 70) (Req 3.12, 3.13)
 * - Streaming score updates (Req 23.3)
 * - Prompt building and response parsing
 *
 * Requirements: 3.10, 3.11, 3.12, 3.13, 27.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TranscriptSegment } from '@ptv-discovery-coach/shared';
import {
  QuestionIntentScorerImpl,
  buildIntentScoringPrompt,
  parseIntentResponse,
  filterCustomerSegments,
} from './questionIntentScorer';
import type { LLMClient, PartialScoreUpdate } from './questionIntentScorer';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createSegment(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    id: 'seg-1',
    sessionId: 'session-1',
    speaker: 'customer_1',
    text: 'We have about 200 vehicles in our fleet.',
    startTimeMs: 1000,
    endTimeMs: 4000,
    confidence: 0.95,
    source: 'audio',
    createdAt: new Date(),
    ...overrides,
  };
}

function createMockLLMClient(response: string): LLMClient {
  return {
    complete: vi.fn().mockResolvedValue(response),
    completeStream: vi.fn().mockImplementation(async function* () {
      yield response;
    }),
  };
}

function createStreamingLLMClient(chunks: string[]): LLMClient {
  return {
    complete: vi.fn().mockResolvedValue(chunks.join('')),
    completeStream: vi.fn().mockImplementation(async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('QuestionIntentScorerImpl', () => {
  let mockLLM: LLMClient;
  let scorer: QuestionIntentScorerImpl;

  beforeEach(() => {
    mockLLM = createMockLLMClient(
      '{"score": 85, "reasoning": "Customer provided specific fleet size and vehicle count.", "followUpNeeded": false}',
    );
    scorer = new QuestionIntentScorerImpl({ llmClient: mockLLM });
  });

  // ─── Customer Segment Filtering (Req 27.3) ─────────────────────────────────

  describe('filterCustomerSegments', () => {
    it('includes only customer-labeled segments', () => {
      const segments: TranscriptSegment[] = [
        createSegment({ speaker: 'rep', text: 'How many vehicles do you have?' }),
        createSegment({ speaker: 'customer_1', text: 'We have about 200 vehicles.' }),
        createSegment({ speaker: 'rep', text: 'And the annual mileage?' }),
        createSegment({ speaker: 'customer_1', text: 'Around 50,000 miles each.' }),
      ];

      const result = filterCustomerSegments(segments);

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('We have about 200 vehicles.');
      expect(result[1].text).toBe('Around 50,000 miles each.');
    });

    it('handles multiple customer speakers', () => {
      const segments: TranscriptSegment[] = [
        createSegment({ speaker: 'customer_1', text: 'From my perspective...' }),
        createSegment({ speaker: 'customer_2', text: 'I would add that...' }),
        createSegment({ speaker: 'rep', text: 'Good point.' }),
      ];

      const result = filterCustomerSegments(segments);

      expect(result).toHaveLength(2);
      expect(result[0].speaker).toBe('customer_1');
      expect(result[1].speaker).toBe('customer_2');
    });

    it('returns empty array when no customer segments exist', () => {
      const segments: TranscriptSegment[] = [
        createSegment({ speaker: 'rep', text: 'Let me ask about your fleet.' }),
        createSegment({ speaker: 'rep', text: 'How many vehicles do you have?' }),
      ];

      const result = filterCustomerSegments(segments);

      expect(result).toHaveLength(0);
    });

    it('excludes rep segments entirely', () => {
      const segments: TranscriptSegment[] = [
        createSegment({ speaker: 'rep', text: 'Tell me about your routing challenges.' }),
        createSegment({ speaker: 'customer_1', text: 'We struggle with last-mile delivery.' }),
      ];

      const result = filterCustomerSegments(segments);

      expect(result).toHaveLength(1);
      expect(result.every((s) => s.speaker !== 'rep')).toBe(true);
    });
  });

  // ─── Score Intent (Core Scoring Logic) ──────────────────────────────────────

  describe('scoreIntent', () => {
    it('scores customer response and returns QuestionIntentScore (Req 3.10)', async () => {
      const segments: TranscriptSegment[] = [
        createSegment({ speaker: 'customer_1', text: 'We have 200 vehicles across 3 depots.' }),
      ];

      const result = await scorer.scoreIntent('session-1', 'q-1', segments);

      expect(result.questionId).toBe('q-1');
      expect(result.score).toBe(85);
      expect(result.isMet).toBe(true);
      expect(result.reasoning).toBe('Customer provided specific fleet size and vehicle count.');
      expect(result.followUpNeeded).toBe(false);
      expect(result.evaluatedAt).toBeInstanceOf(Date);
    });

    it('marks intent as met when score >= 70 (Req 3.11)', async () => {
      mockLLM = createMockLLMClient(
        '{"score": 70, "reasoning": "Adequate response.", "followUpNeeded": false}',
      );
      scorer = new QuestionIntentScorerImpl({ llmClient: mockLLM });

      const segments = [createSegment({ speaker: 'customer_1', text: 'Yes, about 150 trucks.' })];
      const result = await scorer.scoreIntent('session-1', 'q-1', segments);

      expect(result.score).toBe(70);
      expect(result.isMet).toBe(true);
    });

    it('marks intent as NOT met when score < 70 (Req 3.12)', async () => {
      mockLLM = createMockLLMClient(
        '{"score": 45, "reasoning": "Customer deflected the question.", "followUpNeeded": true}',
      );
      scorer = new QuestionIntentScorerImpl({ llmClient: mockLLM });

      const segments = [createSegment({ speaker: 'customer_1', text: "Let's talk about that later." })];
      const result = await scorer.scoreIntent('session-1', 'q-1', segments);

      expect(result.score).toBe(45);
      expect(result.isMet).toBe(false);
      expect(result.followUpNeeded).toBe(true);
    });

    it('returns score 0 when no customer segments exist', async () => {
      const segments = [createSegment({ speaker: 'rep', text: 'How many vehicles do you have?' })];
      const result = await scorer.scoreIntent('session-1', 'q-1', segments);

      expect(result.score).toBe(0);
      expect(result.isMet).toBe(false);
      expect(result.followUpNeeded).toBe(true);
      expect(result.reasoning).toContain('No customer response');
    });

    it('filters out rep segments before scoring (Req 27.3)', async () => {
      const segments: TranscriptSegment[] = [
        createSegment({ speaker: 'rep', text: 'Tell me about your fleet size.' }),
        createSegment({ speaker: 'customer_1', text: 'We run 300 trucks across Europe.' }),
        createSegment({ speaker: 'rep', text: 'Interesting, and the cost?' }),
      ];

      await scorer.scoreIntent('session-1', 'q-1', segments);

      // Verify the LLM was called and the prompt contains only customer text
      expect(mockLLM.complete).toHaveBeenCalledTimes(1);
      const callArg = (mockLLM.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(callArg).toContain('We run 300 trucks across Europe.');
      expect(callArg).not.toContain('Tell me about your fleet size.');
      expect(callArg).not.toContain('Interesting, and the cost?');
    });

    it('supports custom intent met threshold', async () => {
      mockLLM = createMockLLMClient(
        '{"score": 55, "reasoning": "Partial response.", "followUpNeeded": true}',
      );
      scorer = new QuestionIntentScorerImpl({
        llmClient: mockLLM,
        intentMetThreshold: 50,
      });

      const segments = [createSegment({ speaker: 'customer_1', text: 'Some info...' })];
      const result = await scorer.scoreIntent('session-1', 'q-1', segments);

      expect(result.score).toBe(55);
      expect(result.isMet).toBe(true); // 55 >= 50 (custom threshold)
    });

    it('clamps score to [0, 100] range', async () => {
      mockLLM = createMockLLMClient(
        '{"score": 150, "reasoning": "Excellent response.", "followUpNeeded": false}',
      );
      scorer = new QuestionIntentScorerImpl({ llmClient: mockLLM });

      const segments = [createSegment({ speaker: 'customer_1', text: 'Detailed answer.' })];
      const result = await scorer.scoreIntent('session-1', 'q-1', segments);

      expect(result.score).toBe(100);
    });
  });

  // ─── Streaming Score Updates ────────────────────────────────────────────────

  describe('streaming score updates', () => {
    it('emits partial score updates during streaming analysis', async () => {
      const chunks = [
        '{"score": ',
        '75',
        ', "reasoning": "Good response.",',
        ' "followUpNeeded": false}',
      ];
      const streamingLLM = createStreamingLLMClient(chunks);
      const updates: PartialScoreUpdate[] = [];

      scorer = new QuestionIntentScorerImpl({
        llmClient: streamingLLM,
        onScoreUpdate: (update) => updates.push(update),
      });

      const segments = [createSegment({ speaker: 'customer_1', text: 'Detailed response.' })];
      const result = await scorer.scoreIntent('session-1', 'q-1', segments);

      // Should have at least one intermediate update plus a final
      expect(updates.length).toBeGreaterThanOrEqual(1);

      // Final update should be complete
      const finalUpdate = updates[updates.length - 1];
      expect(finalUpdate.isComplete).toBe(true);
      expect(finalUpdate.partialScore).toBe(result.score);
    });

    it('emits final score update with reasoning', async () => {
      const streamingLLM = createStreamingLLMClient([
        '{"score": 90, "reasoning": "Comprehensive answer.", "followUpNeeded": false}',
      ]);
      const updates: PartialScoreUpdate[] = [];

      scorer = new QuestionIntentScorerImpl({
        llmClient: streamingLLM,
        onScoreUpdate: (update) => updates.push(update),
      });

      const segments = [createSegment({ speaker: 'customer_1', text: 'Full answer.' })];
      await scorer.scoreIntent('session-1', 'q-1', segments);

      const finalUpdate = updates[updates.length - 1];
      expect(finalUpdate.isComplete).toBe(true);
      expect(finalUpdate.reasoning).toBe('Comprehensive answer.');
    });

    it('emits score=0 update when no customer segments', async () => {
      const updates: PartialScoreUpdate[] = [];
      scorer = new QuestionIntentScorerImpl({
        llmClient: mockLLM,
        onScoreUpdate: (update) => updates.push(update),
      });

      const segments = [createSegment({ speaker: 'rep', text: 'No customer here.' })];
      await scorer.scoreIntent('session-1', 'q-1', segments);

      expect(updates).toHaveLength(1);
      expect(updates[0].partialScore).toBe(0);
      expect(updates[0].isComplete).toBe(true);
    });
  });

  // ─── Prompt Building ────────────────────────────────────────────────────────

  describe('buildIntentScoringPrompt', () => {
    it('includes the question text in the prompt', () => {
      const prompt = buildIntentScoringPrompt(
        'How many vehicles are in your fleet?',
        'We have 200 trucks.',
      );

      expect(prompt).toContain('How many vehicles are in your fleet?');
    });

    it('includes the customer response in the prompt', () => {
      const prompt = buildIntentScoringPrompt(
        'What is your biggest routing challenge?',
        'Last-mile delivery costs are killing our margins.',
      );

      expect(prompt).toContain('Last-mile delivery costs are killing our margins.');
    });

    it('includes scoring guidelines with 0-100 scale', () => {
      const prompt = buildIntentScoringPrompt('Question?', 'Answer.');

      expect(prompt).toContain('Score 0–20');
      expect(prompt).toContain('Score 70–85');
      expect(prompt).toContain('Score 86–100');
    });

    it('requests JSON output format', () => {
      const prompt = buildIntentScoringPrompt('Question?', 'Answer.');

      expect(prompt).toContain('"score"');
      expect(prompt).toContain('"reasoning"');
      expect(prompt).toContain('"followUpNeeded"');
    });
  });

  // ─── Response Parsing ───────────────────────────────────────────────────────

  describe('parseIntentResponse', () => {
    it('parses a well-formed JSON response', () => {
      const result = parseIntentResponse(
        '{"score": 82, "reasoning": "Clear and specific.", "followUpNeeded": false}',
      );

      expect(result.score).toBe(82);
      expect(result.reasoning).toBe('Clear and specific.');
      expect(result.followUpNeeded).toBe(false);
    });

    it('handles JSON embedded in surrounding text', () => {
      const result = parseIntentResponse(
        'Here is my evaluation: {"score": 60, "reasoning": "Partial.", "followUpNeeded": true} Hope that helps!',
      );

      expect(result.score).toBe(60);
      expect(result.reasoning).toBe('Partial.');
      expect(result.followUpNeeded).toBe(true);
    });

    it('returns score 0 for completely malformed response', () => {
      const result = parseIntentResponse('I cannot evaluate this question.');

      expect(result.score).toBe(0);
      expect(result.followUpNeeded).toBe(true);
    });

    it('clamps negative scores to 0', () => {
      const result = parseIntentResponse('{"score": -10, "reasoning": "Bad.", "followUpNeeded": true}');

      expect(result.score).toBe(0);
    });

    it('clamps scores above 100 to 100', () => {
      const result = parseIntentResponse('{"score": 110, "reasoning": "Great.", "followUpNeeded": false}');

      expect(result.score).toBe(100);
    });

    it('defaults followUpNeeded based on score when not provided', () => {
      const highScore = parseIntentResponse('{"score": 80, "reasoning": "Good."}');
      expect(highScore.followUpNeeded).toBe(false); // 80 >= 70

      const lowScore = parseIntentResponse('{"score": 40, "reasoning": "Weak."}');
      expect(lowScore.followUpNeeded).toBe(true); // 40 < 70
    });

    it('handles missing reasoning field gracefully', () => {
      const result = parseIntentResponse('{"score": 75, "followUpNeeded": false}');

      expect(result.score).toBe(75);
      expect(result.reasoning).toBe('No reasoning provided');
    });
  });
});
