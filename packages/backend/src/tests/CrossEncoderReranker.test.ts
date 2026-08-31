/**
 * Unit tests for CrossEncoderReranker
 *
 * Requirements: 8.2
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CrossEncoderReranker,
  type OnnxInferenceSession,
  type CrossEncoderTokenizer,
} from '../services/retrieval/CrossEncoderReranker.js';
import type { ScoredDocument } from '@ptv-discovery-coach/shared';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeScoredDocument(
  id: string,
  content: string,
  score: number,
  metadata: Record<string, unknown> = {},
): ScoredDocument {
  return {
    id,
    content,
    score,
    metadata: {
      sourceDocumentId: `doc-${id}`,
      sourceDocumentTitle: `Document ${id}`,
      sourceDocumentAuthor: 'Test Author',
      framework: 'ValueSelling',
      canonicalFields: ['pain'],
      sectionTitle: 'Section 1',
      pageNumber: 1,
      ...metadata,
    },
  };
}

/**
 * Creates a mock ONNX session that returns predefined scores.
 * The scoreMap maps document content to a logit value.
 */
function createMockSession(scoreMap: Map<string, number>): {
  session: OnnxInferenceSession;
  tokenizer: CrossEncoderTokenizer;
  callLog: string[];
} {
  const callLog: string[] = [];

  // Track the last passage encoded so we can look it up in the session
  let lastPassageEncoded = '';

  const tokenizer: CrossEncoderTokenizer = {
    encode(query: string, passage: string, maxLength: number) {
      lastPassageEncoded = passage;
      callLog.push(`encode: "${query}" + "${passage.slice(0, 30)}..."`);
      const seqLen = Math.min(10, maxLength);
      return {
        inputIds: new BigInt64Array(seqLen).fill(BigInt(1)),
        attentionMask: new BigInt64Array(seqLen).fill(BigInt(1)),
        tokenTypeIds: new BigInt64Array(seqLen).fill(BigInt(0)),
      };
    },
  };

  const session: OnnxInferenceSession = {
    async run(_feeds: Record<string, unknown>) {
      // Look up the score for the last encoded passage
      const logit = scoreMap.get(lastPassageEncoded) ?? 0;
      return {
        logits: { data: new Float32Array([logit]) },
      };
    },
  };

  return { session, tokenizer, callLog };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CrossEncoderReranker', () => {
  let reranker: CrossEncoderReranker;

  describe('initialization', () => {
    it('reports not initialized before calling initialize', () => {
      reranker = new CrossEncoderReranker();
      expect(reranker.isInitialized()).toBe(false);
    });

    it('reports initialized after initializeWithSession', () => {
      reranker = new CrossEncoderReranker();
      const { session, tokenizer } = createMockSession(new Map());
      reranker.initializeWithSession(session, tokenizer);
      expect(reranker.isInitialized()).toBe(true);
    });

    it('throws on rerank when not initialized', async () => {
      reranker = new CrossEncoderReranker();
      await expect(
        reranker.rerank([makeScoredDocument('1', 'test', 0.5)], 'query'),
      ).rejects.toThrow(/not initialized/i);
    });
  });

  describe('rerank', () => {
    beforeEach(() => {
      reranker = new CrossEncoderReranker({
        minScoreThreshold: 0.3,
        topK: 10,
      });
    });

    it('returns empty array for empty candidates', async () => {
      const { session, tokenizer } = createMockSession(new Map());
      reranker.initializeWithSession(session, tokenizer);

      const result = await reranker.rerank([], 'test query');
      expect(result).toEqual([]);
    });

    it('reranks candidates by cross-encoder score descending', async () => {
      const candidates = [
        makeScoredDocument('1', 'low relevance passage', 0.9),
        makeScoredDocument('2', 'high relevance passage', 0.1),
        makeScoredDocument('3', 'medium relevance passage', 0.5),
      ];

      // Logits that produce: sigmoid(-2) ≈ 0.12, sigmoid(3) ≈ 0.95, sigmoid(1) ≈ 0.73
      const scoreMap = new Map<string, number>([
        ['low relevance passage', -2],
        ['high relevance passage', 3],
        ['medium relevance passage', 1],
      ]);

      const { session, tokenizer } = createMockSession(scoreMap);
      reranker.initializeWithSession(session, tokenizer);

      const result = await reranker.rerank(candidates, 'test query');

      // Should be ordered: high (0.95) > medium (0.73) > low (0.12 - filtered out)
      expect(result.length).toBe(2); // low relevance is below 0.3 threshold
      expect(result[0].id).toBe('2'); // high relevance first
      expect(result[1].id).toBe('3'); // medium relevance second
    });

    it('filters results below minimum score threshold', async () => {
      const candidates = [
        makeScoredDocument('1', 'above threshold', 0.5),
        makeScoredDocument('2', 'below threshold', 0.5),
      ];

      // sigmoid(2) ≈ 0.88, sigmoid(-3) ≈ 0.047
      const scoreMap = new Map<string, number>([
        ['above threshold', 2],
        ['below threshold', -3],
      ]);

      const { session, tokenizer } = createMockSession(scoreMap);
      reranker.initializeWithSession(session, tokenizer);

      const result = await reranker.rerank(candidates, 'query');

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
      expect(result[0].score).toBeGreaterThan(0.3);
    });

    it('respects topK limit', async () => {
      const limitedReranker = new CrossEncoderReranker({
        minScoreThreshold: 0,
        topK: 2,
      });

      const candidates = [
        makeScoredDocument('1', 'passage one', 0.5),
        makeScoredDocument('2', 'passage two', 0.5),
        makeScoredDocument('3', 'passage three', 0.5),
        makeScoredDocument('4', 'passage four', 0.5),
      ];

      // All above threshold, different scores
      const scoreMap = new Map<string, number>([
        ['passage one', 1],
        ['passage two', 3],
        ['passage three', 2],
        ['passage four', 0.5],
      ]);

      const { session, tokenizer } = createMockSession(scoreMap);
      limitedReranker.initializeWithSession(session, tokenizer);

      const result = await limitedReranker.rerank(candidates, 'query');

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('2'); // highest score
      expect(result[1].id).toBe('3'); // second highest
    });

    it('allows topK override in method call', async () => {
      const candidates = [
        makeScoredDocument('1', 'passage a', 0.5),
        makeScoredDocument('2', 'passage b', 0.5),
        makeScoredDocument('3', 'passage c', 0.5),
      ];

      const scoreMap = new Map<string, number>([
        ['passage a', 2],
        ['passage b', 3],
        ['passage c', 1],
      ]);

      const { session, tokenizer } = createMockSession(scoreMap);
      reranker.initializeWithSession(session, tokenizer);

      const result = await reranker.rerank(candidates, 'query', 1);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2'); // highest score only
    });

    it('produces valid RankedPassage objects with correct metadata', async () => {
      const candidates = [
        makeScoredDocument('doc-1', 'relevant passage content', 0.8, {
          sourceDocumentId: 'src-doc-123',
          sourceDocumentTitle: 'ValueSelling Framework Guide',
          sourceDocumentAuthor: 'Author Name',
          framework: 'MEDDICC',
          canonicalFields: ['pain', 'stakeholder'],
          sectionTitle: 'Chapter 3: Pain Discovery',
          pageNumber: 42,
        }),
      ];

      const scoreMap = new Map<string, number>([
        ['relevant passage content', 2], // sigmoid(2) ≈ 0.88
      ]);

      const { session, tokenizer } = createMockSession(scoreMap);
      reranker.initializeWithSession(session, tokenizer);

      const result = await reranker.rerank(candidates, 'test query');

      expect(result.length).toBe(1);
      const passage = result[0];
      expect(passage.id).toBe('doc-1');
      expect(passage.content).toBe('relevant passage content');
      expect(passage.sourceDocument.id).toBe('src-doc-123');
      expect(passage.sourceDocument.title).toBe('ValueSelling Framework Guide');
      expect(passage.sourceDocument.author).toBe('Author Name');
      expect(passage.framework).toBe('MEDDICC');
      expect(passage.canonicalFields).toEqual(['pain', 'stakeholder']);
      expect(passage.citation.documentTitle).toBe('ValueSelling Framework Guide');
      expect(passage.citation.framework).toBe('MEDDICC');
      expect(passage.citation.sectionTitle).toBe('Chapter 3: Pain Discovery');
      expect(passage.citation.pageNumber).toBe(42);
      expect(passage.citation.passageId).toBe('doc-1');
      expect(passage.score).toBeCloseTo(0.88, 1);
    });

    it('uses default config from environment when not explicitly set', () => {
      const defaultReranker = new CrossEncoderReranker();
      // Should not throw during construction
      expect(defaultReranker.isInitialized()).toBe(false);
      expect(defaultReranker.getInitializationError()).toBeNull();
    });

    it('applies sigmoid to convert logits to [0, 1] scores', async () => {
      const candidates = [
        makeScoredDocument('1', 'zero logit passage', 0.5),
      ];

      // sigmoid(0) = 0.5 exactly
      const scoreMap = new Map<string, number>([
        ['zero logit passage', 0],
      ]);

      const { session, tokenizer } = createMockSession(scoreMap);
      reranker.initializeWithSession(session, tokenizer);

      const result = await reranker.rerank(candidates, 'query');

      expect(result.length).toBe(1);
      expect(result[0].score).toBeCloseTo(0.5, 5);
    });

    it('handles custom min score threshold', async () => {
      const strictReranker = new CrossEncoderReranker({
        minScoreThreshold: 0.8,
        topK: 10,
      });

      const candidates = [
        makeScoredDocument('1', 'highly relevant', 0.5),
        makeScoredDocument('2', 'moderately relevant', 0.5),
      ];

      // sigmoid(3) ≈ 0.95, sigmoid(1) ≈ 0.73
      const scoreMap = new Map<string, number>([
        ['highly relevant', 3],
        ['moderately relevant', 1],
      ]);

      const { session, tokenizer } = createMockSession(scoreMap);
      strictReranker.initializeWithSession(session, tokenizer);

      const result = await strictReranker.rerank(candidates, 'query');

      // Only the highly relevant one (0.95) should pass the 0.8 threshold
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    });
  });
});
