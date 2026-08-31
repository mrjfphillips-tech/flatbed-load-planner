/**
 * Unit tests for CoverageAnalyzerImpl
 *
 * Tests coverage score tracking, gap identification, wrap-up detection,
 * stakeholder suggestion, and advancement logic.
 *
 * Database interactions are mocked via vi.mock.
 *
 * Requirements: 2.1, 2.4, 2.6, 3.8, 3.9, 3.15
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QuestionIntentScore, CoverageScoreMap, CanonicalField } from '@ptv-discovery-coach/shared';
import { CANONICAL_FIELDS } from '@ptv-discovery-coach/shared';

// Mock the database module
vi.mock('../db/index', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    execute: vi.fn().mockResolvedValue([]),
  },
  schema: {
    coverageSnapshots: {},
  },
}));

import { CoverageAnalyzerImpl } from '../ai/coverageAnalyzer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeIntentScore(questionId: string, score: number): QuestionIntentScore {
  return {
    questionId,
    score,
    isMet: score >= 70,
    reasoning: score >= 70 ? 'Intent addressed' : 'Intent not fully addressed',
    followUpNeeded: score < 70,
    evaluatedAt: new Date(),
  };
}

function makeFullCoverage(score: number): CoverageScoreMap {
  const canonical: Record<string, number> = {};
  for (const field of CANONICAL_FIELDS) {
    canonical[field] = score;
  }
  return {
    canonical: canonical as Record<CanonicalField, number>,
    frameworkNative: {},
    lastUpdated: new Date(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CoverageAnalyzerImpl', () => {
  let analyzer: CoverageAnalyzerImpl;

  beforeEach(() => {
    analyzer = new CoverageAnalyzerImpl();
    vi.clearAllMocks();
  });

  // ── updateCoverage ─────────────────────────────────────────────────────────

  describe('updateCoverage', () => {
    it('returns a coverage map with all canonical fields initialized', async () => {
      const result = await analyzer.updateCoverage(
        'session-1',
        makeIntentScore('q1', 80),
        'pain',
      );

      expect(result.canonical).toBeDefined();
      for (const field of CANONICAL_FIELDS) {
        expect(typeof result.canonical[field]).toBe('number');
      }
      expect(result.lastUpdated).toBeInstanceOf(Date);
    });

    it('computes 100% coverage when single question meets threshold', async () => {
      const result = await analyzer.updateCoverage(
        'session-1',
        makeIntentScore('q1', 80),
        'pain',
      );

      expect(result.canonical.pain).toBe(100);
    });

    it('computes 0% coverage when single question is below threshold', async () => {
      const result = await analyzer.updateCoverage(
        'session-1',
        makeIntentScore('q1', 50),
        'pain',
      );

      expect(result.canonical.pain).toBe(0);
    });

    it('computes coverage as percentage of questions meeting threshold', async () => {
      // 2 questions meet threshold, 1 does not → 67% (rounds to 67)
      await analyzer.updateCoverage('session-1', makeIntentScore('q1', 80), 'pain');
      await analyzer.updateCoverage('session-1', makeIntentScore('q2', 75), 'pain');
      const result = await analyzer.updateCoverage(
        'session-1',
        makeIntentScore('q3', 50),
        'pain',
      );

      expect(result.canonical.pain).toBe(67); // 2/3 = 66.7% → rounds to 67
    });

    it('updates existing question score when same questionId is scored again', async () => {
      await analyzer.updateCoverage('session-1', makeIntentScore('q1', 50), 'pain');
      // Re-score same question higher
      const result = await analyzer.updateCoverage(
        'session-1',
        makeIntentScore('q1', 85),
        'pain',
      );

      expect(result.canonical.pain).toBe(100); // Now 1/1 = 100%
    });

    it('tracks framework-native fields separately', async () => {
      const result = await analyzer.updateCoverage(
        'session-1',
        makeIntentScore('q1', 90),
        'MEDDICC:champion',
      );

      expect(result.frameworkNative['MEDDICC:champion']).toBe(100);
    });

    it('tracks multiple fields independently per session', async () => {
      await analyzer.updateCoverage('session-1', makeIntentScore('q1', 80), 'pain');
      const result = await analyzer.updateCoverage(
        'session-1',
        makeIntentScore('q2', 40),
        'value_metric',
      );

      expect(result.canonical.pain).toBe(100);
      expect(result.canonical.value_metric).toBe(0);
    });

    it('uses configurable intent score threshold', async () => {
      const customAnalyzer = new CoverageAnalyzerImpl({ intentScoreThreshold: 50 });

      const result = await customAnalyzer.updateCoverage(
        'session-1',
        makeIntentScore('q1', 55),
        'pain',
      );

      // 55 >= 50 threshold, so it counts as met
      expect(result.canonical.pain).toBe(100);
    });
  });

  // ── identifyGaps ───────────────────────────────────────────────────────────

  describe('identifyGaps', () => {
    it('identifies gaps below deal stage targets for first_discovery', () => {
      const coverage = makeFullCoverage(30);
      const gaps = analyzer.identifyGaps(coverage, 'first_discovery');

      expect(gaps.length).toBeGreaterThan(0);
      // pain target is 60 in first_discovery, and score is 30
      const painGap = gaps.find((g) => g.field === 'pain');
      expect(painGap).toBeDefined();
      expect(painGap!.currentScore).toBe(30);
      expect(painGap!.targetScore).toBe(60);
    });

    it('returns empty when all fields meet targets', () => {
      const coverage = makeFullCoverage(100);
      const gaps = analyzer.identifyGaps(coverage, 'first_discovery');

      expect(gaps).toHaveLength(0);
    });

    it('sorts gaps by severity (largest gap first)', () => {
      const canonical: Record<string, number> = {};
      for (const field of CANONICAL_FIELDS) {
        canonical[field] = 90;
      }
      canonical['pain'] = 10; // big gap
      canonical['value_metric'] = 50; // smaller gap

      const coverage: CoverageScoreMap = {
        canonical: canonical as Record<CanonicalField, number>,
        frameworkNative: {},
        lastUpdated: new Date(),
      };

      const gaps = analyzer.identifyGaps(coverage, 'qualification');

      // pain gap: 80 - 10 = 70, value_metric gap: 60 - 50 = 10
      expect(gaps[0].field).toBe('pain');
    });

    it('includes framework-native fields below gap threshold', () => {
      const coverage: CoverageScoreMap = {
        canonical: makeFullCoverage(100).canonical,
        frameworkNative: { 'MEDDICC:champion': 30 },
        lastUpdated: new Date(),
      };

      const gaps = analyzer.identifyGaps(coverage, 'first_discovery');

      const nativeGap = gaps.find((g) => g.field === 'MEDDICC:champion');
      expect(nativeGap).toBeDefined();
      expect(nativeGap!.fieldType).toBe('framework_native');
      expect(nativeGap!.framework).toBe('MEDDICC');
    });

    it('uses higher targets for later deal stages', () => {
      const coverage = makeFullCoverage(75);
      const gapsFirst = analyzer.identifyGaps(coverage, 'first_discovery');
      const gapsClose = analyzer.identifyGaps(coverage, 'close');

      // Later stages should have more gaps at the same score
      expect(gapsClose.length).toBeGreaterThan(gapsFirst.length);
    });
  });

  // ── isWrapUpReady ──────────────────────────────────────────────────────────

  describe('isWrapUpReady', () => {
    it('returns true when all canonical fields are at 80+', () => {
      const coverage = makeFullCoverage(80);
      expect(analyzer.isWrapUpReady(coverage)).toBe(true);
    });

    it('returns true when all fields are above 80', () => {
      const coverage = makeFullCoverage(95);
      expect(analyzer.isWrapUpReady(coverage)).toBe(true);
    });

    it('returns false when any canonical field is below 80', () => {
      const canonical: Record<string, number> = {};
      for (const field of CANONICAL_FIELDS) {
        canonical[field] = 85;
      }
      canonical['pain'] = 79;

      const coverage: CoverageScoreMap = {
        canonical: canonical as Record<CanonicalField, number>,
        frameworkNative: {},
        lastUpdated: new Date(),
      };

      expect(analyzer.isWrapUpReady(coverage)).toBe(false);
    });

    it('respects configurable wrap-up threshold', () => {
      const customAnalyzer = new CoverageAnalyzerImpl({ wrapUpThreshold: 90 });
      const coverage = makeFullCoverage(85);

      expect(customAnalyzer.isWrapUpReady(coverage)).toBe(false);
    });
  });

  // ── suggestStakeholders ────────────────────────────────────────────────────

  describe('suggestStakeholders', () => {
    it('returns stakeholder recommendations for coverage gaps', () => {
      const gaps = [
        { field: 'pain' as CanonicalField, fieldType: 'canonical' as const, currentScore: 20, targetScore: 60 },
        { field: 'value_metric' as CanonicalField, fieldType: 'canonical' as const, currentScore: 10, targetScore: 60 },
      ];

      const recommendations = analyzer.suggestStakeholders(gaps);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].buyerPersona).toBeDefined();
      expect(recommendations[0].relevantFields.length).toBeGreaterThan(0);
      expect(recommendations[0].rationale).toContain('coverage gap');
    });

    it('prioritizes personas that address more gaps', () => {
      const gaps = [
        { field: 'pain' as CanonicalField, fieldType: 'canonical' as const, currentScore: 10, targetScore: 60 },
        { field: 'value_metric' as CanonicalField, fieldType: 'canonical' as const, currentScore: 10, targetScore: 60 },
        { field: 'decision_criteria' as CanonicalField, fieldType: 'canonical' as const, currentScore: 10, targetScore: 60 },
      ];

      const recommendations = analyzer.suggestStakeholders(gaps);

      // The first recommendation should have the highest priority
      expect(recommendations[0].priority).toBeGreaterThanOrEqual(recommendations[recommendations.length - 1].priority);
    });

    it('returns empty for no gaps', () => {
      const recommendations = analyzer.suggestStakeholders([]);
      expect(recommendations).toHaveLength(0);
    });

    it('ignores framework-native gaps for persona mapping', () => {
      const gaps = [
        { field: 'MEDDICC:champion', fieldType: 'framework_native' as const, currentScore: 20, targetScore: 60, framework: 'MEDDICC' as const },
      ];

      const recommendations = analyzer.suggestStakeholders(gaps);
      expect(recommendations).toHaveLength(0);
    });
  });

  // ── shouldFieldAdvance ─────────────────────────────────────────────────────

  describe('shouldFieldAdvance', () => {
    it('returns false with no scores tracked', () => {
      expect(analyzer.shouldFieldAdvance('session-1', 'pain')).toBe(false);
    });

    it('returns true when 70% of questions meet 70+ threshold', async () => {
      // 3 out of 4 = 75% >= 70%
      await analyzer.updateCoverage('session-1', makeIntentScore('q1', 80), 'pain');
      await analyzer.updateCoverage('session-1', makeIntentScore('q2', 75), 'pain');
      await analyzer.updateCoverage('session-1', makeIntentScore('q3', 90), 'pain');
      await analyzer.updateCoverage('session-1', makeIntentScore('q4', 50), 'pain');

      expect(analyzer.shouldFieldAdvance('session-1', 'pain')).toBe(true);
    });

    it('returns false when below 70% of questions meet threshold', async () => {
      // 1 out of 4 = 25% < 70%
      await analyzer.updateCoverage('session-1', makeIntentScore('q1', 80), 'pain');
      await analyzer.updateCoverage('session-1', makeIntentScore('q2', 50), 'pain');
      await analyzer.updateCoverage('session-1', makeIntentScore('q3', 40), 'pain');
      await analyzer.updateCoverage('session-1', makeIntentScore('q4', 30), 'pain');

      expect(analyzer.shouldFieldAdvance('session-1', 'pain')).toBe(false);
    });

    it('uses configurable advancement threshold', async () => {
      const customAnalyzer = new CoverageAnalyzerImpl({ advancementThreshold: 0.50 });

      // 2 out of 4 = 50% >= 50%
      await customAnalyzer.updateCoverage('session-1', makeIntentScore('q1', 80), 'pain');
      await customAnalyzer.updateCoverage('session-1', makeIntentScore('q2', 75), 'pain');
      await customAnalyzer.updateCoverage('session-1', makeIntentScore('q3', 40), 'pain');
      await customAnalyzer.updateCoverage('session-1', makeIntentScore('q4', 30), 'pain');

      expect(customAnalyzer.shouldFieldAdvance('session-1', 'pain')).toBe(true);
    });
  });

  // ── getAdvancementProportion ───────────────────────────────────────────────

  describe('getAdvancementProportion', () => {
    it('returns 0 with no tracked scores', () => {
      expect(analyzer.getAdvancementProportion('session-1', 'pain')).toBe(0);
    });

    it('returns correct proportion of met questions', async () => {
      await analyzer.updateCoverage('session-1', makeIntentScore('q1', 80), 'pain');
      await analyzer.updateCoverage('session-1', makeIntentScore('q2', 50), 'pain');

      // 1 out of 2 = 0.5
      expect(analyzer.getAdvancementProportion('session-1', 'pain')).toBe(0.5);
    });
  });

  // ── getAccountCoverage ─────────────────────────────────────────────────────

  describe('getAccountCoverage', () => {
    it('returns a CoverageScoreMap with all canonical fields', async () => {
      const result = await analyzer.getAccountCoverage('account-1');

      expect(result.canonical).toBeDefined();
      for (const field of CANONICAL_FIELDS) {
        expect(typeof result.canonical[field]).toBe('number');
      }
      expect(result.lastUpdated).toBeInstanceOf(Date);
    });

    it('initializes canonical fields to 0 when no data exists', async () => {
      const result = await analyzer.getAccountCoverage('account-1');

      for (const field of CANONICAL_FIELDS) {
        expect(result.canonical[field]).toBe(0);
      }
    });
  });

  // ── edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('clamps coverage score to 0-100 range', async () => {
      // Even if something weird happens, scores should be bounded
      const result = await analyzer.updateCoverage(
        'session-1',
        makeIntentScore('q1', 100),
        'pain',
      );

      expect(result.canonical.pain).toBeLessThanOrEqual(100);
      expect(result.canonical.pain).toBeGreaterThanOrEqual(0);
    });

    it('handles multiple sessions independently', async () => {
      await analyzer.updateCoverage('session-1', makeIntentScore('q1', 80), 'pain');
      await analyzer.updateCoverage('session-2', makeIntentScore('q1', 40), 'pain');

      // Session 1 should have 100% (80 >= 70), session 2 should have 0% (40 < 70)
      const map1 = await analyzer.updateCoverage('session-1', makeIntentScore('q2', 90), 'pain');
      expect(map1.canonical.pain).toBe(100); // 2/2 met

      const map2 = await analyzer.updateCoverage('session-2', makeIntentScore('q2', 50), 'pain');
      expect(map2.canonical.pain).toBe(0); // 0/2 met
    });

    it('handles intent score exactly at threshold', async () => {
      const result = await analyzer.updateCoverage(
        'session-1',
        makeIntentScore('q1', 70), // exactly at threshold
        'pain',
      );

      expect(result.canonical.pain).toBe(100); // >= 70, so it counts
    });
  });
});
