// ─── GraphEnrichedRetriever Tests ─────────────────────────────────────────────
// Requirements: 8.3
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphEnrichedRetriever } from './graphEnrichedRetriever.js';
import type {
  RetrievalFunction,
} from './graphEnrichedRetriever.js';
import type { RankedPassage, SearchFilters } from '@ptv-discovery-coach/shared';
import type { GraphExpander, ExpansionResult } from '../graph/GraphExpander.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePassage(overrides: Partial<RankedPassage> = {}): RankedPassage {
  return {
    id: overrides.id ?? `passage-${Math.random().toString(36).slice(2)}`,
    content: overrides.content ?? 'Sample passage content',
    sourceDocument: overrides.sourceDocument ?? {
      id: 'doc-1',
      title: 'Test Document',
      framework: 'ValueSelling',
    },
    framework: overrides.framework ?? 'ValueSelling',
    canonicalFields: overrides.canonicalFields ?? ['pain'],
    score: overrides.score ?? 0.85,
    citation: overrides.citation ?? {
      documentTitle: 'Test Document',
      framework: 'ValueSelling',
      passageId: 'passage-1',
    },
  };
}

function createMockGraphExpander(expansionResult?: Partial<ExpansionResult>): GraphExpander {
  return {
    expand: vi.fn().mockResolvedValue({
      origin: expansionResult?.origin ?? ['pain'],
      relatedConcepts: expansionResult?.relatedConcepts ?? [
        { canonicalField: 'value_metric', relationshipType: 'IMPLIES', depth: 1 },
        { canonicalField: 'stakeholder', relationshipType: 'INFORMS', depth: 2 },
      ],
      frameworkMappings: expansionResult?.frameworkMappings ?? [
        { nativeField: 'ROI', framework: 'ValueSelling', canonicalField: 'value_metric' },
        { nativeField: 'metrics', framework: 'MEDDICC', canonicalField: 'value_metric' },
        { nativeField: 'economic_buyer', framework: 'MEDDICC', canonicalField: 'stakeholder' },
      ],
    }),
    expandFromNativeField: vi.fn(),
    getNativeFieldsForCanonical: vi.fn(),
    getCanonicalFieldsForFramework: vi.fn(),
  } as unknown as GraphExpander;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GraphEnrichedRetriever', () => {
  let mockRetrievalFn: RetrievalFunction;
  let mockGraphExpander: GraphExpander;

  beforeEach(() => {
    mockRetrievalFn = vi.fn().mockResolvedValue([]);
    mockGraphExpander = createMockGraphExpander();
  });

  describe('expandViaGraph', () => {
    it('should skip graph expansion when initial results cover enough canonical fields', async () => {
      // 3 distinct canonical fields covered — meets default threshold of 3
      const passages: RankedPassage[] = [
        makePassage({ canonicalFields: ['pain'] }),
        makePassage({ canonicalFields: ['value_metric'] }),
        makePassage({ canonicalFields: ['stakeholder'] }),
      ];

      const retriever = new GraphEnrichedRetriever(
        mockRetrievalFn,
        mockGraphExpander,
      );

      const result = await retriever.expandViaGraph(passages);

      // Should NOT call GraphExpander since coverage is sufficient
      expect(mockGraphExpander.expand).not.toHaveBeenCalled();
      // All results should have graphExpansionHops = 0
      expect(result).toHaveLength(3);
      expect(result.every((r) => r.graphExpansionHops === 0)).toBe(true);
    });

    it('should trigger graph expansion when initial results have insufficient coverage', async () => {
      // Only 2 distinct canonical fields — below threshold of 3
      const passages: RankedPassage[] = [
        makePassage({ id: 'p1', canonicalFields: ['pain'] }),
        makePassage({ id: 'p2', canonicalFields: ['pain'] }),
      ];

      const expandedPassage = makePassage({
        id: 'expanded-1',
        canonicalFields: ['value_metric'],
        framework: 'MEDDICC',
      });

      mockRetrievalFn = vi.fn().mockResolvedValue([expandedPassage]);

      const retriever = new GraphEnrichedRetriever(
        mockRetrievalFn,
        mockGraphExpander,
      );

      const result = await retriever.expandViaGraph(passages);

      // GraphExpander should have been called
      expect(mockGraphExpander.expand).toHaveBeenCalledWith(['pain'], { maxDepth: 2 });
      // Should include both original and expanded passages
      expect(result.length).toBeGreaterThan(2);
      // Expanded passages should have graphExpansionHops > 0
      const expandedResults = result.filter((r) => r.graphExpansionHops > 0);
      expect(expandedResults.length).toBeGreaterThan(0);
    });

    it('should mark original passages with graphExpansionHops = 0', async () => {
      const passages: RankedPassage[] = [
        makePassage({ id: 'p1', canonicalFields: ['pain'] }),
      ];

      mockRetrievalFn = vi.fn().mockResolvedValue([
        makePassage({ id: 'expanded-1', canonicalFields: ['value_metric'] }),
      ]);

      const retriever = new GraphEnrichedRetriever(
        mockRetrievalFn,
        mockGraphExpander,
      );

      const result = await retriever.expandViaGraph(passages);

      const originals = result.filter((r) => r.id === 'p1');
      expect(originals).toHaveLength(1);
      expect(originals[0].graphExpansionHops).toBe(0);
    });

    it('should mark expanded passages with graphExpansionHops matching depth', async () => {
      const passages: RankedPassage[] = [
        makePassage({ id: 'p1', canonicalFields: ['pain'] }),
      ];

      const expandedPassage = makePassage({
        id: 'expanded-1',
        canonicalFields: ['value_metric'],
      });

      mockRetrievalFn = vi.fn().mockResolvedValue([expandedPassage]);

      // GraphExpander returns concept at depth 1
      mockGraphExpander = createMockGraphExpander({
        origin: ['pain'],
        relatedConcepts: [
          { canonicalField: 'value_metric', relationshipType: 'IMPLIES', depth: 1 },
        ],
        frameworkMappings: [
          { nativeField: 'ROI', framework: 'ValueSelling', canonicalField: 'value_metric' },
        ],
      });

      const retriever = new GraphEnrichedRetriever(
        mockRetrievalFn,
        mockGraphExpander,
      );

      const result = await retriever.expandViaGraph(passages);

      const expanded = result.filter((r) => r.id === 'expanded-1');
      expect(expanded).toHaveLength(1);
      expect(expanded[0].graphExpansionHops).toBe(1);
    });

    it('should deduplicate passages by ID when merging', async () => {
      const sharedPassage = makePassage({ id: 'shared-id', canonicalFields: ['pain'] });
      const passages: RankedPassage[] = [sharedPassage];

      // Retrieval returns the same passage ID
      mockRetrievalFn = vi.fn().mockResolvedValue([
        makePassage({ id: 'shared-id', canonicalFields: ['value_metric'] }),
      ]);

      const retriever = new GraphEnrichedRetriever(
        mockRetrievalFn,
        mockGraphExpander,
      );

      const result = await retriever.expandViaGraph(passages);

      // Should not have duplicate entries
      const idsCount = result.filter((r) => r.id === 'shared-id');
      expect(idsCount).toHaveLength(1);
    });

    it('should not expand when GraphExpander discovers no uncovered concepts', async () => {
      const passages: RankedPassage[] = [
        makePassage({ id: 'p1', canonicalFields: ['pain', 'value_metric'] }),
      ];

      // GraphExpander discovers concepts that are already covered
      mockGraphExpander = createMockGraphExpander({
        origin: ['pain', 'value_metric'],
        relatedConcepts: [
          { canonicalField: 'pain', relationshipType: 'SELF', depth: 1 },
          { canonicalField: 'value_metric', relationshipType: 'SELF', depth: 1 },
        ],
        frameworkMappings: [],
      });

      const retriever = new GraphEnrichedRetriever(
        mockRetrievalFn,
        mockGraphExpander,
        { minCoverageFieldsThreshold: 1 }, // Force expansion to trigger
      );

      const result = await retriever.expandViaGraph(passages);

      // No retrieval should have been called since all concepts are already covered
      expect(mockRetrievalFn).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should respect maxExpandedResults configuration', async () => {
      const passages: RankedPassage[] = [
        makePassage({ id: 'p1', canonicalFields: ['pain'] }),
      ];

      // Return more passages than the max
      mockRetrievalFn = vi.fn().mockResolvedValue([
        makePassage({ id: 'e1', canonicalFields: ['value_metric'] }),
        makePassage({ id: 'e2', canonicalFields: ['value_metric'] }),
        makePassage({ id: 'e3', canonicalFields: ['value_metric'] }),
      ]);

      mockGraphExpander = createMockGraphExpander({
        origin: ['pain'],
        relatedConcepts: [
          { canonicalField: 'value_metric', relationshipType: 'IMPLIES', depth: 1 },
          { canonicalField: 'stakeholder', relationshipType: 'INFORMS', depth: 2 },
        ],
        frameworkMappings: [
          { nativeField: 'ROI', framework: 'ValueSelling', canonicalField: 'value_metric' },
        ],
      });

      const retriever = new GraphEnrichedRetriever(
        mockRetrievalFn,
        mockGraphExpander,
        { maxExpandedResults: 2 },
      );

      const result = await retriever.expandViaGraph(passages);

      // Should have at most 1 original + 2 expanded
      const expandedCount = result.filter((r) => r.graphExpansionHops > 0).length;
      expect(expandedCount).toBeLessThanOrEqual(2);
    });

    it('should use configurable minCoverageFieldsThreshold', async () => {
      // 3 fields covered, but threshold set to 5
      const passages: RankedPassage[] = [
        makePassage({ canonicalFields: ['pain'] }),
        makePassage({ canonicalFields: ['value_metric'] }),
        makePassage({ canonicalFields: ['stakeholder'] }),
      ];

      mockRetrievalFn = vi.fn().mockResolvedValue([
        makePassage({ id: 'expanded-1', canonicalFields: ['decision_criteria'] }),
      ]);

      // Override mock to return concepts NOT already covered
      mockGraphExpander = createMockGraphExpander({
        origin: ['pain', 'value_metric', 'stakeholder'],
        relatedConcepts: [
          { canonicalField: 'decision_criteria', relationshipType: 'INFORMS', depth: 1 },
          { canonicalField: 'story', relationshipType: 'RELATES_TO', depth: 2 },
        ],
        frameworkMappings: [
          { nativeField: 'decision_process', framework: 'MEDDICC', canonicalField: 'decision_criteria' },
        ],
      });

      const retriever = new GraphEnrichedRetriever(
        mockRetrievalFn,
        mockGraphExpander,
        { minCoverageFieldsThreshold: 5 },
      );

      const result = await retriever.expandViaGraph(passages);

      // Graph expansion should trigger because 3 < 5
      expect(mockGraphExpander.expand).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(3);
    });

    it('should use configurable maxDepth for graph traversal', async () => {
      const passages: RankedPassage[] = [
        makePassage({ id: 'p1', canonicalFields: ['pain'] }),
      ];

      mockRetrievalFn = vi.fn().mockResolvedValue([]);

      const retriever = new GraphEnrichedRetriever(
        mockRetrievalFn,
        mockGraphExpander,
        { maxDepth: 1 },
      );

      await retriever.expandViaGraph(passages);

      expect(mockGraphExpander.expand).toHaveBeenCalledWith(['pain'], { maxDepth: 1 });
    });

    it('should pass filters to the retrieval function', async () => {
      const passages: RankedPassage[] = [
        makePassage({ id: 'p1', canonicalFields: ['pain'] }),
      ];

      mockRetrievalFn = vi.fn().mockResolvedValue([]);

      const filters: SearchFilters = {
        frameworks: ['ValueSelling', 'MEDDICC'],
        userRole: 'rep',
        permittedTeams: ['team-1'],
      };

      const retriever = new GraphEnrichedRetriever(
        mockRetrievalFn,
        mockGraphExpander,
      );

      await retriever.expandViaGraph(passages, filters);

      // Retrieval function should be called with filters including the target canonical field
      expect(mockRetrievalFn).toHaveBeenCalled();
      const callArgs = (mockRetrievalFn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[1]).toMatchObject({
        userRole: 'rep',
        permittedTeams: ['team-1'],
      });
    });

    it('should include expansionPath on expanded results', async () => {
      const passages: RankedPassage[] = [
        makePassage({ id: 'p1', canonicalFields: ['pain'] }),
      ];

      mockRetrievalFn = vi.fn().mockResolvedValue([
        makePassage({ id: 'expanded-1', canonicalFields: ['value_metric'] }),
      ]);

      mockGraphExpander = createMockGraphExpander({
        origin: ['pain'],
        relatedConcepts: [
          { canonicalField: 'value_metric', relationshipType: 'IMPLIES', depth: 1 },
        ],
        frameworkMappings: [
          { nativeField: 'ROI', framework: 'ValueSelling', canonicalField: 'value_metric' },
        ],
      });

      const retriever = new GraphEnrichedRetriever(
        mockRetrievalFn,
        mockGraphExpander,
      );

      const result = await retriever.expandViaGraph(passages);

      const expanded = result.find((r) => r.id === 'expanded-1');
      expect(expanded).toBeDefined();
      expect(expanded!.expansionPath).toContain('pain');
      expect(expanded!.expansionPath).toContain('IMPLIES');
      expect(expanded!.expansionPath).toContain('value_metric');
    });

    it('should handle empty initial passages gracefully', async () => {
      const retriever = new GraphEnrichedRetriever(
        mockRetrievalFn,
        mockGraphExpander,
      );

      const result = await retriever.expandViaGraph([]);

      // Empty coverage → should trigger expansion
      expect(mockGraphExpander.expand).toHaveBeenCalledWith([], { maxDepth: 2 });
      expect(result).toEqual([]);
    });

    it('should continue when retrieval fails for one concept', async () => {
      const passages: RankedPassage[] = [
        makePassage({ id: 'p1', canonicalFields: ['pain'] }),
      ];

      // First call fails, second succeeds
      let callCount = 0;
      mockRetrievalFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Search service unavailable'));
        }
        return Promise.resolve([
          makePassage({ id: 'expanded-2', canonicalFields: ['stakeholder'] }),
        ]);
      });

      mockGraphExpander = createMockGraphExpander({
        origin: ['pain'],
        relatedConcepts: [
          { canonicalField: 'value_metric', relationshipType: 'IMPLIES', depth: 1 },
          { canonicalField: 'stakeholder', relationshipType: 'INFORMS', depth: 2 },
        ],
        frameworkMappings: [
          { nativeField: 'ROI', framework: 'ValueSelling', canonicalField: 'value_metric' },
          { nativeField: 'economic_buyer', framework: 'MEDDICC', canonicalField: 'stakeholder' },
        ],
      });

      const retriever = new GraphEnrichedRetriever(
        mockRetrievalFn,
        mockGraphExpander,
      );

      const result = await retriever.expandViaGraph(passages);

      // Should still include the successful expansion
      const expanded = result.filter((r) => r.graphExpansionHops > 0);
      expect(expanded.length).toBeGreaterThanOrEqual(1);
    });

    it('should prioritize closer concepts (lower depth) first', async () => {
      const passages: RankedPassage[] = [
        makePassage({ id: 'p1', canonicalFields: ['pain'] }),
      ];

      const callOrder: string[] = [];
      mockRetrievalFn = vi.fn().mockImplementation((query: string) => {
        callOrder.push(query);
        return Promise.resolve([]);
      });

      mockGraphExpander = createMockGraphExpander({
        origin: ['pain'],
        relatedConcepts: [
          { canonicalField: 'stakeholder', relationshipType: 'INFORMS', depth: 2 },
          { canonicalField: 'value_metric', relationshipType: 'IMPLIES', depth: 1 },
        ],
        frameworkMappings: [],
      });

      const retriever = new GraphEnrichedRetriever(
        mockRetrievalFn,
        mockGraphExpander,
      );

      await retriever.expandViaGraph(passages);

      // value_metric (depth 1) should be queried before stakeholder (depth 2)
      expect(callOrder.length).toBe(2);
      expect(callOrder[0]).toContain('value');
      expect(callOrder[1]).toContain('stakeholder');
    });
  });
});
