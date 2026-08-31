// ─── AI Engine Types ──────────────────────────────────────────────────────────
// Requirements: 7.1, 7.2, 7.3

import type {
  BuyerPersona,
  CanonicalField,
  ConflictResolutionPolicy,
  DealStage,
  Framework,
  FrameworkWeightingProfile,
  ObjectionType,
} from './framework';
import type { TranscriptSegment } from './audio';
import type { ExperimentAssignment } from './entities';
import type { RankedPassage, Citation } from './retrieval';

// ─── Framework Classifier Types ───────────────────────────────────────────────

/**
 * Input context for the Framework Classifier to determine relevant frameworks.
 */
export interface ClassificationContext {
  recentTranscript: TranscriptSegment[];
  coverageGaps: CoverageGap[];
  buyerPersona: BuyerPersona;
  dealStage: DealStage;
  frameworkWeights: FrameworkWeightingProfile;
  activeFrameworks: Framework[];
}

/**
 * Result of framework classification — routes queries to appropriate frameworks.
 */
export interface FrameworkRouting {
  primaryFramework: Framework;
  secondaryFrameworks: Framework[];
  confidence: number;
  reasoning: string;
}

// ─── Guidance Types ───────────────────────────────────────────────────────────

/**
 * A request for guidance from the Expert Panel.
 */
export interface GuidanceRequest {
  routing: FrameworkRouting;
  sessionContext: SessionContext;
  retrievedPassages: RankedPassage[];
}

/**
 * A streaming token of guidance from the Expert Panel.
 */
export interface GuidanceToken {
  token: string;
  sourceFramework?: Framework;
  citationRef?: string;
  isComplete: boolean;
}

/**
 * Guidance from a single framework.
 */
export interface FrameworkGuidance {
  framework: Framework;
  guidance: string;
  confidence: number;
  citations: Citation[];
}

/**
 * Resolved guidance after conflict resolution between frameworks.
 */
export interface ResolvedGuidance {
  resolvedText: string;
  policy: ConflictResolutionPolicy;
  contributions: FrameworkGuidance[];
  conflictDetected: boolean;
}

// ─── Conflict Resolution ──────────────────────────────────────────────────────

/**
 * Logged record of a framework conflict and its resolution.
 */
export interface ConflictResolution {
  id: string;
  sessionId: string;
  conflictingFrameworks: Framework[];
  resolutionPolicy: ConflictResolutionPolicy;
  repChoice?: Framework;
  contextSummary?: string;
  createdAt: Date;
}

// ─── Intent Scoring ───────────────────────────────────────────────────────────

/**
 * Context for evaluating question intent.
 */
export interface IntentScoringContext {
  questionId: string;
  questionText: string;
  targetField: CanonicalField | string;
  responseSegments: TranscriptSegment[];
}

/**
 * Score reflecting whether the intent of a question was achieved.
 */
export interface QuestionIntentScore {
  questionId: string;
  score: number;
  isMet: boolean;
  reasoning: string;
  followUpNeeded: boolean;
  evaluatedAt: Date;
}

// ─── Coverage Types ───────────────────────────────────────────────────────────

/**
 * Map of coverage scores across canonical and framework-native fields.
 */
export interface CoverageScoreMap {
  canonical: Record<CanonicalField, number>;
  frameworkNative: Record<string, number>;
  lastUpdated: Date;
}

/**
 * A gap in coverage relative to target thresholds.
 */
export interface CoverageGap {
  field: CanonicalField | string;
  fieldType: 'canonical' | 'framework_native';
  currentScore: number;
  targetScore: number;
  framework?: Framework;
}

/**
 * Recommendation about stakeholders who could help fill coverage gaps.
 */
export interface StakeholderRecommendation {
  buyerPersona: BuyerPersona;
  relevantFields: CanonicalField[];
  rationale: string;
  priority: number;
}

// ─── Objection Detection ──────────────────────────────────────────────────────

/**
 * A detected objection from the customer during a session.
 */
export interface ObjectionDetection {
  type: ObjectionType;
  confidence: number;
  triggerText: string;
  timestamp: number;
}

// ─── Session Context (AI Engine) ──────────────────────────────────────────────

/**
 * Full session context used by the AI Engine for coaching decisions.
 */
export interface SessionContext {
  sessionId: string;
  accountId: string;
  repId: string;
  activeFrameworks: Framework[];
  dealStage: DealStage;
  currentCoverage: CoverageScoreMap;
  buyerPersonas: BuyerPersona[];
  preferredQuestions: string[];
  experimentGroup?: ExperimentAssignment;
}
