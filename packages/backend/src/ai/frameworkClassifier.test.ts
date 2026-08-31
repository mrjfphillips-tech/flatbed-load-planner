/**
 * Unit tests for FrameworkClassifierService
 *
 * Tests the rule-based and LLM-enhanced framework classification logic including:
 *   - Deal stage weighting
 *   - Coverage gap analysis
 *   - Transcript keyword detection
 *   - Buyer persona affinity
 *   - LLM-based classification via TranscriptAnalyzer interface
 *
 * Validates: Requirements 3.1, 28.2
 */

import { describe, it, expect, vi } from 'vitest';
import {
  FrameworkClassifierService,
  type TranscriptAnalyzer,
  type TranscriptAnalysisResult,
} from './frameworkClassifier';

import type {
  ClassificationContext,
  CoverageGap,
  FrameworkWeightingProfile,
} from '@ptv-discovery-coach/shared';
import type { TranscriptSegment } from '@ptv-discovery-coach/shared';
import type { Framework } from '@ptv-discovery-coach/shared';
import { DEFAULT_FRAMEWORK_WEIGHTS } from '@ptv-discovery-coach/shared';

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function createTranscriptSegment(text: string, overrides?: Partial<TranscriptSegment>): TranscriptSegment {
  return {
    id: `seg-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: 'test-session',
    speaker: 'customer_1',
    text,
    startTimeMs: 0,
    endTimeMs: 1000,
    confidence: 0.95,
    source: 'audio',
    createdAt: new Date(),
    ...overrides,
  };
}

function createClassificationContext(overrides?: Partial<ClassificationContext>): ClassificationContext {
  return {
    recentTranscript: [],
    coverageGaps: [],
    buyerPersona: 'logistics_director',
    dealStage: 'first_discovery',
    frameworkWeights: {
      dealStage: 'first_discovery',
      weights: DEFAULT_FRAMEWORK_WEIGHTS['first_discovery'],
    },
    activeFrameworks: ['ValueSelling', 'MEDDICC', 'RAIN', 'Challenger', 'SevenStories', 'GreatDemo', 'SaaSBackwards'],
    ...overrides,
  };
}

function createMockTranscriptAnalyzer(result?: Partial<TranscriptAnalysisResult>): TranscriptAnalyzer {
  return {
    analyzeTranscript: vi.fn().mockResolvedValue({
      detectedFields: result?.detectedFields ?? ['pain'],
      suggestedFrameworks: result?.suggestedFrameworks ?? ['ValueSelling'],
      frameworkRelevance: result?.frameworkRelevance ?? { ValueSelling: 0.8 },
      reasoning: result?.reasoning ?? 'LLM detected pain-related discussion',
    } satisfies TranscriptAnalysisResult),
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('FrameworkClassifierService', () => {
  describe('constructor and basic behavior', () => {
    it('should instantiate with default options', () => {
      const service = new FrameworkClassifierService();
      expect(service).toBeDefined();
    });

    it('should instantiate with LLM options', () => {
      const analyzer = createMockTranscriptAnalyzer();
      const service = new FrameworkClassifierService({
        useLlmClassification: true,
        transcriptAnalyzer: analyzer,
      });
      expect(service).toBeDefined();
    });
  });

  describe('rule-based classification', () => {
    it('should return a valid FrameworkRouting with all required fields', async () => {
      const service = new FrameworkClassifierService();
      const ctx = createClassificationContext();

      const result = await service.classify(ctx);

      expect(result).toHaveProperty('primaryFramework');
      expect(result).toHaveProperty('secondaryFrameworks');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasoning');
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.secondaryFrameworks)).toBe(true);
      expect(typeof result.reasoning).toBe('string');
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('should only return frameworks from the active set', async () => {
      const service = new FrameworkClassifierService();
      const activeFrameworks: Framework[] = ['ValueSelling', 'MEDDICC', 'RAIN'];
      const ctx = createClassificationContext({ activeFrameworks });

      const result = await service.classify(ctx);

      expect(activeFrameworks).toContain(result.primaryFramework);
      for (const fw of result.secondaryFrameworks) {
        expect(activeFrameworks).toContain(fw);
      }
    });

    it('should favor RAIN and Challenger in first_discovery deal stage', async () => {
      const service = new FrameworkClassifierService();
      const ctx = createClassificationContext({
        dealStage: 'first_discovery',
        frameworkWeights: {
          dealStage: 'first_discovery',
          weights: DEFAULT_FRAMEWORK_WEIGHTS['first_discovery'],
        },
      });

      const result = await service.classify(ctx);

      // RAIN and Challenger have highest weights (0.25 each) in first_discovery
      const topFrameworks = [result.primaryFramework, ...result.secondaryFrameworks];
      const hasRainOrChallenger = topFrameworks.includes('RAIN') || topFrameworks.includes('Challenger');
      expect(hasRainOrChallenger).toBe(true);
    });

    it('should favor MEDDICC in qualification deal stage', async () => {
      const service = new FrameworkClassifierService();
      const ctx = createClassificationContext({
        dealStage: 'qualification',
        frameworkWeights: {
          dealStage: 'qualification',
          weights: DEFAULT_FRAMEWORK_WEIGHTS['qualification'],
        },
      });

      const result = await service.classify(ctx);

      // MEDDICC has highest weight (0.30) in qualification
      const topFrameworks = [result.primaryFramework, ...result.secondaryFrameworks];
      expect(topFrameworks).toContain('MEDDICC');
    });

    it('should favor GreatDemo in demo_proof deal stage', async () => {
      const service = new FrameworkClassifierService();
      const ctx = createClassificationContext({
        dealStage: 'demo_proof',
        frameworkWeights: {
          dealStage: 'demo_proof',
          weights: DEFAULT_FRAMEWORK_WEIGHTS['demo_proof'],
        },
      });

      const result = await service.classify(ctx);

      // GreatDemo has highest weight (0.30) in demo_proof
      const topFrameworks = [result.primaryFramework, ...result.secondaryFrameworks];
      expect(topFrameworks).toContain('GreatDemo');
    });

    it('should boost frameworks that address coverage gaps', async () => {
      const service = new FrameworkClassifierService();
      const coverageGaps: CoverageGap[] = [
        {
          field: 'stakeholder',
          fieldType: 'canonical',
          currentScore: 10,
          targetScore: 70,
        },
      ];
      const ctx = createClassificationContext({
        coverageGaps,
        // Use a stage where MEDDICC isn't already dominant to see gap effect
        dealStage: 'first_discovery',
        frameworkWeights: {
          dealStage: 'first_discovery',
          weights: DEFAULT_FRAMEWORK_WEIGHTS['first_discovery'],
        },
      });

      const result = await service.classify(ctx);

      // MEDDICC and Challenger have affinity for 'stakeholder' field
      const topFrameworks = [result.primaryFramework, ...result.secondaryFrameworks];
      const hasStakeholderFramework = topFrameworks.includes('MEDDICC') || topFrameworks.includes('Challenger');
      expect(hasStakeholderFramework).toBe(true);
    });

    it('should detect transcript keywords and boost relevant frameworks', async () => {
      const service = new FrameworkClassifierService();
      const ctx = createClassificationContext({
        recentTranscript: [
          createTranscriptSegment('We need to understand the ROI and business case for this investment'),
          createTranscriptSegment('What are the total cost savings we can expect'),
        ],
      });

      const result = await service.classify(ctx);

      // Keywords like 'roi', 'business case', 'cost savings' all signal ValueSelling
      const topFrameworks = [result.primaryFramework, ...result.secondaryFrameworks];
      expect(topFrameworks).toContain('ValueSelling');
    });

    it('should detect demo-related keywords and boost GreatDemo', async () => {
      const service = new FrameworkClassifierService();
      const ctx = createClassificationContext({
        recentTranscript: [
          createTranscriptSegment('Can you show me a demonstration of this feature'),
          createTranscriptSegment('I want to see it in action before we proceed'),
        ],
        dealStage: 'demo_proof',
        frameworkWeights: {
          dealStage: 'demo_proof',
          weights: DEFAULT_FRAMEWORK_WEIGHTS['demo_proof'],
        },
      });

      const result = await service.classify(ctx);

      const topFrameworks = [result.primaryFramework, ...result.secondaryFrameworks];
      expect(topFrameworks).toContain('GreatDemo');
    });

    it('should consider buyer persona affinity', async () => {
      const service = new FrameworkClassifierService();
      const ctx = createClassificationContext({
        buyerPersona: 'supply_chain_vp',
        // supply_chain_vp has affinity: Challenger, ValueSelling, MEDDICC
      });

      const result = await service.classify(ctx);

      // The primary or secondary should include persona-aligned frameworks
      const topFrameworks = [result.primaryFramework, ...result.secondaryFrameworks];
      const hasPersonaFramework =
        topFrameworks.includes('Challenger') ||
        topFrameworks.includes('ValueSelling') ||
        topFrameworks.includes('MEDDICC');
      expect(hasPersonaFramework).toBe(true);
    });

    it('should return confidence between 0 and 1', async () => {
      const service = new FrameworkClassifierService();
      const ctx = createClassificationContext();

      const result = await service.classify(ctx);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should return at most 2 secondary frameworks', async () => {
      const service = new FrameworkClassifierService();
      const ctx = createClassificationContext();

      const result = await service.classify(ctx);

      expect(result.secondaryFrameworks.length).toBeLessThanOrEqual(2);
    });

    it('should not include primary framework in secondary frameworks', async () => {
      const service = new FrameworkClassifierService();
      const ctx = createClassificationContext();

      const result = await service.classify(ctx);

      expect(result.secondaryFrameworks).not.toContain(result.primaryFramework);
    });

    it('should handle empty transcript gracefully', async () => {
      const service = new FrameworkClassifierService();
      const ctx = createClassificationContext({
        recentTranscript: [],
      });

      const result = await service.classify(ctx);

      expect(result.primaryFramework).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle empty coverage gaps gracefully', async () => {
      const service = new FrameworkClassifierService();
      const ctx = createClassificationContext({
        coverageGaps: [],
      });

      const result = await service.classify(ctx);

      expect(result.primaryFramework).toBeDefined();
    });

    it('should handle framework-native coverage gaps by boosting the owning framework', async () => {
      const service = new FrameworkClassifierService();
      const coverageGaps: CoverageGap[] = [
        {
          field: 'champion',
          fieldType: 'framework_native',
          currentScore: 5,
          targetScore: 70,
          framework: 'MEDDICC',
        },
      ];
      const ctx = createClassificationContext({
        coverageGaps,
        dealStage: 'qualification',
        frameworkWeights: {
          dealStage: 'qualification',
          weights: DEFAULT_FRAMEWORK_WEIGHTS['qualification'],
        },
      });

      const result = await service.classify(ctx);

      const topFrameworks = [result.primaryFramework, ...result.secondaryFrameworks];
      expect(topFrameworks).toContain('MEDDICC');
    });

    it('should produce different routing for different deal stages with same context', async () => {
      const service = new FrameworkClassifierService();

      const ctxDiscovery = createClassificationContext({
        dealStage: 'first_discovery',
        frameworkWeights: {
          dealStage: 'first_discovery',
          weights: DEFAULT_FRAMEWORK_WEIGHTS['first_discovery'],
        },
      });
      const ctxDemo = createClassificationContext({
        dealStage: 'demo_proof',
        frameworkWeights: {
          dealStage: 'demo_proof',
          weights: DEFAULT_FRAMEWORK_WEIGHTS['demo_proof'],
        },
      });

      const resultDiscovery = await service.classify(ctxDiscovery);
      const resultDemo = await service.classify(ctxDemo);

      // They should produce different primary frameworks given the weight differences
      // first_discovery favors RAIN/Challenger, demo_proof favors GreatDemo
      expect(
        resultDiscovery.primaryFramework !== resultDemo.primaryFramework ||
        JSON.stringify(resultDiscovery.secondaryFrameworks) !== JSON.stringify(resultDemo.secondaryFrameworks)
      ).toBe(true);
    });
  });

  describe('LLM-enhanced classification', () => {
    it('should use TranscriptAnalyzer when LLM mode is enabled', async () => {
      const analyzer = createMockTranscriptAnalyzer({
        detectedFields: ['pain', 'value_metric'],
        suggestedFrameworks: ['ValueSelling', 'MEDDICC'],
        frameworkRelevance: {
          ValueSelling: 0.9,
          MEDDICC: 0.6,
          RAIN: 0.2,
          Challenger: 0.1,
          SevenStories: 0.05,
          GreatDemo: 0.05,
          SaaSBackwards: 0.1,
        },
        reasoning: 'Customer is discussing financial pain and metrics',
      });

      const service = new FrameworkClassifierService({
        useLlmClassification: true,
        transcriptAnalyzer: analyzer,
      });

      const ctx = createClassificationContext({
        recentTranscript: [
          createTranscriptSegment('We are losing money on inefficient routes'),
        ],
      });

      const result = await service.classify(ctx);

      expect(analyzer.analyzeTranscript).toHaveBeenCalledOnce();
      expect(result.primaryFramework).toBeDefined();
      expect(result.reasoning).toContain('Customer is discussing financial pain and metrics');
    });

    it('should fall back to rule-based when useLlm is true but no analyzer provided', async () => {
      const service = new FrameworkClassifierService({
        useLlmClassification: true,
        // No transcriptAnalyzer provided
      });

      const ctx = createClassificationContext();
      const result = await service.classify(ctx);

      // Should still produce a valid result (rule-based fallback)
      expect(result.primaryFramework).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should pass active frameworks to the TranscriptAnalyzer', async () => {
      const analyzer = createMockTranscriptAnalyzer();
      const service = new FrameworkClassifierService({
        useLlmClassification: true,
        transcriptAnalyzer: analyzer,
      });

      const activeFrameworks: Framework[] = ['RAIN', 'Challenger', 'ValueSelling'];
      const ctx = createClassificationContext({
        activeFrameworks,
        recentTranscript: [createTranscriptSegment('Tell me about your pain points')],
      });

      await service.classify(ctx);

      expect(analyzer.analyzeTranscript).toHaveBeenCalledWith(
        'Tell me about your pain points',
        activeFrameworks,
        'logistics_director',
        'first_discovery',
      );
    });

    it('should incorporate LLM framework relevance scores into composite scoring', async () => {
      const analyzer = createMockTranscriptAnalyzer({
        frameworkRelevance: {
          SevenStories: 0.95,
          Challenger: 0.3,
          ValueSelling: 0.1,
          MEDDICC: 0.05,
          RAIN: 0.05,
          GreatDemo: 0.02,
          SaaSBackwards: 0.02,
        },
        detectedFields: ['story'],
        suggestedFrameworks: ['SevenStories'],
        reasoning: 'Customer asking for case studies and success stories',
      });

      const service = new FrameworkClassifierService({
        useLlmClassification: true,
        transcriptAnalyzer: analyzer,
      });

      const ctx = createClassificationContext({
        recentTranscript: [
          createTranscriptSegment('Do you have any success stories from companies like ours?'),
        ],
        // Use negotiation stage where SevenStories is also weighted
        dealStage: 'negotiation',
        frameworkWeights: {
          dealStage: 'negotiation',
          weights: DEFAULT_FRAMEWORK_WEIGHTS['negotiation'],
        },
      });

      const result = await service.classify(ctx);

      // SevenStories should be strongly favored given both LLM and stage weights
      const topFrameworks = [result.primaryFramework, ...result.secondaryFrameworks];
      expect(topFrameworks).toContain('SevenStories');
    });

    it('should include detected fields in reasoning', async () => {
      const analyzer = createMockTranscriptAnalyzer({
        detectedFields: ['decision_criteria', 'stakeholder'],
        reasoning: 'Discussion about decision process',
        frameworkRelevance: { MEDDICC: 0.8 },
      });

      const service = new FrameworkClassifierService({
        useLlmClassification: true,
        transcriptAnalyzer: analyzer,
      });

      const ctx = createClassificationContext({
        recentTranscript: [createTranscriptSegment('Who makes the final decision?')],
      });

      const result = await service.classify(ctx);

      expect(result.reasoning).toContain('decision_criteria');
      expect(result.reasoning).toContain('stakeholder');
    });
  });

  describe('deal stage weighting (Requirement 28.2)', () => {
    it('should use provided FrameworkWeightingProfile when deal stages match', async () => {
      const service = new FrameworkClassifierService();
      const customWeights: FrameworkWeightingProfile = {
        dealStage: 'first_discovery',
        weights: {
          ValueSelling: 0.50,
          MEDDICC: 0.10,
          RAIN: 0.10,
          Challenger: 0.10,
          SevenStories: 0.10,
          GreatDemo: 0.05,
          SaaSBackwards: 0.05,
        },
      };

      const ctx = createClassificationContext({
        frameworkWeights: customWeights,
        dealStage: 'first_discovery',
      });

      const result = await service.classify(ctx);

      // With ValueSelling weighted at 0.50, it should be primary or secondary
      const topFrameworks = [result.primaryFramework, ...result.secondaryFrameworks];
      expect(topFrameworks).toContain('ValueSelling');
    });

    it('should fall back to DEFAULT_FRAMEWORK_WEIGHTS when profile deal stage does not match', async () => {
      const service = new FrameworkClassifierService();
      // Profile says "qualification" but context says "demo_proof"
      const mismatchedWeights: FrameworkWeightingProfile = {
        dealStage: 'qualification',
        weights: DEFAULT_FRAMEWORK_WEIGHTS['qualification'],
      };

      const ctx = createClassificationContext({
        frameworkWeights: mismatchedWeights,
        dealStage: 'demo_proof',
      });

      const result = await service.classify(ctx);

      // Should use demo_proof defaults (GreatDemo = 0.30)
      const topFrameworks = [result.primaryFramework, ...result.secondaryFrameworks];
      expect(topFrameworks).toContain('GreatDemo');
    });
  });

  describe('confidence scoring', () => {
    it('should return lower confidence when multiple frameworks score similarly', async () => {
      const service = new FrameworkClassifierService();
      // All frameworks active, no transcript keywords, no coverage gaps
      // Only deal stage and persona provide differentiation
      const ctx = createClassificationContext({
        recentTranscript: [],
        coverageGaps: [],
      });

      const result = await service.classify(ctx);

      // Without strong signals, confidence should be moderate (not near 1.0)
      expect(result.confidence).toBeLessThan(0.9);
    });

    it('should return higher confidence when one framework strongly dominates', async () => {
      const service = new FrameworkClassifierService();
      // Only one framework active — it must be the primary with full confidence
      const ctx = createClassificationContext({
        activeFrameworks: ['MEDDICC'],
      });

      const result = await service.classify(ctx);

      expect(result.primaryFramework).toBe('MEDDICC');
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('routing rationale', () => {
    it('should include deal stage information in reasoning when stage score is high', async () => {
      const service = new FrameworkClassifierService();
      const ctx = createClassificationContext({
        dealStage: 'demo_proof',
        frameworkWeights: {
          dealStage: 'demo_proof',
          weights: DEFAULT_FRAMEWORK_WEIGHTS['demo_proof'],
        },
      });

      const result = await service.classify(ctx);

      // Reasoning should reference the deal stage
      expect(result.reasoning.toLowerCase()).toMatch(/demo_proof|deal stage/);
    });

    it('should mention secondary frameworks in reasoning when present', async () => {
      const service = new FrameworkClassifierService();
      const ctx = createClassificationContext();

      const result = await service.classify(ctx);

      if (result.secondaryFrameworks.length > 0) {
        expect(result.reasoning.toLowerCase()).toContain('secondary');
      }
    });
  });
});
