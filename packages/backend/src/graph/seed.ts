// ─── Neo4j Graph Seed Data ────────────────────────────────────────────────────
// Seeds the Canonical Ontology graph with canonical fields, frameworks,
// framework-native fields, and crosswalk mappings.
// Requirements: 7.1, 7.2, 7.3, 7.5, 7.6

import { getSession } from './neo4jClient.js';
import type { Framework, CanonicalField } from '@ptv-discovery-coach/shared';

// ─── Canonical Fields ─────────────────────────────────────────────────────────

const CANONICAL_FIELDS: CanonicalField[] = [
  'pain',
  'value_metric',
  'stakeholder',
  'decision_criteria',
  'story',
  'demo_proof',
  'next_step_commitment',
];

// ─── Frameworks ───────────────────────────────────────────────────────────────

const FRAMEWORKS: Framework[] = [
  'ValueSelling',
  'MEDDICC',
  'RAIN',
  'Challenger',
  'SevenStories',
  'GreatDemo',
  'SaaSBackwards',
];

// ─── Framework-Native Fields per Framework ────────────────────────────────────
// As defined in Requirement 7.2

export interface NativeFieldDef {
  name: string;
  framework: Framework;
}

const FRAMEWORK_NATIVE_FIELDS: NativeFieldDef[] = [
  // ValueSelling
  { name: 'pain', framework: 'ValueSelling' },
  { name: 'baseline', framework: 'ValueSelling' },
  { name: 'KPI', framework: 'ValueSelling' },
  { name: 'ROI', framework: 'ValueSelling' },
  { name: 'value_hypothesis', framework: 'ValueSelling' },
  // MEDDICC
  { name: 'metrics', framework: 'MEDDICC' },
  { name: 'economic_buyer', framework: 'MEDDICC' },
  { name: 'decision_criteria', framework: 'MEDDICC' },
  { name: 'decision_process', framework: 'MEDDICC' },
  { name: 'pain', framework: 'MEDDICC' },
  { name: 'champion', framework: 'MEDDICC' },
  { name: 'competition', framework: 'MEDDICC' },
  // RAIN
  { name: 'discovery_question', framework: 'RAIN' },
  { name: 'insight_prompt', framework: 'RAIN' },
  { name: 'listening_cue', framework: 'RAIN' },
  { name: 'next_step_ask', framework: 'RAIN' },
  // Challenger
  { name: 'commercial_insight', framework: 'Challenger' },
  { name: 'tailored_message', framework: 'Challenger' },
  { name: 'tension_trigger', framework: 'Challenger' },
  { name: 'commitment_ask', framework: 'Challenger' },
  // Seven Stories
  { name: 'story_type', framework: 'SevenStories' },
  { name: 'use_case', framework: 'SevenStories' },
  { name: 'values_proof', framework: 'SevenStories' },
  { name: 'negotiation_story', framework: 'SevenStories' },
  // Great Demo!
  { name: 'illustration', framework: 'GreatDemo' },
  { name: 'menu_item', framework: 'GreatDemo' },
  { name: 'last_thing_first', framework: 'GreatDemo' },
  { name: 'peel_back_layer', framework: 'GreatDemo' },
  // SaaS Backwards
  { name: 'desired_decision', framework: 'SaaSBackwards' },
  { name: 'must_believe_statements', framework: 'SaaSBackwards' },
  { name: 'proof_sequence', framework: 'SaaSBackwards' },
];

// ─── Crosswalk Mappings (MAPS_TO relationships) ──────────────────────────────
// Each entry links a framework-native field to a canonical field

export interface CrosswalkDef {
  framework: Framework;
  nativeField: string;
  canonicalField: CanonicalField;
}

const CROSSWALK_MAPPINGS: CrosswalkDef[] = [
  // ValueSelling → Canonical
  { framework: 'ValueSelling', nativeField: 'pain', canonicalField: 'pain' },
  { framework: 'ValueSelling', nativeField: 'baseline', canonicalField: 'value_metric' },
  { framework: 'ValueSelling', nativeField: 'KPI', canonicalField: 'value_metric' },
  { framework: 'ValueSelling', nativeField: 'ROI', canonicalField: 'value_metric' },
  { framework: 'ValueSelling', nativeField: 'value_hypothesis', canonicalField: 'value_metric' },

  // MEDDICC → Canonical
  { framework: 'MEDDICC', nativeField: 'metrics', canonicalField: 'value_metric' },
  { framework: 'MEDDICC', nativeField: 'economic_buyer', canonicalField: 'stakeholder' },
  { framework: 'MEDDICC', nativeField: 'decision_criteria', canonicalField: 'decision_criteria' },
  { framework: 'MEDDICC', nativeField: 'decision_process', canonicalField: 'decision_criteria' },
  { framework: 'MEDDICC', nativeField: 'pain', canonicalField: 'pain' },
  { framework: 'MEDDICC', nativeField: 'champion', canonicalField: 'stakeholder' },
  { framework: 'MEDDICC', nativeField: 'competition', canonicalField: 'decision_criteria' },

  // RAIN → Canonical
  { framework: 'RAIN', nativeField: 'discovery_question', canonicalField: 'pain' },
  { framework: 'RAIN', nativeField: 'insight_prompt', canonicalField: 'value_metric' },
  { framework: 'RAIN', nativeField: 'listening_cue', canonicalField: 'pain' },
  { framework: 'RAIN', nativeField: 'next_step_ask', canonicalField: 'next_step_commitment' },

  // Challenger → Canonical
  { framework: 'Challenger', nativeField: 'commercial_insight', canonicalField: 'value_metric' },
  { framework: 'Challenger', nativeField: 'tailored_message', canonicalField: 'story' },
  { framework: 'Challenger', nativeField: 'tension_trigger', canonicalField: 'pain' },
  { framework: 'Challenger', nativeField: 'commitment_ask', canonicalField: 'next_step_commitment' },

  // Seven Stories → Canonical
  { framework: 'SevenStories', nativeField: 'story_type', canonicalField: 'story' },
  { framework: 'SevenStories', nativeField: 'use_case', canonicalField: 'demo_proof' },
  { framework: 'SevenStories', nativeField: 'values_proof', canonicalField: 'story' },
  { framework: 'SevenStories', nativeField: 'negotiation_story', canonicalField: 'story' },

  // Great Demo! → Canonical
  { framework: 'GreatDemo', nativeField: 'illustration', canonicalField: 'demo_proof' },
  { framework: 'GreatDemo', nativeField: 'menu_item', canonicalField: 'demo_proof' },
  { framework: 'GreatDemo', nativeField: 'last_thing_first', canonicalField: 'demo_proof' },
  { framework: 'GreatDemo', nativeField: 'peel_back_layer', canonicalField: 'demo_proof' },

  // SaaS Backwards → Canonical
  { framework: 'SaaSBackwards', nativeField: 'desired_decision', canonicalField: 'decision_criteria' },
  { framework: 'SaaSBackwards', nativeField: 'must_believe_statements', canonicalField: 'value_metric' },
  { framework: 'SaaSBackwards', nativeField: 'proof_sequence', canonicalField: 'demo_proof' },
];

// ─── Concept Relationships (RELATES_TO) ──────────────────────────────────────
// Edges between canonical fields expressing semantic implications

interface ConceptRelation {
  from: CanonicalField;
  to: CanonicalField;
  type: string;
}

const CONCEPT_RELATIONS: ConceptRelation[] = [
  { from: 'pain', to: 'value_metric', type: 'IMPLIES' },
  { from: 'stakeholder', to: 'decision_criteria', type: 'INFORMS' },
  { from: 'decision_criteria', to: 'demo_proof', type: 'REQUIRES' },
  { from: 'demo_proof', to: 'story', type: 'SUPPORTS' },
  { from: 'value_metric', to: 'next_step_commitment', type: 'ENABLES' },
  { from: 'story', to: 'next_step_commitment', type: 'ENABLES' },
  { from: 'pain', to: 'stakeholder', type: 'INVOLVES' },
];

// ─── Seed Function ────────────────────────────────────────────────────────────

/**
 * Seed the Neo4j graph with canonical ontology data.
 * Uses MERGE operations to be idempotent.
 */
export async function seedGraphData(): Promise<void> {
  const session = getSession();

  try {
    // 1. Create Canonical Field nodes
    for (const field of CANONICAL_FIELDS) {
      await session.run(
        'MERGE (c:CanonicalField {name: $name})',
        { name: field }
      );
    }
    console.log(`✓ Created ${CANONICAL_FIELDS.length} CanonicalField nodes`);

    // 2. Create Framework nodes
    for (const fw of FRAMEWORKS) {
      await session.run(
        'MERGE (f:Framework {name: $name})',
        { name: fw }
      );
    }
    console.log(`✓ Created ${FRAMEWORKS.length} Framework nodes`);

    // 3. Create FrameworkNativeField nodes with BELONGS_TO relationships
    for (const nf of FRAMEWORK_NATIVE_FIELDS) {
      const key = `${nf.framework}:${nf.name}`;
      await session.run(
        `MERGE (nf:FrameworkNativeField {key: $key})
         ON CREATE SET nf.name = $name, nf.framework = $framework
         WITH nf
         MATCH (f:Framework {name: $framework})
         MERGE (nf)-[:BELONGS_TO]->(f)`,
        { key, name: nf.name, framework: nf.framework }
      );
    }
    console.log(`✓ Created ${FRAMEWORK_NATIVE_FIELDS.length} FrameworkNativeField nodes with BELONGS_TO relationships`);

    // 4. Create MAPS_TO relationships (crosswalk mappings)
    for (const mapping of CROSSWALK_MAPPINGS) {
      const nativeKey = `${mapping.framework}:${mapping.nativeField}`;
      await session.run(
        `MATCH (nf:FrameworkNativeField {key: $nativeKey})
         MATCH (c:CanonicalField {name: $canonicalField})
         MERGE (nf)-[:MAPS_TO]->(c)`,
        { nativeKey, canonicalField: mapping.canonicalField }
      );
    }
    console.log(`✓ Created ${CROSSWALK_MAPPINGS.length} MAPS_TO crosswalk relationships`);

    // 5. Create RELATES_TO relationships between canonical fields
    for (const rel of CONCEPT_RELATIONS) {
      await session.run(
        `MATCH (c1:CanonicalField {name: $from})
         MATCH (c2:CanonicalField {name: $to})
         MERGE (c1)-[:RELATES_TO {type: $type}]->(c2)`,
        { from: rel.from, to: rel.to, type: rel.type }
      );
    }
    console.log(`✓ Created ${CONCEPT_RELATIONS.length} RELATES_TO concept relationships`);

    console.log('✓ Graph seed completed successfully');
  } finally {
    await session.close();
  }
}
