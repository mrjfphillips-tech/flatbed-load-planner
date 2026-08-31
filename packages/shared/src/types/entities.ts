// ─── Entity Interfaces (Data Models) ──────────────────────────────────────────
// Requirements: 7.1, 7.2, 7.3

import type {
  BuyerPersona,
  CanonicalField,
  DealStage,
  Framework,
  IngestionStatus,
  ObjectionType,
  SupportedMimeType,
  UserRole,
} from './framework';
import type { EvaluationIssue } from './evaluation';

// ─── Session Status ───────────────────────────────────────────────────────────

/**
 * Session status tracking.
 */
export type SessionStatus = 'active' | 'completed' | 'interrupted' | 'offline_recovery';

/**
 * Experiment status lifecycle.
 */
export type ExperimentStatus = 'draft' | 'active' | 'stopped' | 'completed';

/**
 * Licensing types for source documents.
 */
export type LicensingType = 'proprietary' | 'creative_commons' | 'fair_use' | 'internal_only';

/**
 * Question event types in session logging.
 */
export type QuestionEventType = 'suggested' | 'accepted' | 'skipped' | 'dismissed';

/**
 * Outcome signal from closed deals.
 */
export type DealOutcome = 'won' | 'lost';

// ─── Core Entities ────────────────────────────────────────────────────────────

/**
 * A customer record grouping one or more Sessions.
 */
export interface Account {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A single recorded and transcribed discovery call tied to a specific customer account.
 */
export interface Session {
  id: string;
  accountId: string;
  repId: string;
  dealStage: DealStage;
  status: SessionStatus;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  isOfflineRecovery: boolean;
  preCallPlanId?: string;
  experimentAssignmentId?: string;
  createdAt: Date;
}

/**
 * An individual person associated with an Account.
 */
export interface Contact {
  id: string;
  accountId: string;
  fullName: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  address?: string;
  linkedInUrl?: string;
  buyerPersona?: BuyerPersona;
  businessCardImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Questions ────────────────────────────────────────────────────────────────

/**
 * A discovery question in the Question Bank, mapped to frameworks and elements.
 */
export interface Question {
  id: string;
  text: string;
  framework: Framework;
  canonicalField?: CanonicalField;
  frameworkNativeField?: string;
  buyerPersona?: BuyerPersona;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A question that a Rep has marked as preferred.
 */
export interface PreferredQuestion {
  id: string;
  repId: string;
  questionId: string;
  framework: Framework;
  createdAt: Date;
}

// ─── Source Documents ─────────────────────────────────────────────────────────

/**
 * Any ingested content item (PDF, book chapter, training deck, etc.).
 */
export interface SourceDocument {
  id: string;
  title: string;
  author?: string;
  frameworkAffiliation: Framework[];
  mimeType: SupportedMimeType;
  fileUrl: string;
  pageCount?: number;
  rightsProfileId: string;
  ingestionStatus: IngestionStatus;
  ingestedAt?: Date;
  createdAt: Date;
}

/**
 * Metadata specifying licensing terms, access restrictions, and attribution requirements.
 */
export interface RightsProfile {
  id: string;
  licensingType: LicensingType;
  permittedRoles: UserRole[];
  permittedTeams: string[];
  attributionText?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A content chunk from an ingested document, stored for retrieval.
 */
export interface Chunk {
  id: string;
  sourceDocumentId: string;
  chunkIndex: number;
  content: string;
  canonicalFields: CanonicalField[];
  frameworkNativeFields: string[];
  sectionTitle?: string;
  pageNumber?: number;
  embedding?: Float32Array;
  version: number;
  createdAt: Date;
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

/**
 * Persisted evaluation record for an AI response.
 */
export interface EvaluationRecord {
  id: string;
  sessionId: string;
  responseId: string;
  factuality: number;
  groundedness: number;
  citationQuality: number;
  latencyMs: number;
  tokenCost: number;
  passesThreshold: boolean;
  issues: EvaluationIssue[];
  evaluatedAt: Date;
}

// ─── Experiments ──────────────────────────────────────────────────────────────

/**
 * An A/B test configuration.
 */
export interface Experiment {
  id: string;
  name: string;
  description?: string;
  controlStrategy: RoutingStrategy;
  treatmentStrategy: RoutingStrategy;
  targetPopulation: TargetPopulation;
  durationDays: number;
  significanceThreshold: number;
  status: ExperimentStatus;
  startedAt?: Date;
  endedAt?: Date;
  createdAt: Date;
}

/**
 * A routing strategy for an experiment group.
 */
export interface RoutingStrategy {
  frameworkWeights: Partial<Record<Framework, number>>;
  description: string;
}

/**
 * Target population for an experiment.
 */
export interface TargetPopulation {
  type: 'all_reps' | 'specific_teams' | 'specific_reps';
  teamIds?: string[];
  repIds?: string[];
}

/**
 * Assignment of a session to an experiment group.
 */
export interface ExperimentAssignment {
  id: string;
  experimentId: string;
  sessionId: string;
  repId: string;
  groupName: 'control' | 'treatment';
  createdAt: Date;
}

// ─── Rep Performance ──────────────────────────────────────────────────────────

/**
 * Aggregated performance metrics for a Rep over a time period.
 */
export interface RepPerformanceMetrics {
  id: string;
  repId: string;
  periodStart: Date;
  periodEnd: Date;
  frameworkUsage: Partial<Record<Framework, number>>;
  avgIntentScores: Partial<Record<Framework, number>>;
  coverageVelocityMinutes: number;
  talkTimeRatio: number;
  questionAcceptanceRate: number;
  objectionHandlingScore: number;
  createdAt: Date;
}

// ─── Pre-Call Plan ────────────────────────────────────────────────────────────

/**
 * A suggested call plan generated before a Session starts.
 */
export interface PreCallPlan {
  id: string;
  accountId: string;
  repId: string;
  attendees: PreCallAttendee[];
  dealStage: DealStage;
  topics: PrioritizedTopic[];
  notes?: string;
  generatedPlan?: GeneratedPlan;
  repModifiedPlan?: GeneratedPlan;
  createdAt: Date;
}

/**
 * An attendee in a pre-call plan.
 */
export interface PreCallAttendee {
  contactId: string;
  buyerPersona: BuyerPersona;
}

/**
 * A prioritized topic for a call plan.
 */
export interface PrioritizedTopic {
  topic: string;
  priority: number;
  canonicalField?: CanonicalField;
  framework?: Framework;
}

/**
 * AI-generated plan content.
 */
export interface GeneratedPlan {
  openingQuestions: string[];
  frameworkEmphasis: Framework[];
  coverageTargets: Partial<Record<CanonicalField, number>>;
  suggestedDuration: number;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

/**
 * An auto-generated, editable document produced at the end of a Session.
 */
export interface Summary {
  id: string;
  sessionId: string;
  aiGenerated: string;
  repEdited?: string;
  coverageSnapshot: CoverageMap;
  keyFindings: KeyFinding[];
  actionItems: ActionItem[];
  nextSteps: string[];
  frameworkContributions: Partial<Record<Framework, string>>;
  generatedAt: Date;
  lastEditedAt?: Date;
}

/**
 * A key finding from a session summary.
 */
export interface KeyFinding {
  canonicalField: CanonicalField;
  finding: string;
  sourceFramework: Framework;
  confidence: number;
}

/**
 * An action item from a session summary.
 */
export interface ActionItem {
  description: string;
  assignedTo?: string;
  dueDate?: Date;
  framework?: Framework;
}

// ─── Coverage ─────────────────────────────────────────────────────────────────

/**
 * Map of coverage scores across canonical and framework-native fields.
 */
export interface CoverageMap {
  canonical: Record<CanonicalField, number>;
  frameworkNative: Record<string, number>;
  lastUpdated: Date;
}

// ─── Events ───────────────────────────────────────────────────────────────────

/**
 * A question event logged during a session.
 */
export interface QuestionEvent {
  id: string;
  sessionId: string;
  questionId: string;
  eventType: QuestionEventType;
  framework: Framework;
  intentScore?: number;
  timestamp: Date;
}

/**
 * An objection event detected and logged during a session.
 */
export interface ObjectionEvent {
  id: string;
  sessionId: string;
  objectionType: ObjectionType;
  triggerText: string;
  responseStrategy?: string;
  frameworkAttribution?: Framework;
  effectivenessScore?: number;
  detectedAt: Date;
  createdAt: Date;
}

// ─── Outcome Signals ──────────────────────────────────────────────────────────

/**
 * A closed-deal result imported from the connected CRM.
 */
export interface OutcomeSignal {
  id: string;
  accountId: string;
  outcome: DealOutcome;
  dealSize?: number;
  closeDate?: Date;
  sourceCrm?: string;
  externalDealId?: string;
  importedAt: Date;
}
