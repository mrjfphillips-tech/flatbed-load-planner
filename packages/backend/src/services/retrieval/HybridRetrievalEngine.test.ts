// @ts-nocheck
/**
 * Unit tests for HybridRetrievalEngine.
 *
 * Tests cover:
 * - RRF fusionMerge produces correct ordering
 * - Full search pipeline integration (sparse + dense → RRF → rerank → expand → enforce)
 * - Rights_Profile filtering excludes unauthorized content
 * - indexChunks and removeDocument operations
 *
 * Requirements: 8.1, 8.5, 8.7, 10.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RankedPassage, ScoredDocument, RetrievalQuery, RightsContext } from '@ptv-discovery-coach/shared';

// ─── Mock Azure SDK ───────────────────────────────────────────────────────────

// We mock the @azure/search-documents module to avoid needing a real Azure connection
vi.mock('@azure/search-documents', () => {
  return {
    SearchClient: vi.fn().mockImplementation(() => ({
      search: vi.fn(),
      uploadDocuments: vi.fn().mockResolvedValue({}),
      deleteDocuments: vi.fn().mockResolvedValue({}),
    })),
    SearchIndexClient: vi.fn().mockImplementation(() => ({
      getIndex: vi.fn().mockResolvedValue({}),
      createIndex: vi.fn().mockResolvedValue({}),
    })),
    AzureKeyCredential: vi.fn().mockImplementation((key: string) => ({ key })),
  };
});

import { HybridRetrievalEngine } from './HybridRetrievalEngine.js';
import type { EmbeddingProvider, HybridRetrievalEngineConfig } from './HybridRetrievalEngine.js';
import type { CrossEncoderReranker } from './CrossEncoderReranker.js';
import type { GraphEnrichedRetriever } from '../../retrieval/graphEnrichedRetriever.js';
import type { RightsEnforcer, AuthorizedPassage } from '../../retrieval/rightsEnforcer.js';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function makeConfig(): HybridRetrievalEngineConfig {
  return {
    endpoint: 'https://test.search.windows.net',
    apiKey: 'test-key',
    indexName: 'test-index',
    rrfK: 60,
    candidateCount: 50,
    rerankTopK: 10,
  };
}

function makeEmbeddingProvider(): EmbeddingProvider {
  return vi.fn().mockResolvedValue(new Float32Array(1536).fill(0.1));
}

function makeScoredDoc(overrides: Partial<ScoredDocument> = {}): ScoredDocument {
  return {
    id: overrides.id ?? 'doc-1',
    content: overrides.content ?? 'Test content',
    score: overrides.score ?? 0.8,
    metadata: overrides.metadata ?? {
      framework: 'ValueSelling',
      canonicalFields: ['pain'],
      sourceDocumentId: 'src-doc-1',
      sourceDocumentTitle: 'Test Document',
      sectionTitle: 'Chapter 1',
      pageNumber: 5,
    },
  };
}

function makeRankedPassage(overrides: Partial<RankedPassage> = {}): RankedPassage {
  return {
    id: overrides.id ?? 'passage-1',
    content: overrides.content ?? 'Test passage content',
    sourceDocument: overrides.sourceDocument ?? {
      id: 'src-doc-1',
      title: 'Test Document',
      framework: 'ValueSelling',
    },
    framework: overrides.framework ?? 'ValueSelling',
    canonicalFields: overrides.canonicalFields ?? ['pain'],
    score: overrides.score ?? 0.9,
    citation: overrides.citation ?? {
      documentTitle: 'Test Document',
      framework: 'ValueSelling',
      sectionTitle: 'Chapter 1',
      pageNumber: 5,
      passageId: 'passage-1',
    },
  };
}

function makeQuery(overrides: Partial<RetrievalQuery> = {}): RetrievalQuery {
  return {
    text: overrides.text ?? 'What are the customer pain points?',
    frameworks: overrides.frameworks ?? ['ValueSelling', 'MEDDICC'],
    canonicalFields: overrides.canonicalFields,
    userRole: overrides.userRole ?? 'rep',
    rightsContext: overrides.rightsContext ?? {
      userId: 'user-1',
      role: 'rep',
      teamIds: ['team-1'],
    },
    maxResults: overrides.maxResults ?? 10,
    enableGraphExpansion: overrides.enableGraphExpansion ?? true,
  };
}

function makeMockCrossEncoder(): CrossEncoderReranker {
  return {
    rerank: vi.fn().mockResolvedValue([
      makeRankedPassage({ id: 'reranked-1', score: 0.95 }),
      makeRankedPassage({ id: 'reranked-2', score: 0.85 }),
    ]),
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
    initializeWithSession: vi.fn(),
    getInitializationError: vi.fn().mockReturnValue(null),
  } as unknown as CrossEncoderReranker;
}

function makeMockGraphRetriever(): GraphEnrichedRetriever {
  return {
    expandViaGraph: vi.fn().mockImplementation((passages: RankedPassage[]) => {
      // Return passages plus one expanded passage
      return Promise.resolve([
        ...passages,
        makeRankedPassage({ id: 'expanded-1', score: 0.7, canonicalFields: ['value_metric'] }),
      ]);
    }),
  } as unknown as GraphEnrichedRetriever;
}

function makeMockRightsEnforcer(): RightsEnforcer {
  return {
    enforce: vi.fn().mockImplementation((passages: RankedPassage[]) => {
      // Pass through all passages with attribution
      return Promise.resolve(
        passages.map((p) => ({ ...p, attributionText: null })),
      );
    }),
  } as unknown as RightsEnforcer;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HybridRetrievalEngine', () => {
  let engine: HybridRetrievalEngine;
  let mockEmbeddingProvider: EmbeddingProvider;
  let mockCrossEncoder: CrossEncoderReranker;
  let mockGraphRetriever: GraphEnrichedRetriever;
  let mockRightsEnforcer: RightsEnforcer;

  beforeEach(() => {
    mockEmbeddingProvider = makeEmbeddingProvider();
    mockCrossEncoder = makeMockCrossEncoder();
    mockGraphRetriever = makeMockGraphRetriever();
    mockRightsEnforcer = makeMockRightsEnforcer();

    engine = new HybridRetrievalEngine(
      makeConfig(),
      mockEmbeddingProvider,
      mockCrossEncoder,
      mockGraphRetriever,
      mockRightsEnforcer,
    );
  });

  // ─── Constructor Tests ──────────────────────────────────────────────────

  describe('constructor', () => {
    it('throws if endpoint is missing', () => {
      expect(() => new HybridRetrievalEngine(
        { apiKey: 'key', indexName: 'idx' },
        mockEmbeddingProvider,
        mockCrossEncoder,
        mockGraphRetriever,
        mockRightsEnforcer,
      )).toThrow('endpoint is required');
    });

    it('throws if apiKey is missing', () => {
      expect(() => new HybridRetrievalEngine(
        { endpoint: 'https://test.search.windows.net', indexName: 'idx' },
        mockEmbeddingProvider,
        mockCrossEncoder,
        mockGraphRetriever,
        mockRightsEnforcer,
      )).toThrow('API key is required');
    });

    it('creates engine with valid config', () => {
      expect(engine).toBeDefined();
    });
  });

  // ─── RRF Fusion Tests ───────────────────────────────────────────────────

  describe('fusionMerge', () => {
    it('combines sparse and dense results using RRF formula', () => {
      const sparse: ScoredDocument[] = [
        makeScoredDoc({ id: 'a', score: 10 }),
        makeScoredDoc({ id: 'b', score: 8 }),
        makeScoredDoc({ id: 'c', score: 6 }),
      ];
      const dense: ScoredDocument[] = [
        makeScoredDoc({ id: 'b', score: 0.95 }),
        makeScoredDoc({ id: 'd', score: 0.90 }),
        makeScoredDoc({ id: 'a', score: 0.85 }),
      ];

      const merged = engine.fusionMerge(sparse, dense, 60);

      // 'b' appears in both: sparse rank 2 (1/(60+2)) + dense rank 1 (1/(60+1))
      // 'a' appears in both: sparse rank 1 (1/(60+1)) + dense rank 3 (1/(60+3))
      // 'b' should score higher than 'a'
      const ids = merged.map((d) => d.id);
      expect(ids[0]).toBe('b'); // highest combined RRF score
      expect(ids[1]).toBe('a'); // second highest
    });

    it('handles documents appearing only in one result set', () => {
      const sparse: ScoredDocument[] = [
        makeScoredDoc({ id: 'only-sparse', score: 10 }),
      ];
      const dense: ScoredDocument[] = [
        makeScoredDoc({ id: 'only-dense', score: 0.9 }),
      ];

      const merged = engine.fusionMerge(sparse, dense, 60);

      expect(merged).toHaveLength(2);
      // Both have same RRF score: 1/(60+1) since each is rank 1 in their respective set
      const ids = merged.map((d) => d.id);
      expect(ids).toContain('only-sparse');
      expect(ids).toContain('only-dense');
    });

    it('preserves document content and metadata in merged results', () => {
      const sparse: ScoredDocument[] = [
        makeScoredDoc({ id: 'x', content: 'Sparse content', metadata: { source: 'sparse' } }),
      ];
      const dense: ScoredDocument[] = [];

      const merged = engine.fusionMerge(sparse, dense, 60);

      expect(merged[0].id).toBe('x');
      expect(merged[0].content).toBe('Sparse content');
    });

    it('returns empty array when both inputs are empty', () => {
      const merged = engine.fusionMerge([], [], 60);
      expect(merged).toEqual([]);
    });

    it('correctly computes RRF scores with different k values', () => {
      const sparse: ScoredDocument[] = [
        makeScoredDoc({ id: 'a', score: 10 }),
      ];
      const dense: ScoredDocument[] = [
        makeScoredDoc({ id: 'a', score: 0.9 }),
      ];

      // k=60: score = 1/(60+1) + 1/(60+1) = 2/61 ≈ 0.0328
      const merged60 = engine.fusionMerge(sparse, dense, 60);
      expect(merged60[0].score).toBeCloseTo(2 / 61, 5);

      // k=1: score = 1/(1+1) + 1/(1+1) = 2/2 = 1.0
      const merged1 = engine.fusionMerge(sparse, dense, 1);
      expect(merged1[0].score).toBeCloseTo(1.0, 5);
    });

    it('sorts results by RRF score descending', () => {
      const sparse: ScoredDocument[] = [
        makeScoredDoc({ id: 'low', score: 1 }),
        makeScoredDoc({ id: 'high', score: 10 }),
      ];
      const dense: ScoredDocument[] = [
        makeScoredDoc({ id: 'high', score: 0.99 }),
        makeScoredDoc({ id: 'low', score: 0.5 }),
      ];

      // 'low': sparse rank 1 (1/61) + dense rank 2 (1/62) 
      // 'high': sparse rank 2 (1/62) + dense rank 1 (1/61)
      // Both should have identical combined scores
      const merged = engine.fusionMerge(sparse, dense, 60);
      expect(merged[0].score).toBeCloseTo(merged[1].score, 10);
    });
  });

  // ─── Full Search Pipeline Tests ─────────────────────────────────────────

  describe('search', () => {
    it('calls embedding provider with query text', async () => {
      // Mock the Azure search client to return empty results
      const searchMock = vi.fn().mockReturnValue({
        results: (async function* () { /* empty */ })(),
      });
      (engine as any).searchClient.search = searchMock;

      const query = makeQuery();
      await engine.search(query);

      expect(mockEmbeddingProvider).toHaveBeenCalledWith(query.text);
    });

    it('calls cross-encoder rerank with fused results', async () => {
      const searchMock = vi.fn().mockReturnValue({
        results: (async function* () { /* empty */ })(),
      });
      (engine as any).searchClient.search = searchMock;

      const query = makeQuery();
      await engine.search(query);

      expect(mockCrossEncoder.rerank).toHaveBeenCalled();
    });

    it('calls graph expansion when enabled', async () => {
      const searchMock = vi.fn().mockReturnValue({
        results: (async function* () { /* empty */ })(),
      });
      (engine as any).searchClient.search = searchMock;

      const query = makeQuery({ enableGraphExpansion: true });
      await engine.search(query);

      expect(mockGraphRetriever.expandViaGraph).toHaveBeenCalled();
    });

    it('skips graph expansion when disabled', async () => {
      const searchMock = vi.fn().mockReturnValue({
        results: (async function* () { /* empty */ })(),
      });
      (engine as any).searchClient.search = searchMock;

      const query = makeQuery({ enableGraphExpansion: false });
      await engine.search(query);

      expect(mockGraphRetriever.expandViaGraph).not.toHaveBeenCalled();
    });

    it('calls rights enforcer with query rights context', async () => {
      const searchMock = vi.fn().mockReturnValue({
        results: (async function* () { /* empty */ })(),
      });
      (engine as any).searchClient.search = searchMock;

      const rightsContext: RightsContext = {
        userId: 'user-42',
        role: 'manager',
        teamIds: ['team-alpha'],
      };
      const query = makeQuery({ rightsContext });
      await engine.search(query);

      expect(mockRightsEnforcer.enforce).toHaveBeenCalledWith(
        expect.any(Array),
        rightsContext,
      );
    });

    it('respects maxResults limit', async () => {
      const searchMock = vi.fn().mockReturnValue({
        results: (async function* () { /* empty */ })(),
      });
      (engine as any).searchClient.search = searchMock;

      // Mock rights enforcer to return many results
      (mockRightsEnforcer.enforce as ReturnType<typeof vi.fn>).mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({
          ...makeRankedPassage({ id: `p-${i}` }),
          attributionText: null,
        })),
      );

      const query = makeQuery({ maxResults: 5 });
      const results = await engine.search(query);

      expect(results).toHaveLength(5);
    });

    it('filters results by rights enforcement', async () => {
      const searchMock = vi.fn().mockReturnValue({
        results: (async function* () { /* empty */ })(),
      });
      (engine as any).searchClient.search = searchMock;

      // Mock rights enforcer to filter out some passages
      (mockRightsEnforcer.enforce as ReturnType<typeof vi.fn>).mockResolvedValue([
        { ...makeRankedPassage({ id: 'allowed' }), attributionText: null },
        // 'blocked' passage is filtered out by rights enforcer
      ]);

      const query = makeQuery({ maxResults: 10 });
      const results = await engine.search(query);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('allowed');
    });
  });

  // ─── Sparse Search Tests ────────────────────────────────────────────────

  describe('sparseSearch', () => {
    it('calls Azure search with text query and filters', async () => {
      const mockResults = (async function* () {
        yield {
          document: {
            id: 'chunk-1',
            content: 'ValueSelling pain discovery',
            framework: 'ValueSelling',
            canonicalFields: ['pain'],
            sourceDocumentId: 'doc-1',
            sourceDocumentTitle: 'ValueSelling Book',
            sourceDocumentAuthor: 'Author',
            sectionTitle: 'Chapter 2',
            pageNumber: 15,
            chunkIndex: 3,
          },
          score: 4.5,
        };
      })();

      const searchMock = vi.fn().mockReturnValue({ results: mockResults });
      (engine as any).searchClient.search = searchMock;

      const filters: SearchFilters = {
        frameworks: ['ValueSelling'],
        userRole: 'rep',
        permittedTeams: ['team-1'],
      };

      const results = await engine.sparseSearch('pain discovery', filters);

      expect(searchMock).toHaveBeenCalledWith('pain discovery', expect.objectContaining({
        queryType: 'simple',
      }));
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('chunk-1');
      expect(results[0].content).toBe('ValueSelling pain discovery');
      expect(results[0].score).toBe(4.5);
    });
  });

  // ─── Dense Search Tests ─────────────────────────────────────────────────

  describe('denseSearch', () => {
    it('calls Azure search with vector query', async () => {
      const mockResults = (async function* () {
        yield {
          document: {
            id: 'vec-1',
            content: 'Vector matched content',
            framework: 'MEDDICC',
            canonicalFields: ['stakeholder'],
            sourceDocumentId: 'doc-2',
            sourceDocumentTitle: 'MEDDICC Guide',
            sectionTitle: 'Champions',
            pageNumber: 42,
            chunkIndex: 7,
          },
          score: 0.92,
        };
      })();

      const searchMock = vi.fn().mockReturnValue({ results: mockResults });
      (engine as any).searchClient.search = searchMock;

      const embedding = new Float32Array(1536).fill(0.5);
      const filters: SearchFilters = {
        frameworks: ['MEDDICC'],
        userRole: 'rep',
        permittedTeams: [],
      };

      const results = await engine.denseSearch(embedding, filters);

      expect(searchMock).toHaveBeenCalledWith('*', expect.objectContaining({
        vectorSearchOptions: expect.objectContaining({
          queries: expect.arrayContaining([
            expect.objectContaining({
              kind: 'vector',
              fields: ['embedding'],
            }),
          ]),
        }),
      }));
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('vec-1');
      expect(results[0].score).toBe(0.92);
    });
  });

  // ─── Index Operations Tests ─────────────────────────────────────────────

  describe('indexChunks', () => {
    it('uploads documents to Azure AI Search', async () => {
      const uploadMock = vi.fn().mockResolvedValue({});
      (engine as any).searchClient.uploadDocuments = uploadMock;

      const chunks = [
        {
          id: 'chunk-1',
          sourceDocumentId: 'doc-1',
          chunkIndex: 0,
          content: 'First chunk content',
          canonicalFields: ['pain'] as any,
          frameworkNativeFields: [],
          sectionTitle: 'Introduction',
          pageNumber: 1,
          version: 1,
        },
      ];

      await engine.indexChunks(chunks);

      expect(uploadMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'chunk-1',
            content: 'First chunk content',
            canonicalFields: ['pain'],
            sourceDocumentId: 'doc-1',
          }),
        ]),
      );
    });

    it('generates embeddings for each chunk during indexing', async () => {
      const uploadMock = vi.fn().mockResolvedValue({});
      (engine as any).searchClient.uploadDocuments = uploadMock;

      const chunks = [
        {
          id: 'c1',
          sourceDocumentId: 'doc-1',
          chunkIndex: 0,
          content: 'Content A',
          canonicalFields: [] as any,
          frameworkNativeFields: [],
          version: 1,
        },
        {
          id: 'c2',
          sourceDocumentId: 'doc-1',
          chunkIndex: 1,
          content: 'Content B',
          canonicalFields: [] as any,
          frameworkNativeFields: [],
          version: 1,
        },
      ];

      await engine.indexChunks(chunks);

      expect(mockEmbeddingProvider).toHaveBeenCalledWith('Content A');
      expect(mockEmbeddingProvider).toHaveBeenCalledWith('Content B');
    });

    it('does nothing for empty chunk array', async () => {
      const uploadMock = vi.fn().mockResolvedValue({});
      (engine as any).searchClient.uploadDocuments = uploadMock;

      await engine.indexChunks([]);

      expect(uploadMock).not.toHaveBeenCalled();
    });
  });

  describe('removeDocument', () => {
    it('finds and deletes all chunks for a document', async () => {
      const mockResults = (async function* () {
        yield { document: { id: 'chunk-1' } };
        yield { document: { id: 'chunk-2' } };
      })();

      const searchMock = vi.fn().mockReturnValue({ results: mockResults });
      const deleteMock = vi.fn().mockResolvedValue({});
      (engine as any).searchClient.search = searchMock;
      (engine as any).searchClient.deleteDocuments = deleteMock;

      await engine.removeDocument('doc-123');

      expect(searchMock).toHaveBeenCalledWith('*', expect.objectContaining({
        filter: expect.stringContaining('doc-123'),
      }));
      expect(deleteMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'chunk-1' }),
          expect.objectContaining({ id: 'chunk-2' }),
        ]),
      );
    });

    it('handles document with no chunks gracefully', async () => {
      const mockResults = (async function* () { /* empty */ })();
      const searchMock = vi.fn().mockReturnValue({ results: mockResults });
      const deleteMock = vi.fn().mockResolvedValue({});
      (engine as any).searchClient.search = searchMock;
      (engine as any).searchClient.deleteDocuments = deleteMock;

      await engine.removeDocument('nonexistent-doc');

      expect(deleteMock).not.toHaveBeenCalled();
    });
  });
});
