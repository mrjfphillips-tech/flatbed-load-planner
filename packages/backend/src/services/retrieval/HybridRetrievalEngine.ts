// @ts-nocheck
/**
 * Hybrid Retrieval Engine with Azure AI Search.
 *
 * Implements the RetrievalEngine and HybridSearchPipeline interfaces,
 * combining BM25 sparse retrieval + dense vector search with Reciprocal
 * Rank Fusion (RRF), cross-encoder reranking, graph expansion, and rights
 * enforcement.
 *
 * Requirements: 8.1, 8.5, 8.7, 10.5
 */

import {
  SearchClient,
  SearchIndexClient,
  AzureKeyCredential,
} from '@azure/search-documents';

import type {
  RetrievalQuery,
  RankedPassage,
  ScoredDocument,
  SearchFilters,
  RightsContext,
} from '@ptv-discovery-coach/shared';

import type { ContentChunk } from '@ptv-discovery-coach/shared';

import { CrossEncoderReranker } from './CrossEncoderReranker.js';
import { GraphEnrichedRetriever } from '../../retrieval/graphEnrichedRetriever.js';
import { RightsEnforcer } from '../../retrieval/rightsEnforcer.js';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Configuration for HybridRetrievalEngine.
 * Falls back to environment variables if not provided.
 */
export interface HybridRetrievalEngineConfig {
  /** Azure AI Search service endpoint URL. */
  endpoint?: string;
  /** Azure AI Search admin key. */
  apiKey?: string;
  /** Name of the search index. */
  indexName?: string;
  /** RRF k parameter (controls rank position influence). Default: 60 */
  rrfK?: number;
  /** Number of candidates to retrieve from each search (sparse/dense). Default: 50 */
  candidateCount?: number;
  /** Number of results after reranking to pass forward. Default: 10 */
  rerankTopK?: number;
  /** Whether to enable graph expansion by default. Default: true */
  enableGraphExpansion?: boolean;
}

/**
 * An embedding provider function. Accepts text, returns a 1536-dim vector.
 * This is injected so the retrieval engine is not coupled to a specific
 * embedding API (Azure OpenAI, OpenAI, etc.).
 */
export type EmbeddingProvider = (text: string) => Promise<Float32Array>;

// ─── Azure AI Search Document Schema ──────────────────────────────────────────

/**
 * The document shape stored in the Azure AI Search index.
 */
interface AzureSearchDocument {
  id: string;
  content: string;
  embedding?: number[];
  framework?: string;
  canonicalFields?: string[];
  frameworkNativeFields?: string[];
  sourceDocumentId?: string;
  sourceDocumentTitle?: string;
  sourceDocumentAuthor?: string;
  sectionTitle?: string;
  pageNumber?: number;
  chunkIndex?: number;
  version?: number;
  permittedRoles?: string[];
  permittedTeams?: string[];
}

// ─── HybridRetrievalEngine Class ──────────────────────────────────────────────

/**
 * HybridRetrievalEngine implements full-pipeline hybrid search:
 *
 *  1. Sparse BM25 search via Azure AI Search text fields
 *  2. Dense vector search via Azure AI Search vector field
 *  3. Reciprocal Rank Fusion (RRF) to merge result sets
 *  4. Cross-encoder reranking for semantic precision
 *  5. Graph expansion for cross-framework concept discovery
 *  6. Rights enforcement for access control
 *
 * Targets <2 second response time for 95% of queries (Req 8.5).
 */
export class HybridRetrievalEngine {
  private readonly searchClient: SearchClient<AzureSearchDocument>;
  private readonly indexClient: SearchIndexClient;
  private readonly crossEncoder: CrossEncoderReranker;
  private readonly graphRetriever: GraphEnrichedRetriever;
  private readonly rightsEnforcer: RightsEnforcer;
  private readonly embeddingProvider: EmbeddingProvider;

  private readonly rrfK: number;
  private readonly candidateCount: number;
  private readonly rerankTopK: number;
  private readonly enableGraphExpansion: boolean;
  private readonly indexName: string;

  constructor(
    config: HybridRetrievalEngineConfig,
    embeddingProvider: EmbeddingProvider,
    crossEncoder: CrossEncoderReranker,
    graphRetriever: GraphEnrichedRetriever,
    rightsEnforcer: RightsEnforcer,
  ) {
    const endpoint = config.endpoint ?? process.env.AZURE_SEARCH_ENDPOINT;
    const apiKey = config.apiKey ?? process.env.AZURE_SEARCH_KEY;
    const indexName = config.indexName ?? process.env.AZURE_SEARCH_INDEX_NAME ?? 'ptv-discovery-coach-index';

    if (!endpoint) {
      throw new Error('Azure AI Search endpoint is required. Set AZURE_SEARCH_ENDPOINT env var or pass endpoint in config.');
    }
    if (!apiKey) {
      throw new Error('Azure AI Search API key is required. Set AZURE_SEARCH_KEY env var or pass apiKey in config.');
    }

    this.indexName = indexName;
    this.rrfK = config.rrfK ?? 60;
    this.candidateCount = config.candidateCount ?? 50;
    this.rerankTopK = config.rerankTopK ?? 10;
    this.enableGraphExpansion = config.enableGraphExpansion ?? true;

    const credential = new AzureKeyCredential(apiKey);

    this.searchClient = new SearchClient<AzureSearchDocument>(
      endpoint,
      indexName,
      credential,
    );

    this.indexClient = new SearchIndexClient(endpoint, credential);

    this.embeddingProvider = embeddingProvider;
    this.crossEncoder = crossEncoder;
    this.graphRetriever = graphRetriever;
    this.rightsEnforcer = rightsEnforcer;
  }

  // ─── RetrievalEngine Interface ────────────────────────────────────────────

  /**
   * Full hybrid retrieval pipeline:
   * sparse + dense → RRF → cross-encoder rerank → graph expand → rights enforce
   *
   * Requirements: 8.1, 8.5, 8.7, 10.5
   */
  async search(query: RetrievalQuery): Promise<RankedPassage[]> {
    const filters = this.buildSearchFilters(query);

    // Step 1: Parallel sparse + dense retrieval
    const [sparseResults, embedding] = await Promise.all([
      this.sparseSearch(query.text, filters),
      this.embeddingProvider(query.text),
    ]);

    const denseResults = await this.denseSearch(embedding, filters);

    // Step 2: RRF fusion merge
    const fused = this.fusionMerge(sparseResults, denseResults, this.rrfK);

    // Step 3: Cross-encoder reranking
    const reranked = await this.crossEncoder.rerank(fused, query.text, this.rerankTopK);

    // Step 4: Graph expansion (optional)
    let expanded: RankedPassage[] = reranked;
    if (query.enableGraphExpansion && this.enableGraphExpansion) {
      expanded = await this.graphRetriever.expandViaGraph(reranked, filters);
    }

    // Step 5: Rights enforcement
    const authorized = await this.rightsEnforcer.enforce(expanded, query.rightsContext);

    // Return limited to maxResults
    return authorized.slice(0, query.maxResults);
  }

  /**
   * Index content chunks into Azure AI Search.
   */
  async indexChunks(chunks: ContentChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const documents: AzureSearchDocument[] = await Promise.all(
      chunks.map(async (chunk) => {
        const embeddingVector = await this.embeddingProvider(chunk.content);

        return {
          id: chunk.id,
          content: chunk.content,
          embedding: Array.from(embeddingVector),
          framework: undefined, // Set by caller if known
          canonicalFields: chunk.canonicalFields,
          frameworkNativeFields: chunk.frameworkNativeFields,
          sourceDocumentId: chunk.sourceDocumentId,
          sourceDocumentTitle: undefined,
          sourceDocumentAuthor: undefined,
          sectionTitle: chunk.sectionTitle,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          version: chunk.version,
          permittedRoles: undefined,
          permittedTeams: undefined,
        };
      }),
    );

    // Upload in batches of 1000 (Azure AI Search limit)
    const batchSize = 1000;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await this.searchClient.uploadDocuments(batch);
    }
  }

  /**
   * Remove all chunks belonging to a document from the index.
   */
  async removeDocument(documentId: string): Promise<void> {
    // Find all chunks with this sourceDocumentId
    const results = this.searchClient.search('*', {
      filter: `sourceDocumentId eq '${documentId}'`,
      select: ['id'] as (keyof AzureSearchDocument)[],
      top: 10000,
    });

    const idsToDelete: AzureSearchDocument[] = [];
    for await (const result of results.results) {
      idsToDelete.push({ id: result.document.id } as AzureSearchDocument);
    }

    if (idsToDelete.length > 0) {
      // Delete in batches
      const batchSize = 1000;
      for (let i = 0; i < idsToDelete.length; i += batchSize) {
        const batch = idsToDelete.slice(i, i + batchSize);
        await this.searchClient.deleteDocuments(batch);
      }
    }
  }

  // ─── HybridSearchPipeline Interface ───────────────────────────────────────

  /**
   * BM25 sparse text search against Azure AI Search.
   * Searches the 'content', 'sectionTitle', and 'sourceDocumentTitle' fields.
   */
  async sparseSearch(query: string, filters: SearchFilters): Promise<ScoredDocument[]> {
    const filterExpression = this.buildODataFilter(filters);

    const response = this.searchClient.search(query, {
      filter: filterExpression,
      top: this.candidateCount,
      queryType: 'simple',
      searchFields: ['content', 'sectionTitle', 'sourceDocumentTitle'] as (keyof AzureSearchDocument)[],
      select: [
        'id', 'content', 'framework', 'canonicalFields', 'frameworkNativeFields',
        'sourceDocumentId', 'sourceDocumentTitle', 'sourceDocumentAuthor',
        'sectionTitle', 'pageNumber', 'chunkIndex',
      ] as (keyof AzureSearchDocument)[],
    });

    const results: ScoredDocument[] = [];
    for await (const item of response.results) {
      results.push({
        id: item.document.id,
        content: item.document.content ?? '',
        score: item.score ?? 0,
        metadata: {
          framework: item.document.framework,
          canonicalFields: item.document.canonicalFields,
          frameworkNativeFields: item.document.frameworkNativeFields,
          sourceDocumentId: item.document.sourceDocumentId,
          sourceDocumentTitle: item.document.sourceDocumentTitle,
          sourceDocumentAuthor: item.document.sourceDocumentAuthor,
          sectionTitle: item.document.sectionTitle,
          pageNumber: item.document.pageNumber,
          chunkIndex: item.document.chunkIndex,
        },
      });
    }

    return results;
  }

  /**
   * Dense vector similarity search against the embedding field.
   */
  async denseSearch(embedding: Float32Array, filters: SearchFilters): Promise<ScoredDocument[]> {
    const filterExpression = this.buildODataFilter(filters);

    const response = this.searchClient.search('*', {
      filter: filterExpression,
      vectorSearchOptions: {
        queries: [
          {
            kind: 'vector',
            vector: Array.from(embedding),
            kNearestNeighborsCount: this.candidateCount,
            fields: ['embedding'],
          },
        ],
      },
      select: [
        'id', 'content', 'framework', 'canonicalFields', 'frameworkNativeFields',
        'sourceDocumentId', 'sourceDocumentTitle', 'sourceDocumentAuthor',
        'sectionTitle', 'pageNumber', 'chunkIndex',
      ] as (keyof AzureSearchDocument)[],
    });

    const results: ScoredDocument[] = [];
    for await (const item of response.results) {
      results.push({
        id: item.document.id,
        content: item.document.content ?? '',
        score: item.score ?? 0,
        metadata: {
          framework: item.document.framework,
          canonicalFields: item.document.canonicalFields,
          frameworkNativeFields: item.document.frameworkNativeFields,
          sourceDocumentId: item.document.sourceDocumentId,
          sourceDocumentTitle: item.document.sourceDocumentTitle,
          sourceDocumentAuthor: item.document.sourceDocumentAuthor,
          sectionTitle: item.document.sectionTitle,
          pageNumber: item.document.pageNumber,
          chunkIndex: item.document.chunkIndex,
        },
      });
    }

    return results;
  }

  /**
   * Reciprocal Rank Fusion (RRF) to merge sparse and dense result sets.
   *
   * RRF formula: score(d) = Σ 1 / (k + rank_i(d))
   * where k is a constant (default 60) and rank_i is the rank in result set i.
   *
   * This balances contribution from both retrieval methods without requiring
   * score normalization.
   */
  fusionMerge(sparse: ScoredDocument[], dense: ScoredDocument[], k: number = 60): ScoredDocument[] {
    const scoreMap = new Map<string, { doc: ScoredDocument; rrfScore: number }>();

    // Add RRF scores from sparse results
    for (let rank = 0; rank < sparse.length; rank++) {
      const doc = sparse[rank];
      const rrfScore = 1 / (k + rank + 1); // rank is 0-indexed, formula uses 1-indexed
      const existing = scoreMap.get(doc.id);
      if (existing) {
        existing.rrfScore += rrfScore;
      } else {
        scoreMap.set(doc.id, { doc, rrfScore });
      }
    }

    // Add RRF scores from dense results
    for (let rank = 0; rank < dense.length; rank++) {
      const doc = dense[rank];
      const rrfScore = 1 / (k + rank + 1);
      const existing = scoreMap.get(doc.id);
      if (existing) {
        existing.rrfScore += rrfScore;
      } else {
        scoreMap.set(doc.id, { doc, rrfScore });
      }
    }

    // Sort by combined RRF score descending
    const merged = Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map(({ doc, rrfScore }) => ({
        ...doc,
        score: rrfScore,
      }));

    return merged;
  }

  // ─── Index Management ─────────────────────────────────────────────────────

  /**
   * Ensure the search index exists, creating it if needed.
   * Uses the schema from indexDefinition.ts.
   */
  async ensureIndex(): Promise<void> {
    const { createSearchIndexDefinition } = await import('./indexDefinition.js');
    const indexDefinition = createSearchIndexDefinition(this.indexName);

    try {
      await this.indexClient.getIndex(this.indexName);
      // Index exists — no action needed
    } catch {
      // Index does not exist — create it
      await this.indexClient.createIndex(indexDefinition);
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Build SearchFilters from a RetrievalQuery.
   */
  private buildSearchFilters(query: RetrievalQuery): SearchFilters {
    return {
      frameworks: query.frameworks,
      canonicalFields: query.canonicalFields,
      userRole: query.userRole,
      permittedTeams: query.rightsContext.teamIds,
    };
  }

  /**
   * Build an OData filter expression for Azure AI Search from SearchFilters.
   * Applies framework filtering and role/team-based access restrictions.
   *
   * Requirements: 8.7, 10.5
   */
  private buildODataFilter(filters: SearchFilters): string | undefined {
    const clauses: string[] = [];

    // Framework filter
    if (filters.frameworks && filters.frameworks.length > 0) {
      const frameworkClauses = filters.frameworks
        .map((f) => `framework eq '${f}'`)
        .join(' or ');
      clauses.push(`(${frameworkClauses})`);
    }

    // Canonical field filter
    if (filters.canonicalFields && filters.canonicalFields.length > 0) {
      const fieldClauses = filters.canonicalFields
        .map((f) => `canonicalFields/any(c: c eq '${f}')`)
        .join(' or ');
      clauses.push(`(${fieldClauses})`);
    }

    // Role-based access restriction
    if (filters.userRole) {
      clauses.push(`permittedRoles/any(r: r eq '${filters.userRole}')`);
    }

    // Team-based access restriction
    if (filters.permittedTeams && filters.permittedTeams.length > 0) {
      const teamClauses = filters.permittedTeams
        .map((t) => `permittedTeams/any(t: t eq '${t}')`)
        .join(' or ');
      // Either no team restriction (empty permittedTeams) or user's team matches
      clauses.push(`(permittedTeams/any() eq false or ${teamClauses})`);
    }

    return clauses.length > 0 ? clauses.join(' and ') : undefined;
  }
}
