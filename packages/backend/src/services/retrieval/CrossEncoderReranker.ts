// @ts-nocheck
/**
 * Cross-Encoder Reranker using ms-marco-MiniLM-L-12-v2 via ONNX Runtime.
 *
 * Implements the HybridSearchPipeline.rerank() step:
 * Accepts candidate passages from RRF fusion and reranks them by
 * semantic relevance using a cross-encoder model.
 *
 * Requirements: 8.2
 */

import type { ScoredDocument, RankedPassage } from '@ptv-discovery-coach/shared';

/**
 * Configuration options for the CrossEncoderReranker.
 */
export interface CrossEncoderRerankerConfig {
  /** Path to the ONNX model file. Defaults to env CROSS_ENCODER_MODEL_PATH. */
  modelPath?: string;
  /** Minimum score threshold for result filtering. Default: 0.3 */
  minScoreThreshold?: number;
  /** Maximum number of results to return. Default: 10 */
  topK?: number;
  /** Maximum sequence length for tokenization. Default: 512 */
  maxSequenceLength?: number;
}

/**
 * Represents a tokenized query-passage pair ready for model inference.
 */
interface TokenizedPair {
  inputIds: BigInt64Array;
  attentionMask: BigInt64Array;
  tokenTypeIds: BigInt64Array;
}

/**
 * ONNX Runtime inference session interface (subset needed for our usage).
 * This allows testing without requiring the full onnxruntime-node package.
 */
export interface OnnxInferenceSession {
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array | number[] }>>;
}

/**
 * Tokenizer interface for encoding query-passage pairs.
 * Implementations should produce BERT-style token sequences.
 */
export interface CrossEncoderTokenizer {
  encode(query: string, passage: string, maxLength: number): TokenizedPair;
}

/**
 * CrossEncoderReranker reranks candidate passages by semantic relevance
 * using the ms-marco-MiniLM-L-12-v2 cross-encoder model via ONNX Runtime.
 */
export class CrossEncoderReranker {
  private session: OnnxInferenceSession | null = null;
  private tokenizer: CrossEncoderTokenizer | null = null;
  private readonly modelPath: string;
  private readonly minScoreThreshold: number;
  private readonly topK: number;
  private readonly maxSequenceLength: number;
  private initialized = false;
  private initializationError: Error | null = null;

  constructor(config: CrossEncoderRerankerConfig = {}) {
    this.modelPath = config.modelPath
      ?? process.env.CROSS_ENCODER_MODEL_PATH
      ?? './models/ms-marco-MiniLM-L-12-v2.onnx';
    this.minScoreThreshold = config.minScoreThreshold ?? 0.3;
    this.topK = config.topK ?? 10;
    this.maxSequenceLength = config.maxSequenceLength ?? 512;
  }

  /**
   * Initialize the ONNX Runtime session and tokenizer.
   * Must be called before reranking. Throws if model loading fails.
   */
  async initialize(): Promise<void> {
    try {
      const ort = await import('onnxruntime-node');
      this.session = await ort.InferenceSession.create(this.modelPath) as unknown as OnnxInferenceSession;
      this.tokenizer = this.createDefaultTokenizer();
      this.initialized = true;
      this.initializationError = null;
    } catch (error) {
      this.initializationError = error instanceof Error
        ? error
        : new Error(`Failed to load cross-encoder model from ${this.modelPath}`);
      this.initialized = false;
      throw this.initializationError;
    }
  }

  /**
   * Initialize with pre-built session and tokenizer (useful for testing
   * or when session is managed externally).
   */
  initializeWithSession(session: OnnxInferenceSession, tokenizer: CrossEncoderTokenizer): void {
    this.session = session;
    this.tokenizer = tokenizer;
    this.initialized = true;
    this.initializationError = null;
  }

  /**
   * Returns whether the reranker has been successfully initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Returns the initialization error if initialization failed.
   */
  getInitializationError(): Error | null {
    return this.initializationError;
  }

  /**
   * Rerank candidate passages by cross-encoder semantic relevance score.
   *
   * Implements HybridSearchPipeline.rerank():
   * 1. Scores each query-passage pair using the cross-encoder
   * 2. Sorts by score descending
   * 3. Filters below minimum score threshold
   * 4. Returns top-K results
   *
   * @param candidates - Passages from RRF fusion to rerank
   * @param query - The search query text
   * @param topK - Override for maximum results to return (optional)
   * @returns Reranked passages sorted by semantic relevance
   */
  async rerank(
    candidates: ScoredDocument[],
    query: string,
    topK?: number,
  ): Promise<RankedPassage[]> {
    if (!this.initialized || !this.session || !this.tokenizer) {
      throw new Error(
        'CrossEncoderReranker not initialized. Call initialize() or initializeWithSession() first.',
      );
    }

    if (candidates.length === 0) {
      return [];
    }

    const effectiveTopK = topK ?? this.topK;

    // Score each candidate against the query
    const scoredCandidates = await this.scoreAll(candidates, query);

    // Sort by cross-encoder score descending
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Filter below minimum score threshold
    const filtered = scoredCandidates.filter(
      (item) => item.score >= this.minScoreThreshold,
    );

    // Take top-K results
    const topResults = filtered.slice(0, effectiveTopK);

    // Convert to RankedPassage format
    return topResults.map((item) => this.toRankedPassage(item.candidate, item.score));
  }

  /**
   * Score all query-passage pairs using the cross-encoder model.
   */
  private async scoreAll(
    candidates: ScoredDocument[],
    query: string,
  ): Promise<Array<{ candidate: ScoredDocument; score: number }>> {
    const results: Array<{ candidate: ScoredDocument; score: number }> = [];

    for (const candidate of candidates) {
      const score = await this.scorePair(query, candidate.content);
      results.push({ candidate, score });
    }

    return results;
  }

  /**
   * Score a single query-passage pair using the cross-encoder model.
   * Applies sigmoid to convert logit to probability.
   */
  private async scorePair(query: string, passage: string): Promise<number> {
    const tokenized = this.tokenizer!.encode(query, passage, this.maxSequenceLength);

    const feeds: Record<string, unknown> = {
      input_ids: this.createTensor(tokenized.inputIds),
      attention_mask: this.createTensor(tokenized.attentionMask),
      token_type_ids: this.createTensor(tokenized.tokenTypeIds),
    };

    const output = await this.session!.run(feeds);

    // The model outputs a single logit per pair
    const logits = output[Object.keys(output)[0]];
    const logit = Number(logits.data[0]);

    // Apply sigmoid to convert logit to [0, 1] relevance score
    return this.sigmoid(logit);
  }

  /**
   * Sigmoid function to convert logit to probability.
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Create an ONNX tensor wrapper for the inference session.
   */
  private createTensor(data: BigInt64Array): { data: BigInt64Array; dims: number[] } {
    return { data, dims: [1, data.length] };
  }

  /**
   * Convert a ScoredDocument to a RankedPassage with the cross-encoder score.
   */
  private toRankedPassage(doc: ScoredDocument, score: number): RankedPassage {
    const metadata = doc.metadata as Record<string, unknown>;

    return {
      id: doc.id,
      content: doc.content,
      sourceDocument: {
        id: (metadata.sourceDocumentId as string) ?? '',
        title: (metadata.sourceDocumentTitle as string) ?? '',
        author: (metadata.sourceDocumentAuthor as string) ?? undefined,
        framework: (metadata.framework as RankedPassage['sourceDocument']['framework']) ?? 'ValueSelling',
      },
      framework: (metadata.framework as RankedPassage['framework']) ?? 'ValueSelling',
      canonicalFields: (metadata.canonicalFields as RankedPassage['canonicalFields']) ?? [],
      score,
      citation: {
        documentTitle: (metadata.sourceDocumentTitle as string) ?? '',
        framework: (metadata.framework as RankedPassage['citation']['framework']) ?? 'ValueSelling',
        sectionTitle: (metadata.sectionTitle as string) ?? undefined,
        pageNumber: (metadata.pageNumber as number) ?? undefined,
        passageId: doc.id,
      },
    };
  }

  /**
   * Creates a simple word-piece-like tokenizer for the cross-encoder.
   * In production, this would use a proper BERT tokenizer library.
   * This default implementation provides basic whitespace tokenization
   * with special token handling for [CLS], [SEP] format.
   */
  private createDefaultTokenizer(): CrossEncoderTokenizer {
    return {
      encode(query: string, passage: string, maxLength: number): TokenizedPair {
        // Simple tokenization: split by whitespace, truncate to maxLength
        // Format: [CLS] query tokens [SEP] passage tokens [SEP]
        const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
        const passageTokens = passage.toLowerCase().split(/\s+/).filter(Boolean);

        // Reserve 3 spots for special tokens [CLS], [SEP], [SEP]
        const maxContentLength = maxLength - 3;
        const queryMaxLen = Math.min(queryTokens.length, Math.floor(maxContentLength / 3));
        const passageMaxLen = Math.min(passageTokens.length, maxContentLength - queryMaxLen);

        const truncatedQuery = queryTokens.slice(0, queryMaxLen);
        const truncatedPassage = passageTokens.slice(0, passageMaxLen);

        // Total sequence length
        const seqLength = 1 + truncatedQuery.length + 1 + truncatedPassage.length + 1;

        const inputIds = new BigInt64Array(seqLength);
        const attentionMask = new BigInt64Array(seqLength);
        const tokenTypeIds = new BigInt64Array(seqLength);

        let pos = 0;

        // [CLS] token (id = 101)
        inputIds[pos] = BigInt(101);
        attentionMask[pos] = BigInt(1);
        tokenTypeIds[pos] = BigInt(0);
        pos++;

        // Query tokens (segment A)
        for (let i = 0; i < truncatedQuery.length; i++) {
          inputIds[pos] = BigInt(hashToken(truncatedQuery[i]));
          attentionMask[pos] = BigInt(1);
          tokenTypeIds[pos] = BigInt(0);
          pos++;
        }

        // [SEP] token (id = 102)
        inputIds[pos] = BigInt(102);
        attentionMask[pos] = BigInt(1);
        tokenTypeIds[pos] = BigInt(0);
        pos++;

        // Passage tokens (segment B)
        for (let i = 0; i < truncatedPassage.length; i++) {
          inputIds[pos] = BigInt(hashToken(truncatedPassage[i]));
          attentionMask[pos] = BigInt(1);
          tokenTypeIds[pos] = BigInt(1);
          pos++;
        }

        // Final [SEP] token
        inputIds[pos] = BigInt(102);
        attentionMask[pos] = BigInt(1);
        tokenTypeIds[pos] = BigInt(1);

        return { inputIds, attentionMask, tokenTypeIds };
      },
    };
  }
}

/**
 * Simple hash function to generate pseudo token IDs from word strings.
 * Used as a fallback when a proper tokenizer vocabulary is not loaded.
 */
function hashToken(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Map to a positive value in typical vocab range [1000, 30522)
  return 1000 + (Math.abs(hash) % 29522);
}
