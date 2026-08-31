// ─── Graph-Enriched Retriever ─────────────────────────────────────────────────
// Integrates the GraphExpander into the retrieval pipeline to perform multi-hop
// traversal across framework boundaries and enrich results with cross-framework
// related passages.
// Requirements: 8.3

import type { RankedPassage, SearchFilters } from '@ptv-discovery-coach/shared';
import type { CanonicalField, Framework } from '@ptv-discovery-coach/shared';
import { GraphExpander } from '../graph/GraphExpander.js';
import type { ExpansionResult } from '../graph/GraphExpander.js';

// ─── Configuration ────────────────────────────────────────────────────────────

export interface GraphEnrichedRetrieverConfig {
  /**
   * Minimum number of distinct canonical fields that must be covered
   * by the initial results before graph expansion is skipped.
   * Default: 3
   */
  minCoverageFieldsThreshold: number;

  /**
   * Maximum graph traversal depth for discovering related concepts.
   * Default: 2
   */
  maxDepth: number;

  /**
   * Maximum number of additional passages to add via graph expansion.
   * Default: 10
   */
  maxExpandedResults: number;
}

const DEFAULT_CONFIG: GraphEnrichedRetrieverConfig = {
  minCoverageFieldsThreshold: 3,
  maxDepth: 2,
  maxExpandedResults: 10,
};

// ─── Extended RankedPassage with graph metadata ───────────────────────────────

export interface GraphEnrichedPassage extends RankedPassage {
  /** Number of hops from the original query context. 0 = direct result. */
  graphExpansionHops: number;
  /** The relationship path that led to this passage being discovered. */
  expansionPath?: string;
}

// ─── Retrieval Function Type ──────────────────────────────────────────────────

/**
 * A function that performs retrieval given a query text and filters.
 * This abstracts over the actual search implementation (Azure AI Search, etc.)
 * so that the GraphEnrichedRetriever can request additional passages.
 */
export type RetrievalFunction = (
  query: string,
  filters: SearchFilters,
  maxResults: number,
) => Promise<RankedPassage[]>;

// ─── GraphEnrichedRetriever Class ─────────────────────────────────────────────

/**
 * GraphEnrichedRetriever enriches initial retrieval results by leveraging the
 * Canonical Ontology graph to discover related concepts across framework
 * boundaries. It implements the `expandViaGraph()` step of the
 * HybridSearchPipeline interface.
 *
 * Flow:
 * 1. Takes initial retrieval results (after cross-encoder reranking)
 * 2. Identifies which canonical fields are covered by the initial results
 * 3. Determines if coverage is insufficient (fewer than threshold distinct fields)
 * 4. Uses GraphExpander to discover related concepts NOT yet covered
 * 5. Performs additional retrieval queries for the discovered related concepts
 * 6. Merges additional results with originals, marking expanded results
 */
export class GraphEnrichedRetriever {
  private readonly graphExpander: GraphExpander;
  private readonly config: GraphEnrichedRetrieverConfig;
  private readonly retrievalFn: RetrievalFunction;

  constructor(
    retrievalFn: RetrievalFunction,
    graphExpander?: GraphExpander,
    config?: Partial<GraphEnrichedRetrieverConfig>,
  ) {
    this.retrievalFn = retrievalFn;
    this.graphExpander = graphExpander ?? new GraphExpander();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Implements HybridSearchPipeline.expandViaGraph()
   *
   * Enriches the given passages with graph-expanded results when initial
   * coverage is insufficient.
   */
  async expandViaGraph(
    passages: RankedPassage[],
    filters?: SearchFilters,
  ): Promise<GraphEnrichedPassage[]> {
    // Tag original passages with graphExpansionHops = 0
    const enrichedOriginals: GraphEnrichedPassage[] = passages.map((p) => ({
      ...p,
      graphExpansionHops: 0,
    }));

    // Step 1: Identify canonical fields covered by initial results
    const coveredFields = this.extractCoveredCanonicalFields(passages);

    // Step 2: Check if coverage is sufficient — skip expansion if enough fields covered
    if (coveredFields.size >= this.config.minCoverageFieldsThreshold) {
      return enrichedOriginals;
    }

    // Step 3: Use GraphExpander to discover related concepts not yet covered
    const coveredArray = Array.from(coveredFields) as CanonicalField[];
    const expansionResult = await this.graphExpander.expand(coveredArray, {
      maxDepth: this.config.maxDepth,
    });

    // Step 4: Filter to only concepts NOT already covered
    const uncoveredRelated = expansionResult.relatedConcepts.filter(
      (concept) => !coveredFields.has(concept.canonicalField),
    );

    if (uncoveredRelated.length === 0) {
      return enrichedOriginals;
    }

    // Step 5: Perform additional retrieval for discovered related concepts
    const additionalPassages = await this.retrieveForExpandedConcepts(
      uncoveredRelated,
      expansionResult,
      filters,
    );

    // Step 6: Merge and deduplicate
    const merged = this.mergeResults(enrichedOriginals, additionalPassages);

    return merged;
  }

  /**
   * Extract all unique canonical fields covered by the given passages.
   */
  private extractCoveredCanonicalFields(passages: RankedPassage[]): Set<string> {
    const fields = new Set<string>();
    for (const passage of passages) {
      if (passage.canonicalFields) {
        for (const field of passage.canonicalFields) {
          fields.add(field);
        }
      }
    }
    return fields;
  }

  /**
   * Perform additional retrieval queries for the discovered related concepts.
   * Groups concepts by canonical field and queries for each.
   */
  private async retrieveForExpandedConcepts(
    uncoveredRelated: { canonicalField: CanonicalField; relationshipType: string; depth: number }[],
    expansionResult: ExpansionResult,
    filters?: SearchFilters,
  ): Promise<GraphEnrichedPassage[]> {
    const additionalPassages: GraphEnrichedPassage[] = [];
    const remainingSlots = this.config.maxExpandedResults;

    // Build retrieval queries for each uncovered canonical field
    // Prioritize by depth (closer concepts first)
    const sortedConcepts = [...uncoveredRelated].sort((a, b) => a.depth - b.depth);

    // Determine frameworks associated with discovered concepts
    const frameworksForConcepts = new Map<string, Framework[]>();
    for (const mapping of expansionResult.frameworkMappings) {
      const existing = frameworksForConcepts.get(mapping.canonicalField) ?? [];
      if (!existing.includes(mapping.framework)) {
        existing.push(mapping.framework);
      }
      frameworksForConcepts.set(mapping.canonicalField, existing);
    }

    // Execute retrieval for each uncovered concept
    let slotsRemaining = remainingSlots;
    for (const concept of sortedConcepts) {
      if (slotsRemaining <= 0) break;

      const perConceptMax = Math.min(3, slotsRemaining);
      const queryText = this.buildExpansionQuery(concept.canonicalField, concept.relationshipType);
      const conceptFrameworks = frameworksForConcepts.get(concept.canonicalField);

      const searchFilters: SearchFilters = filters
        ? {
            ...filters,
            canonicalFields: [concept.canonicalField],
            frameworks: conceptFrameworks ?? filters.frameworks,
          }
        : {
            canonicalFields: [concept.canonicalField],
            frameworks: conceptFrameworks,
            userRole: 'rep',
            permittedTeams: [],
          };

      try {
        const results = await this.retrievalFn(queryText, searchFilters, perConceptMax);

        for (const result of results) {
          additionalPassages.push({
            ...result,
            graphExpansionHops: concept.depth,
            expansionPath: `${expansionResult.origin.join(',')} -[${concept.relationshipType}]-> ${concept.canonicalField}`,
          });
          slotsRemaining--;
          if (slotsRemaining <= 0) break;
        }
      } catch {
        // If retrieval fails for a concept, continue with others
        continue;
      }
    }

    return additionalPassages;
  }

  /**
   * Build a natural-language query for retrieving passages about a canonical concept.
   */
  private buildExpansionQuery(canonicalField: CanonicalField, relationshipType: string): string {
    const fieldDescriptions: Record<CanonicalField, string> = {
      pain: 'customer pain points, challenges, and problems',
      value_metric: 'value metrics, ROI, KPIs, and measurable business impact',
      stakeholder: 'stakeholders, decision makers, and organizational influence',
      decision_criteria: 'decision criteria, evaluation factors, and purchase requirements',
      story: 'customer stories, use cases, and proof narratives',
      demo_proof: 'demonstration proof points, product capabilities, and solution validation',
      next_step_commitment: 'next steps, commitments, and action items',
    };

    const description = fieldDescriptions[canonicalField] ?? canonicalField;
    return `${description} related through ${relationshipType}`;
  }

  /**
   * Merge original results with graph-expanded results, deduplicating by passage ID.
   * Original results always take priority (appear first).
   */
  private mergeResults(
    originals: GraphEnrichedPassage[],
    expanded: GraphEnrichedPassage[],
  ): GraphEnrichedPassage[] {
    const seenIds = new Set(originals.map((p) => p.id));
    const merged = [...originals];

    for (const passage of expanded) {
      if (!seenIds.has(passage.id)) {
        seenIds.add(passage.id);
        merged.push(passage);
      }
    }

    return merged;
  }
}
