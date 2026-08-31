// ─── Retrieval Types ──────────────────────────────────────────────────────────
// Requirements: 7.1, 7.2, 7.3

import type { CanonicalField, Framework, UserRole } from './framework';

/**
 * Query submitted to the hybrid retrieval engine.
 */
export interface RetrievalQuery {
  text: string;
  frameworks: Framework[];
  canonicalFields?: CanonicalField[];
  userRole: UserRole;
  rightsContext: RightsContext;
  maxResults: number;
  enableGraphExpansion: boolean;
}

/**
 * User rights context for access control during retrieval.
 */
export interface RightsContext {
  userId: string;
  role: UserRole;
  teamIds: string[];
}

/**
 * A ranked passage result from hybrid retrieval.
 */
export interface RankedPassage {
  id: string;
  content: string;
  sourceDocument: SourceDocumentRef;
  framework: Framework;
  canonicalFields: CanonicalField[];
  score: number;
  citation: Citation;
}

/**
 * Reference to a source document (lightweight).
 */
export interface SourceDocumentRef {
  id: string;
  title: string;
  author?: string;
  framework: Framework;
}

/**
 * Citation reference linking a claim to a specific source passage.
 */
export interface CitationReference {
  documentTitle: string;
  framework: Framework;
  sectionTitle?: string;
  pageNumber?: number;
  passageId: string;
  chunkIndex?: number;
}

/**
 * Inline citation displayed alongside coaching guidance.
 */
export interface Citation {
  documentTitle: string;
  framework: Framework;
  sectionTitle?: string;
  pageNumber?: number;
  passageId: string;
}

/**
 * A document with a relevance score from retrieval.
 */
export interface ScoredDocument {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

/**
 * Filters applied during retrieval search.
 */
export interface SearchFilters {
  frameworks?: Framework[];
  canonicalFields?: CanonicalField[];
  userRole: UserRole;
  permittedTeams: string[];
}
