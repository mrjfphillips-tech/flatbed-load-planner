// ─── Graph Expander Utility ───────────────────────────────────────────────────
// Performs multi-hop traversal over the Canonical Ontology graph to discover
// related concepts across framework boundaries.
// Requirements: 7.5, 7.6, 8.3

import { getSession } from './neo4jClient.js';
import type { Framework, CanonicalField } from '@ptv-discovery-coach/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExpandedNode {
  /** The canonical field name */
  canonicalField: CanonicalField;
  /** Relationship type that connects to this node */
  relationshipType: string;
  /** How many hops away from the origin */
  depth: number;
}

export interface FrameworkMapping {
  /** Framework-native field name */
  nativeField: string;
  /** Framework the native field belongs to */
  framework: Framework;
  /** The canonical field it maps to */
  canonicalField: CanonicalField;
}

export interface ExpansionResult {
  /** Starting canonical field(s) */
  origin: CanonicalField[];
  /** Related canonical fields discovered via graph traversal */
  relatedConcepts: ExpandedNode[];
  /** All framework-native fields that map to the discovered canonical fields */
  frameworkMappings: FrameworkMapping[];
}

export interface ExpansionOptions {
  /** Maximum traversal depth (default: 2) */
  maxDepth?: number;
  /** Limit results to specific frameworks (default: all) */
  frameworks?: Framework[];
  /** Relationship types to traverse (default: all RELATES_TO) */
  relationshipTypes?: string[];
}

// ─── GraphExpander Class ──────────────────────────────────────────────────────

/**
 * GraphExpander performs multi-hop traversal over the Canonical Ontology
 * graph in Neo4j to discover related concepts across framework boundaries.
 *
 * Used by the Retrieval Engine (Task 4.3) to enrich search results with
 * cross-framework related passages when initial retrieval lacks coverage.
 */
export class GraphExpander {
  private readonly defaultMaxDepth = 2;

  /**
   * Expand from one or more canonical fields, discovering related concepts
   * up to the configured depth. Returns related canonical fields and all
   * framework-native fields that map to them.
   */
  async expand(
    startFields: CanonicalField[],
    options: ExpansionOptions = {}
  ): Promise<ExpansionResult> {
    const maxDepth = options.maxDepth ?? this.defaultMaxDepth;
    const session = getSession();

    try {
      // Step 1: Multi-hop traversal to find related canonical fields
      const relatedConcepts = await this.traverseRelationships(
        session,
        startFields,
        maxDepth,
        options.relationshipTypes
      );

      // Step 2: Find all framework-native fields that map to expanded set
      const allCanonicalFields = [
        ...startFields,
        ...relatedConcepts.map((r) => r.canonicalField),
      ];
      const frameworkMappings = await this.getFrameworkMappings(
        session,
        allCanonicalFields,
        options.frameworks
      );

      return {
        origin: startFields,
        relatedConcepts,
        frameworkMappings,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get all canonical fields reachable from a given framework-native field,
   * traversing MAPS_TO and then RELATES_TO edges.
   */
  async expandFromNativeField(
    nativeField: string,
    framework: Framework,
    options: ExpansionOptions = {}
  ): Promise<ExpansionResult> {
    const maxDepth = options.maxDepth ?? this.defaultMaxDepth;
    const session = getSession();

    try {
      // First, find which canonical field the native field maps to
      const mappingResult = await session.run(
        `MATCH (nf:FrameworkNativeField {key: $key})-[:MAPS_TO]->(c:CanonicalField)
         RETURN c.name AS canonicalField`,
        { key: `${framework}:${nativeField}` }
      );

      const startFields = mappingResult.records.map(
        (r) => r.get('canonicalField') as CanonicalField
      );

      if (startFields.length === 0) {
        return { origin: [], relatedConcepts: [], frameworkMappings: [] };
      }

      // Then traverse from those canonical fields
      const relatedConcepts = await this.traverseRelationships(
        session,
        startFields,
        maxDepth,
        options.relationshipTypes
      );

      const allCanonicalFields = [
        ...startFields,
        ...relatedConcepts.map((r) => r.canonicalField),
      ];
      const frameworkMappings = await this.getFrameworkMappings(
        session,
        allCanonicalFields,
        options.frameworks
      );

      return {
        origin: startFields,
        relatedConcepts,
        frameworkMappings,
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Get all framework-native fields that map to a specific canonical field.
   */
  async getNativeFieldsForCanonical(
    canonicalField: CanonicalField,
    frameworks?: Framework[]
  ): Promise<FrameworkMapping[]> {
    const session = getSession();

    try {
      let query: string;
      let params: Record<string, unknown>;

      if (frameworks && frameworks.length > 0) {
        query = `
          MATCH (nf:FrameworkNativeField)-[:MAPS_TO]->(c:CanonicalField {name: $canonicalField})
          WHERE nf.framework IN $frameworks
          RETURN nf.name AS nativeField, nf.framework AS framework, c.name AS canonicalField
        `;
        params = { canonicalField, frameworks };
      } else {
        query = `
          MATCH (nf:FrameworkNativeField)-[:MAPS_TO]->(c:CanonicalField {name: $canonicalField})
          RETURN nf.name AS nativeField, nf.framework AS framework, c.name AS canonicalField
        `;
        params = { canonicalField };
      }

      const result = await session.run(query, params);
      return result.records.map((r) => ({
        nativeField: r.get('nativeField') as string,
        framework: r.get('framework') as Framework,
        canonicalField: r.get('canonicalField') as CanonicalField,
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * Find all canonical fields connected to a framework (via its native fields).
   */
  async getCanonicalFieldsForFramework(framework: Framework): Promise<CanonicalField[]> {
    const session = getSession();

    try {
      const result = await session.run(
        `MATCH (nf:FrameworkNativeField {framework: $framework})-[:MAPS_TO]->(c:CanonicalField)
         RETURN DISTINCT c.name AS canonicalField`,
        { framework }
      );
      return result.records.map((r) => r.get('canonicalField') as CanonicalField);
    } finally {
      await session.close();
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async traverseRelationships(
    session: import('neo4j-driver').Session,
    startFields: CanonicalField[],
    maxDepth: number,
    relationshipTypes?: string[]
  ): Promise<ExpandedNode[]> {
    const result = await session.run(
      `MATCH (start:CanonicalField)
       WHERE start.name IN $startFields
       MATCH path = (start)-[:RELATES_TO*1..${maxDepth}]->(related:CanonicalField)
       WHERE NOT related.name IN $startFields
       WITH related, relationships(path) AS rels, length(path) AS depth
       UNWIND rels AS rel
       WITH related, depth, rel
       ORDER BY depth
       RETURN DISTINCT related.name AS canonicalField, 
              rel.type AS relationshipType,
              depth`,
      { startFields, maxDepth: neo4jInt(maxDepth) }
    );

    // Deduplicate by canonical field, keeping the shortest path
    const seen = new Set<string>();
    const nodes: ExpandedNode[] = [];

    for (const record of result.records) {
      const field = record.get('canonicalField') as CanonicalField;
      if (!seen.has(field)) {
        seen.add(field);
        const depth = typeof record.get('depth') === 'object'
          ? (record.get('depth') as { toNumber(): number }).toNumber()
          : record.get('depth') as number;
        nodes.push({
          canonicalField: field,
          relationshipType: record.get('relationshipType') as string,
          depth,
        });
      }
    }

    // If relationship type filtering was requested, apply it
    if (relationshipTypes && relationshipTypes.length > 0) {
      return nodes.filter((n) => relationshipTypes.includes(n.relationshipType));
    }

    return nodes;
  }

  private async getFrameworkMappings(
    session: import('neo4j-driver').Session,
    canonicalFields: CanonicalField[],
    frameworks?: Framework[]
  ): Promise<FrameworkMapping[]> {
    let query: string;
    let params: Record<string, unknown>;

    if (frameworks && frameworks.length > 0) {
      query = `
        MATCH (nf:FrameworkNativeField)-[:MAPS_TO]->(c:CanonicalField)
        WHERE c.name IN $canonicalFields AND nf.framework IN $frameworks
        RETURN nf.name AS nativeField, nf.framework AS framework, c.name AS canonicalField
      `;
      params = { canonicalFields, frameworks };
    } else {
      query = `
        MATCH (nf:FrameworkNativeField)-[:MAPS_TO]->(c:CanonicalField)
        WHERE c.name IN $canonicalFields
        RETURN nf.name AS nativeField, nf.framework AS framework, c.name AS canonicalField
      `;
      params = { canonicalFields };
    }

    const result = await session.run(query, params);
    return result.records.map((r) => ({
      nativeField: r.get('nativeField') as string,
      framework: r.get('framework') as Framework,
      canonicalField: r.get('canonicalField') as CanonicalField,
    }));
  }
}

/** Helper to convert number to Neo4j integer when needed */
function neo4jInt(value: number): number {
  return value;
}
