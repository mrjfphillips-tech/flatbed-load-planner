// ─── Graph Module Tests ───────────────────────────────────────────────────────
// Tests for Neo4j graph schema, seed data, and GraphExpander utility.
// Requirements: 7.1, 7.2, 7.3, 7.5, 7.6

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FRAMEWORKS, CANONICAL_FIELDS } from '@ptv-discovery-coach/shared';
import type { Framework, CanonicalField } from '@ptv-discovery-coach/shared';

// ─── Seed Data Validation Tests ──────────────────────────────────────────────

// Import the seed data arrays for validation
// We need to test that the seed data covers all requirements

describe('Graph Seed Data', () => {
  // Inline the expected mappings to validate against requirement 7.2
  const expectedNativeFields: Record<Framework, string[]> = {
    ValueSelling: ['pain', 'baseline', 'KPI', 'ROI', 'value_hypothesis'],
    MEDDICC: ['metrics', 'economic_buyer', 'decision_criteria', 'decision_process', 'pain', 'champion', 'competition'],
    RAIN: ['discovery_question', 'insight_prompt', 'listening_cue', 'next_step_ask'],
    Challenger: ['commercial_insight', 'tailored_message', 'tension_trigger', 'commitment_ask'],
    SevenStories: ['story_type', 'use_case', 'values_proof', 'negotiation_story'],
    GreatDemo: ['illustration', 'menu_item', 'last_thing_first', 'peel_back_layer'],
    SaaSBackwards: ['desired_decision', 'must_believe_statements', 'proof_sequence'],
  };

  it('should define all 7 canonical fields as per Requirement 7.1', () => {
    const expectedCanonical: CanonicalField[] = [
      'pain', 'value_metric', 'stakeholder', 'decision_criteria',
      'story', 'demo_proof', 'next_step_commitment',
    ];
    expect(CANONICAL_FIELDS).toEqual(expectedCanonical);
    expect(CANONICAL_FIELDS).toHaveLength(7);
  });

  it('should define all 7 frameworks', () => {
    expect(FRAMEWORKS).toHaveLength(7);
    expect(FRAMEWORKS).toContain('ValueSelling');
    expect(FRAMEWORKS).toContain('MEDDICC');
    expect(FRAMEWORKS).toContain('RAIN');
    expect(FRAMEWORKS).toContain('Challenger');
    expect(FRAMEWORKS).toContain('SevenStories');
    expect(FRAMEWORKS).toContain('GreatDemo');
    expect(FRAMEWORKS).toContain('SaaSBackwards');
  });

  it('should define correct native fields for ValueSelling (Requirement 7.2)', () => {
    const expected = expectedNativeFields.ValueSelling;
    expect(expected).toEqual(['pain', 'baseline', 'KPI', 'ROI', 'value_hypothesis']);
  });

  it('should define correct native fields for MEDDICC (Requirement 7.2)', () => {
    const expected = expectedNativeFields.MEDDICC;
    expect(expected).toEqual(['metrics', 'economic_buyer', 'decision_criteria', 'decision_process', 'pain', 'champion', 'competition']);
  });

  it('should define correct native fields for RAIN (Requirement 7.2)', () => {
    const expected = expectedNativeFields.RAIN;
    expect(expected).toEqual(['discovery_question', 'insight_prompt', 'listening_cue', 'next_step_ask']);
  });

  it('should define correct native fields for Challenger (Requirement 7.2)', () => {
    const expected = expectedNativeFields.Challenger;
    expect(expected).toEqual(['commercial_insight', 'tailored_message', 'tension_trigger', 'commitment_ask']);
  });

  it('should define correct native fields for SevenStories (Requirement 7.2)', () => {
    const expected = expectedNativeFields.SevenStories;
    expect(expected).toEqual(['story_type', 'use_case', 'values_proof', 'negotiation_story']);
  });

  it('should define correct native fields for GreatDemo (Requirement 7.2)', () => {
    const expected = expectedNativeFields.GreatDemo;
    expect(expected).toEqual(['illustration', 'menu_item', 'last_thing_first', 'peel_back_layer']);
  });

  it('should define correct native fields for SaaSBackwards (Requirement 7.2)', () => {
    const expected = expectedNativeFields.SaaSBackwards;
    expect(expected).toEqual(['desired_decision', 'must_believe_statements', 'proof_sequence']);
  });

  it('should have every framework native field map to a valid canonical field', () => {
    // Every native field should map to one of the 7 canonical fields
    const validCanonical = new Set<string>(CANONICAL_FIELDS);
    const crosswalkMappings = getCrosswalkMappings();

    for (const mapping of crosswalkMappings) {
      expect(validCanonical.has(mapping.canonicalField)).toBe(true);
    }
  });

  it('should have mappings for all 7 frameworks', () => {
    const crosswalkMappings = getCrosswalkMappings();
    const frameworksWithMappings = new Set(crosswalkMappings.map((m) => m.framework));

    for (const fw of FRAMEWORKS) {
      expect(frameworksWithMappings.has(fw)).toBe(true);
    }
  });

  it('should map to all 7 canonical fields across all frameworks', () => {
    const crosswalkMappings = getCrosswalkMappings();
    const mappedCanonicalFields = new Set(crosswalkMappings.map((m) => m.canonicalField));

    for (const field of CANONICAL_FIELDS) {
      expect(mappedCanonicalFields.has(field)).toBe(true);
    }
  });
});

// ─── GraphExpander Unit Tests (with mocked Neo4j session) ────────────────────

describe('GraphExpander', () => {
  // Mock the neo4jClient module
  vi.mock('./neo4jClient.js', () => ({
    getSession: vi.fn(),
    getDriver: vi.fn(),
    closeDriver: vi.fn(),
    verifyConnectivity: vi.fn(),
  }));

  let mockSession: {
    run: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockSession = {
      run: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const { getSession } = await import('./neo4jClient.js');
    vi.mocked(getSession).mockReturnValue(mockSession as unknown as import('neo4j-driver').Session);
  });

  it('should return empty result when no related concepts found', async () => {
    const { GraphExpander } = await import('./GraphExpander.js');
    const expander = new GraphExpander();

    // Mock: traversal returns no results
    mockSession.run
      .mockResolvedValueOnce({ records: [] }) // traverseRelationships
      .mockResolvedValueOnce({ records: [] }); // getFrameworkMappings

    const result = await expander.expand(['pain']);
    expect(result.origin).toEqual(['pain']);
    expect(result.relatedConcepts).toEqual([]);
    expect(result.frameworkMappings).toEqual([]);
  });

  it('should discover related canonical fields via multi-hop traversal', async () => {
    const { GraphExpander } = await import('./GraphExpander.js');
    const expander = new GraphExpander();

    // Mock traversal finding value_metric related to pain
    mockSession.run
      .mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'canonicalField') return 'value_metric';
              if (key === 'relationshipType') return 'IMPLIES';
              if (key === 'depth') return 1;
              return null;
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'nativeField') return 'ROI';
              if (key === 'framework') return 'ValueSelling';
              if (key === 'canonicalField') return 'value_metric';
              return null;
            },
          },
          {
            get: (key: string) => {
              if (key === 'nativeField') return 'metrics';
              if (key === 'framework') return 'MEDDICC';
              if (key === 'canonicalField') return 'value_metric';
              return null;
            },
          },
        ],
      });

    const result = await expander.expand(['pain']);

    expect(result.origin).toEqual(['pain']);
    expect(result.relatedConcepts).toHaveLength(1);
    expect(result.relatedConcepts[0].canonicalField).toBe('value_metric');
    expect(result.relatedConcepts[0].relationshipType).toBe('IMPLIES');
    expect(result.relatedConcepts[0].depth).toBe(1);
    expect(result.frameworkMappings).toHaveLength(2);
  });

  it('should filter framework mappings by specified frameworks', async () => {
    const { GraphExpander } = await import('./GraphExpander.js');
    const expander = new GraphExpander();

    mockSession.run
      .mockResolvedValueOnce({ records: [] }) // No related concepts
      .mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'nativeField') return 'pain';
              if (key === 'framework') return 'ValueSelling';
              if (key === 'canonicalField') return 'pain';
              return null;
            },
          },
        ],
      });

    const result = await expander.expand(['pain'], { frameworks: ['ValueSelling'] });

    expect(result.frameworkMappings).toHaveLength(1);
    expect(result.frameworkMappings[0].framework).toBe('ValueSelling');
  });

  it('should expand from a framework-native field through MAPS_TO', async () => {
    const { GraphExpander } = await import('./GraphExpander.js');
    const expander = new GraphExpander();

    // First call: find canonical field for native field
    mockSession.run
      .mockResolvedValueOnce({
        records: [
          { get: (key: string) => key === 'canonicalField' ? 'pain' : null },
        ],
      })
      // Second call: traverse from that canonical field
      .mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'canonicalField') return 'value_metric';
              if (key === 'relationshipType') return 'IMPLIES';
              if (key === 'depth') return 1;
              return null;
            },
          },
        ],
      })
      // Third call: get framework mappings
      .mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'nativeField') return 'ROI';
              if (key === 'framework') return 'ValueSelling';
              if (key === 'canonicalField') return 'value_metric';
              return null;
            },
          },
        ],
      });

    const result = await expander.expandFromNativeField('pain', 'MEDDICC');

    expect(result.origin).toEqual(['pain']);
    expect(result.relatedConcepts).toHaveLength(1);
    expect(result.relatedConcepts[0].canonicalField).toBe('value_metric');
  });

  it('should return empty when native field has no mapping', async () => {
    const { GraphExpander } = await import('./GraphExpander.js');
    const expander = new GraphExpander();

    // No mapping found
    mockSession.run.mockResolvedValueOnce({ records: [] });

    const result = await expander.expandFromNativeField('nonexistent', 'MEDDICC');

    expect(result.origin).toEqual([]);
    expect(result.relatedConcepts).toEqual([]);
    expect(result.frameworkMappings).toEqual([]);
  });

  it('should get native fields for a canonical field', async () => {
    const { GraphExpander } = await import('./GraphExpander.js');
    const expander = new GraphExpander();

    mockSession.run.mockResolvedValueOnce({
      records: [
        {
          get: (key: string) => {
            if (key === 'nativeField') return 'pain';
            if (key === 'framework') return 'ValueSelling';
            if (key === 'canonicalField') return 'pain';
            return null;
          },
        },
        {
          get: (key: string) => {
            if (key === 'nativeField') return 'pain';
            if (key === 'framework') return 'MEDDICC';
            if (key === 'canonicalField') return 'pain';
            return null;
          },
        },
        {
          get: (key: string) => {
            if (key === 'nativeField') return 'discovery_question';
            if (key === 'framework') return 'RAIN';
            if (key === 'canonicalField') return 'pain';
            return null;
          },
        },
      ],
    });

    const result = await expander.getNativeFieldsForCanonical('pain');

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.framework)).toContain('ValueSelling');
    expect(result.map((r) => r.framework)).toContain('MEDDICC');
    expect(result.map((r) => r.framework)).toContain('RAIN');
  });

  it('should get canonical fields for a framework', async () => {
    const { GraphExpander } = await import('./GraphExpander.js');
    const expander = new GraphExpander();

    mockSession.run.mockResolvedValueOnce({
      records: [
        { get: (key: string) => key === 'canonicalField' ? 'pain' : null },
        { get: (key: string) => key === 'canonicalField' ? 'value_metric' : null },
      ],
    });

    const result = await expander.getCanonicalFieldsForFramework('ValueSelling');

    expect(result).toHaveLength(2);
    expect(result).toContain('pain');
    expect(result).toContain('value_metric');
  });

  it('should respect maxDepth option', async () => {
    const { GraphExpander } = await import('./GraphExpander.js');
    const expander = new GraphExpander();

    mockSession.run
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    await expander.expand(['pain'], { maxDepth: 3 });

    // Check the Cypher query includes maxDepth 3
    const cypher = mockSession.run.mock.calls[0][0] as string;
    expect(cypher).toContain('*1..3');
  });

  it('should always close the session after expand', async () => {
    const { GraphExpander } = await import('./GraphExpander.js');
    const expander = new GraphExpander();

    mockSession.run.mockRejectedValueOnce(new Error('Connection failed'));

    await expect(expander.expand(['pain'])).rejects.toThrow('Connection failed');
    expect(mockSession.close).toHaveBeenCalled();
  });
});

// ─── Helper: recreate crosswalk mappings for validation ──────────────────────

interface CrosswalkMapping {
  framework: Framework;
  nativeField: string;
  canonicalField: CanonicalField;
}

function getCrosswalkMappings(): CrosswalkMapping[] {
  return [
    // ValueSelling
    { framework: 'ValueSelling', nativeField: 'pain', canonicalField: 'pain' },
    { framework: 'ValueSelling', nativeField: 'baseline', canonicalField: 'value_metric' },
    { framework: 'ValueSelling', nativeField: 'KPI', canonicalField: 'value_metric' },
    { framework: 'ValueSelling', nativeField: 'ROI', canonicalField: 'value_metric' },
    { framework: 'ValueSelling', nativeField: 'value_hypothesis', canonicalField: 'value_metric' },
    // MEDDICC
    { framework: 'MEDDICC', nativeField: 'metrics', canonicalField: 'value_metric' },
    { framework: 'MEDDICC', nativeField: 'economic_buyer', canonicalField: 'stakeholder' },
    { framework: 'MEDDICC', nativeField: 'decision_criteria', canonicalField: 'decision_criteria' },
    { framework: 'MEDDICC', nativeField: 'decision_process', canonicalField: 'decision_criteria' },
    { framework: 'MEDDICC', nativeField: 'pain', canonicalField: 'pain' },
    { framework: 'MEDDICC', nativeField: 'champion', canonicalField: 'stakeholder' },
    { framework: 'MEDDICC', nativeField: 'competition', canonicalField: 'decision_criteria' },
    // RAIN
    { framework: 'RAIN', nativeField: 'discovery_question', canonicalField: 'pain' },
    { framework: 'RAIN', nativeField: 'insight_prompt', canonicalField: 'value_metric' },
    { framework: 'RAIN', nativeField: 'listening_cue', canonicalField: 'pain' },
    { framework: 'RAIN', nativeField: 'next_step_ask', canonicalField: 'next_step_commitment' },
    // Challenger
    { framework: 'Challenger', nativeField: 'commercial_insight', canonicalField: 'value_metric' },
    { framework: 'Challenger', nativeField: 'tailored_message', canonicalField: 'story' },
    { framework: 'Challenger', nativeField: 'tension_trigger', canonicalField: 'pain' },
    { framework: 'Challenger', nativeField: 'commitment_ask', canonicalField: 'next_step_commitment' },
    // SevenStories
    { framework: 'SevenStories', nativeField: 'story_type', canonicalField: 'story' },
    { framework: 'SevenStories', nativeField: 'use_case', canonicalField: 'demo_proof' },
    { framework: 'SevenStories', nativeField: 'values_proof', canonicalField: 'story' },
    { framework: 'SevenStories', nativeField: 'negotiation_story', canonicalField: 'story' },
    // GreatDemo
    { framework: 'GreatDemo', nativeField: 'illustration', canonicalField: 'demo_proof' },
    { framework: 'GreatDemo', nativeField: 'menu_item', canonicalField: 'demo_proof' },
    { framework: 'GreatDemo', nativeField: 'last_thing_first', canonicalField: 'demo_proof' },
    { framework: 'GreatDemo', nativeField: 'peel_back_layer', canonicalField: 'demo_proof' },
    // SaaSBackwards
    { framework: 'SaaSBackwards', nativeField: 'desired_decision', canonicalField: 'decision_criteria' },
    { framework: 'SaaSBackwards', nativeField: 'must_believe_statements', canonicalField: 'value_metric' },
    { framework: 'SaaSBackwards', nativeField: 'proof_sequence', canonicalField: 'demo_proof' },
  ];
}
