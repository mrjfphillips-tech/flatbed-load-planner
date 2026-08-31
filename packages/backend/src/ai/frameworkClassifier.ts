/**
 * FrameworkClassifierService
 *
 * Determines which sales framework(s) are most relevant for the current
 * conversation context by combining:
 *   1. Deal stage weighting (from FrameworkWeightingProfile)
 *   2. Coverage gap analysis (frameworks addressing lowest-coverage fields get boosted)
 *   3. Transcript keyword/topic detection (rule-based or LLM-enhanced)
 *   4. Buyer persona affinity
 *
 * Implements the FrameworkClassifier interface from shared/interfaces/services.ts.
 * The LLM call is abstracted behind the TranscriptAnalyzer interface so it can be
 * mocked in tests or swapped for different providers.
 *
 * Requirements: 3.1, 28.2
 */

import type {
  FrameworkClassifier,
} from '@ptv-discovery-coach/shared';

import type {
  ClassificationContext,
  FrameworkRouting,
  CoverageGap,
} from '@ptv-discovery-coach/shared';

import type {
  Framework,
  BuyerPersona,
  CanonicalField,
  DealStage,
  FrameworkWeightingProfile,
} from '@ptv-discovery-coach/shared';

import {
  DEFAULT_FRAMEWORK_WEIGHTS,
  FRAMEWORKS,
} from '@ptv-discovery-coach/shared';

// ─── LLM Abstraction Interface ────────────────────────────────────────────────

/**
 * Represents the result of LLM-based transcript analysis.
 * Identifies which canonical fields are being discussed and relevant frameworks.
 */
export interface TranscriptAnalysisResult {
  /** Canonical fields detected as being discussed in the transcript */
  detectedFields: CanonicalField[];
  /** Frameworks suggested by the LLM based on transcript content */
  suggestedFrameworks: Framework[];
  /** Per-framework relevance scores from the LLM (0-1) */
  frameworkRelevance: Partial<Record<Framework, number>>;
  /** Raw reasoning from the LLM */
  reasoning: string;
}

/**
 * Abstract interface for transcript analysis via LLM.
 * Implementations can use Azure OpenAI, local models, or any other LLM provider.
 * This abstraction allows mocking in tests and swapping providers without
 * changing the classifier logic.
 */
export interface TranscriptAnalyzer {
  /**
   * Analyze recent transcript content to identify which canonical fields are being
   * discussed and which frameworks are most relevant.
   */
  analyzeTranscript(
    transcriptText: string,
    activeFrameworks: Framework[],
    buyerPersona: BuyerPersona,
    dealStage: DealStage,
  ): Promise<TranscriptAnalysisResult>;
}

// ─── Keyword-to-Framework Mapping ─────────────────────────────────────────────

/**
 * Maps transcript keywords/topics to the frameworks they indicate relevance for.
 * Used in rule-based classification to detect conversational signals.
 */
const KEYWORD_FRAMEWORK_MAP: Record<string, Framework[]> = {
  // ValueSelling keywords
  'roi': ['ValueSelling'],
  'return on investment': ['ValueSelling'],
  'business case': ['ValueSelling'],
  'value': ['ValueSelling'],
  'cost savings': ['ValueSelling'],
  'payback': ['ValueSelling'],
  'total cost': ['ValueSelling'],
  'tco': ['ValueSelling'],
  'financial impact': ['ValueSelling'],
  'budget justification': ['ValueSelling'],

  // MEDDICC keywords
  'decision': ['MEDDICC'],
  'decision maker': ['MEDDICC'],
  'decision process': ['MEDDICC'],
  'approval': ['MEDDICC'],
  'champion': ['MEDDICC'],
  'competition': ['MEDDICC'],
  'competitor': ['MEDDICC'],
  'metrics': ['MEDDICC'],
  'kpi': ['MEDDICC'],
  'economic buyer': ['MEDDICC'],
  'procurement': ['MEDDICC'],
  'evaluation': ['MEDDICC'],

  // RAIN keywords
  'aspiration': ['RAIN'],
  'affliction': ['RAIN'],
  'impact': ['RAIN', 'ValueSelling'],
  'new reality': ['RAIN'],
  'listen': ['RAIN'],
  'rapport': ['RAIN'],
  'empathy': ['RAIN'],
  'discovery question': ['RAIN'],

  // Challenger keywords
  'insight': ['Challenger'],
  'commercial insight': ['Challenger'],
  'reframe': ['Challenger'],
  'teach': ['Challenger'],
  'tailor': ['Challenger'],
  'tension': ['Challenger'],
  'provoke': ['Challenger'],
  'disrupt': ['Challenger'],
  'status quo': ['Challenger'],
  'constructive tension': ['Challenger'],

  // SevenStories keywords
  'story': ['SevenStories'],
  'case study': ['SevenStories'],
  'use case': ['SevenStories'],
  'example': ['SevenStories'],
  'similar company': ['SevenStories'],
  'reference': ['SevenStories'],
  'testimonial': ['SevenStories'],
  'success story': ['SevenStories'],
  'negotiation': ['SevenStories'],

  // GreatDemo keywords
  'demo': ['GreatDemo'],
  'demonstration': ['GreatDemo'],
  'show me': ['GreatDemo'],
  'proof': ['GreatDemo', 'SaaSBackwards'],
  'see it in action': ['GreatDemo'],
  'illustration': ['GreatDemo'],
  'peel back': ['GreatDemo'],
  'last thing first': ['GreatDemo'],

  // SaaSBackwards keywords
  'desired outcome': ['SaaSBackwards'],
  'must believe': ['SaaSBackwards'],
  'proof sequence': ['SaaSBackwards'],
  'backward': ['SaaSBackwards'],
  'end state': ['SaaSBackwards'],
  'ideal solution': ['SaaSBackwards'],

  // Pricing triggers (multiple frameworks)
  'price': ['ValueSelling', 'SevenStories'],
  'pricing': ['ValueSelling', 'SevenStories'],
  'cost': ['ValueSelling'],
  'expensive': ['ValueSelling', 'Challenger'],
};

// ─── Canonical Field to Framework Mapping ─────────────────────────────────────

/**
 * Maps canonical fields to the frameworks best suited to address them.
 * Used for coverage gap-based boosting.
 */
const CANONICAL_FIELD_FRAMEWORK_AFFINITY: Record<CanonicalField, Framework[]> = {
  pain: ['ValueSelling', 'MEDDICC', 'RAIN'],
  value_metric: ['ValueSelling', 'MEDDICC', 'SaaSBackwards'],
  stakeholder: ['MEDDICC', 'Challenger'],
  decision_criteria: ['MEDDICC', 'ValueSelling'],
  story: ['SevenStories', 'GreatDemo'],
  demo_proof: ['GreatDemo', 'SaaSBackwards'],
  next_step_commitment: ['RAIN', 'Challenger', 'MEDDICC'],
};

// ─── Buyer Persona to Framework Affinity ──────────────────────────────────────

/**
 * Maps buyer personas to frameworks that resonate best with them.
 */
const PERSONA_FRAMEWORK_AFFINITY: Record<BuyerPersona, Framework[]> = {
  fleet_manager: ['RAIN', 'SevenStories', 'GreatDemo'],
  logistics_director: ['ValueSelling', 'MEDDICC', 'Challenger'],
  supply_chain_vp: ['Challenger', 'ValueSelling', 'MEDDICC'],
  it_architect: ['GreatDemo', 'SaaSBackwards', 'ValueSelling'],
  operations_analyst: ['RAIN', 'GreatDemo', 'SaaSBackwards'],
};

// ─── Score Weights for Classification Factors ─────────────────────────────────

const CLASSIFICATION_WEIGHTS = {
  dealStageWeight: 0.35,
  coverageGapWeight: 0.30,
  transcriptKeywordWeight: 0.20,
  personaAffinityWeight: 0.15,
} as const;

// ─── Service Implementation ───────────────────────────────────────────────────

export interface FrameworkClassifierServiceOptions {
  /** Optional TranscriptAnalyzer for LLM-enhanced classification */
  transcriptAnalyzer?: TranscriptAnalyzer;
  /** Whether to use LLM-based classification (default: false, use rule-based) */
  useLlmClassification?: boolean;
}

export class FrameworkClassifierService implements FrameworkClassifier {
  private readonly useLlm: boolean;
  private readonly transcriptAnalyzer?: TranscriptAnalyzer;

  constructor(options: FrameworkClassifierServiceOptions = {}) {
    this.useLlm = options.useLlmClassification ?? false;
    this.transcriptAnalyzer = options.transcriptAnalyzer;
  }

  /**
   * Classify the current conversation context to determine the most relevant
   * framework(s) for routing questions and guidance.
   *
   * Combines deal stage weighting, coverage gap analysis, transcript keyword
   * detection, and buyer persona affinity into a composite score per framework.
   *
   * When LLM classification is enabled and a TranscriptAnalyzer is provided,
   * uses LLM-enhanced transcript analysis for more accurate field detection.
   */
  async classify(ctx: ClassificationContext): Promise<FrameworkRouting> {
    if (this.useLlm && this.transcriptAnalyzer) {
      return this.classifyWithLlm(ctx);
    }

    return this.classifyRuleBased(ctx);
  }

  /**
   * LLM-enhanced classifier: uses the TranscriptAnalyzer to identify which
   * canonical fields are being discussed, then combines that signal with
   * deal stage weights, coverage gaps, and persona affinity.
   */
  private async classifyWithLlm(ctx: ClassificationContext): Promise<FrameworkRouting> {
    const {
      recentTranscript,
      coverageGaps,
      buyerPersona,
      dealStage,
      frameworkWeights,
      activeFrameworks,
    } = ctx;

    const frameworksToScore = activeFrameworks.length > 0
      ? activeFrameworks
      : FRAMEWORKS;

    // Get LLM analysis of transcript content
    const transcriptText = recentTranscript.map((seg) => seg.text).join(' ');
    const llmResult = await this.transcriptAnalyzer!.analyzeTranscript(
      transcriptText,
      frameworksToScore,
      buyerPersona,
      dealStage,
    );

    // 1. Deal stage weighting scores
    const dealStageScores = this.computeDealStageScores(
      frameworksToScore,
      dealStage,
      frameworkWeights,
    );

    // 2. Coverage gap scores — boost frameworks addressing detected fields from LLM
    const coverageGapScores = this.computeCoverageGapScores(
      frameworksToScore,
      coverageGaps,
    );

    // 3. LLM-based transcript relevance scores (replaces keyword matching)
    const llmScores = new Map<Framework, number>();
    for (const fw of frameworksToScore) {
      llmScores.set(fw, llmResult.frameworkRelevance[fw] ?? 0);
    }

    // 4. Persona affinity scores
    const personaScores = this.computePersonaScores(frameworksToScore, buyerPersona);

    // Combine scores with configured weights
    const compositeScores = new Map<Framework, number>();
    for (const fw of frameworksToScore) {
      const composite =
        (dealStageScores.get(fw) ?? 0) * CLASSIFICATION_WEIGHTS.dealStageWeight +
        (coverageGapScores.get(fw) ?? 0) * CLASSIFICATION_WEIGHTS.coverageGapWeight +
        (llmScores.get(fw) ?? 0) * CLASSIFICATION_WEIGHTS.transcriptKeywordWeight +
        (personaScores.get(fw) ?? 0) * CLASSIFICATION_WEIGHTS.personaAffinityWeight;

      compositeScores.set(fw, composite);
    }

    // Sort frameworks by composite score descending
    const ranked = [...compositeScores.entries()]
      .sort((a, b) => b[1] - a[1]);

    const primaryFramework = ranked[0][0];
    const primaryScore = ranked[0][1];

    // Select up to 2 secondary frameworks (score must be at least 50% of primary)
    const secondaryFrameworks = ranked
      .slice(1)
      .filter(([, score]) => score >= primaryScore * 0.5)
      .slice(0, 2)
      .map(([fw]) => fw);

    const confidence = this.computeConfidence(ranked);

    // Build reasoning using LLM insights
    const reasoningParts: string[] = [];
    if (llmResult.reasoning) {
      reasoningParts.push(llmResult.reasoning);
    }
    if (llmResult.detectedFields.length > 0) {
      reasoningParts.push(`detected fields: ${llmResult.detectedFields.join(', ')}`);
    }
    reasoningParts.push(
      `deal stage '${dealStage}' weights favor ${primaryFramework}`,
    );
    if (secondaryFrameworks.length > 0) {
      reasoningParts.push(
        `secondary frameworks ${secondaryFrameworks.join(', ')} provide complementary coverage`,
      );
    }

    return {
      primaryFramework,
      secondaryFrameworks,
      confidence,
      reasoning: reasoningParts.join('; ') + '.',
    };
  }

  /**
   * Rule-based classifier: the primary classification path.
   * Computes a weighted composite score for each framework in the active set.
   */
  private classifyRuleBased(ctx: ClassificationContext): FrameworkRouting {
    const {
      recentTranscript,
      coverageGaps,
      buyerPersona,
      dealStage,
      frameworkWeights,
      activeFrameworks,
    } = ctx;

    // Only score frameworks that are in the active set
    const frameworksToScore = activeFrameworks.length > 0
      ? activeFrameworks
      : FRAMEWORKS;

    // 1. Deal stage weighting scores
    const dealStageScores = this.computeDealStageScores(
      frameworksToScore,
      dealStage,
      frameworkWeights,
    );

    // 2. Coverage gap scores
    const coverageGapScores = this.computeCoverageGapScores(
      frameworksToScore,
      coverageGaps,
    );

    // 3. Transcript keyword scores
    const transcriptText = recentTranscript
      .map((seg) => seg.text)
      .join(' ')
      .toLowerCase();
    const keywordScores = this.computeKeywordScores(frameworksToScore, transcriptText);

    // 4. Persona affinity scores
    const personaScores = this.computePersonaScores(frameworksToScore, buyerPersona);

    // Combine scores with configured weights
    const compositeScores = new Map<Framework, number>();
    for (const fw of frameworksToScore) {
      const composite =
        (dealStageScores.get(fw) ?? 0) * CLASSIFICATION_WEIGHTS.dealStageWeight +
        (coverageGapScores.get(fw) ?? 0) * CLASSIFICATION_WEIGHTS.coverageGapWeight +
        (keywordScores.get(fw) ?? 0) * CLASSIFICATION_WEIGHTS.transcriptKeywordWeight +
        (personaScores.get(fw) ?? 0) * CLASSIFICATION_WEIGHTS.personaAffinityWeight;

      compositeScores.set(fw, composite);
    }

    // Sort frameworks by composite score descending
    const ranked = [...compositeScores.entries()]
      .sort((a, b) => b[1] - a[1]);

    const primaryFramework = ranked[0][0];
    const primaryScore = ranked[0][1];

    // Select up to 2 secondary frameworks (score must be at least 50% of primary)
    const secondaryFrameworks = ranked
      .slice(1)
      .filter(([, score]) => score >= primaryScore * 0.5)
      .slice(0, 2)
      .map(([fw]) => fw);

    // Confidence: normalized based on how dominant the primary is
    const confidence = this.computeConfidence(ranked);

    // Build reasoning string
    const reasoning = this.buildReasoning(
      primaryFramework,
      secondaryFrameworks,
      dealStage,
      buyerPersona,
      dealStageScores,
      coverageGapScores,
      keywordScores,
      personaScores,
    );

    return {
      primaryFramework,
      secondaryFrameworks,
      confidence,
      reasoning,
    };
  }

  // ─── Factor Scoring Methods ───────────────────────────────────────────────

  /**
   * Score frameworks based on deal stage weighting profile.
   * Uses the provided FrameworkWeightingProfile or falls back to defaults.
   */
  private computeDealStageScores(
    frameworks: Framework[],
    dealStage: DealStage,
    weightingProfile: FrameworkWeightingProfile,
  ): Map<Framework, number> {
    const scores = new Map<Framework, number>();

    // Use provided weights if they match the deal stage, otherwise use defaults
    const weights = weightingProfile.dealStage === dealStage
      ? weightingProfile.weights
      : DEFAULT_FRAMEWORK_WEIGHTS[dealStage];

    for (const fw of frameworks) {
      // Normalize to 0-1 range (weights already sum to ~1.0, max single weight ~0.30)
      const rawWeight = weights[fw] ?? 0;
      // Scale up so max weight (~0.30) maps to ~1.0
      scores.set(fw, Math.min(rawWeight / 0.30, 1.0));
    }

    return scores;
  }

  /**
   * Score frameworks based on coverage gap analysis.
   * Frameworks that can address the largest/deepest gaps get higher scores.
   */
  private computeCoverageGapScores(
    frameworks: Framework[],
    coverageGaps: CoverageGap[],
  ): Map<Framework, number> {
    const scores = new Map<Framework, number>();

    // Initialize all to zero
    for (const fw of frameworks) {
      scores.set(fw, 0);
    }

    if (coverageGaps.length === 0) return scores;

    // For each gap, boost frameworks that address that canonical field
    for (const gap of coverageGaps) {
      const gapSeverity = Math.max(0, (gap.targetScore - gap.currentScore) / gap.targetScore);

      if (gap.fieldType === 'canonical') {
        const canonicalField = gap.field as CanonicalField;
        const affinityFrameworks = CANONICAL_FIELD_FRAMEWORK_AFFINITY[canonicalField] ?? [];

        for (const fw of affinityFrameworks) {
          if (frameworks.includes(fw)) {
            const current = scores.get(fw) ?? 0;
            scores.set(fw, current + gapSeverity);
          }
        }
      } else if (gap.framework && frameworks.includes(gap.framework)) {
        // Framework-native gap: boost the owning framework
        const current = scores.get(gap.framework) ?? 0;
        scores.set(gap.framework, current + gapSeverity);
      }
    }

    // Normalize scores to 0-1 range
    const maxScore = Math.max(...scores.values(), 0.001);
    for (const fw of frameworks) {
      scores.set(fw, (scores.get(fw) ?? 0) / maxScore);
    }

    return scores;
  }

  /**
   * Score frameworks based on keyword/topic detection in recent transcript.
   */
  private computeKeywordScores(
    frameworks: Framework[],
    transcriptText: string,
  ): Map<Framework, number> {
    const scores = new Map<Framework, number>();

    for (const fw of frameworks) {
      scores.set(fw, 0);
    }

    if (!transcriptText.trim()) return scores;

    // Count keyword hits per framework
    for (const [keyword, associatedFrameworks] of Object.entries(KEYWORD_FRAMEWORK_MAP)) {
      if (transcriptText.includes(keyword)) {
        for (const fw of associatedFrameworks) {
          if (frameworks.includes(fw)) {
            const current = scores.get(fw) ?? 0;
            scores.set(fw, current + 1);
          }
        }
      }
    }

    // Normalize to 0-1 range
    const maxScore = Math.max(...scores.values(), 0.001);
    for (const fw of frameworks) {
      scores.set(fw, (scores.get(fw) ?? 0) / maxScore);
    }

    return scores;
  }

  /**
   * Score frameworks based on buyer persona affinity.
   */
  private computePersonaScores(
    frameworks: Framework[],
    buyerPersona: BuyerPersona,
  ): Map<Framework, number> {
    const scores = new Map<Framework, number>();
    const affinityList = PERSONA_FRAMEWORK_AFFINITY[buyerPersona] ?? [];

    for (const fw of frameworks) {
      const affinityIndex = affinityList.indexOf(fw);
      if (affinityIndex >= 0) {
        // First in list gets highest score, descending
        scores.set(fw, 1.0 - (affinityIndex * 0.25));
      } else {
        scores.set(fw, 0);
      }
    }

    return scores;
  }

  // ─── Confidence Computation ─────────────────────────────────────────────────

  /**
   * Compute confidence score (0-1) based on how dominant the primary framework is.
   * High confidence = primary clearly stands out from the rest.
   * Low confidence = multiple frameworks score similarly.
   */
  private computeConfidence(ranked: [Framework, number][]): number {
    if (ranked.length <= 1) return 1.0;

    const primaryScore = ranked[0][1];
    const secondScore = ranked[1][1];

    if (primaryScore === 0) return 0;

    // Confidence based on the gap between primary and secondary
    const gap = (primaryScore - secondScore) / primaryScore;

    // Also factor in absolute primary score
    const absoluteConfidence = Math.min(primaryScore, 1.0);

    // Weighted combination: gap dominance (60%) + absolute strength (40%)
    const confidence = gap * 0.6 + absoluteConfidence * 0.4;

    return Math.max(0, Math.min(1, confidence));
  }

  // ─── Reasoning Builder ──────────────────────────────────────────────────────

  /**
   * Build a human-readable reasoning string explaining the routing decision.
   */
  private buildReasoning(
    primary: Framework,
    secondaries: Framework[],
    dealStage: DealStage,
    buyerPersona: BuyerPersona,
    dealStageScores: Map<Framework, number>,
    coverageGapScores: Map<Framework, number>,
    keywordScores: Map<Framework, number>,
    personaScores: Map<Framework, number>,
  ): string {
    const parts: string[] = [];

    // Deal stage contribution
    const stageScore = dealStageScores.get(primary) ?? 0;
    if (stageScore > 0.5) {
      parts.push(`${primary} is strongly weighted for the '${dealStage}' deal stage`);
    }

    // Coverage gap contribution
    const gapScore = coverageGapScores.get(primary) ?? 0;
    if (gapScore > 0.5) {
      parts.push(`${primary} addresses the most significant coverage gaps`);
    }

    // Keyword contribution
    const kwScore = keywordScores.get(primary) ?? 0;
    if (kwScore > 0.5) {
      parts.push(`transcript keywords strongly signal ${primary} relevance`);
    }

    // Persona contribution
    const pScore = personaScores.get(primary) ?? 0;
    if (pScore > 0.5) {
      parts.push(`${buyerPersona} persona has high affinity with ${primary}`);
    }

    if (parts.length === 0) {
      parts.push(`${primary} has the highest composite score across all classification factors`);
    }

    if (secondaries.length > 0) {
      parts.push(`secondary frameworks ${secondaries.join(', ')} provide complementary coverage`);
    }

    return parts.join('; ') + '.';
  }
}
