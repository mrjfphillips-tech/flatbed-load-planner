// ─── Neo4j Graph Schema Initialization ───────────────────────────────────────
// Creates constraints, indexes, and node/relationship structures for the
// Canonical Ontology graph.
// Requirements: 7.1, 7.2, 7.3, 7.5, 7.6

import { getSession } from './neo4jClient.js';

/**
 * Initialize the Neo4j graph schema with constraints and indexes.
 * Idempotent — safe to run multiple times.
 */
export async function initializeGraphSchema(): Promise<void> {
  const session = getSession();

  try {
    // ── Constraints ──────────────────────────────────────────────────────────
    // Unique constraint on CanonicalField.name
    await session.run(`
      CREATE CONSTRAINT canonical_field_name IF NOT EXISTS
      FOR (n:CanonicalField) REQUIRE n.name IS UNIQUE
    `);

    // Unique constraint on Framework.name
    await session.run(`
      CREATE CONSTRAINT framework_name IF NOT EXISTS
      FOR (n:Framework) REQUIRE n.name IS UNIQUE
    `);

    // Unique constraint on FrameworkNativeField (composite: name + framework)
    // Neo4j Community doesn't support composite constraints, so we use a
    // compound property for uniqueness
    await session.run(`
      CREATE CONSTRAINT framework_native_field_key IF NOT EXISTS
      FOR (n:FrameworkNativeField) REQUIRE n.key IS UNIQUE
    `);

    // ── Indexes ──────────────────────────────────────────────────────────────
    // Index on FrameworkNativeField.framework for efficient lookups
    await session.run(`
      CREATE INDEX framework_native_field_framework IF NOT EXISTS
      FOR (n:FrameworkNativeField) ON (n.framework)
    `);

    // Index on FrameworkNativeField.name for lookups by field name
    await session.run(`
      CREATE INDEX framework_native_field_name IF NOT EXISTS
      FOR (n:FrameworkNativeField) ON (n.name)
    `);

    // Index on CrosswalkMapping relationship properties (via FrameworkNativeField)
    await session.run(`
      CREATE INDEX canonical_field_name_idx IF NOT EXISTS
      FOR (n:CanonicalField) ON (n.name)
    `);

    console.log('✓ Neo4j graph schema initialized successfully');
  } finally {
    await session.close();
  }
}

/**
 * Drop all nodes and relationships (for development reset).
 * WARNING: Destructive operation.
 */
export async function resetGraphSchema(): Promise<void> {
  const session = getSession();
  try {
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('✓ Neo4j graph data cleared');
  } finally {
    await session.close();
  }
}
