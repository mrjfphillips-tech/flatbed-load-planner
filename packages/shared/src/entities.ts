// ─── Entity Interfaces (Data Models) ──────────────────────────────────────────
// Requirements: 7.1, 7.2, 7.3

import type {
  BuyerPersona,
  CanonicalField,
  ConflictResolutionPolicy,
  DealOutcome,
  DealStage,
  ExperimentStatus,
  ExportPlatform,
  Framework,
  IngestionStatus,
  LicensingType,
  ObjectionType,
  QuestionEventType,
  SessionStatus,
  SpeakerLabel,
  SupportedMimeType,
  TranscriptSource,
  UserRole,
} from './enums';

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface Account {
  id: string;
  name: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

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

// ─── Canonical Ontology ───────────────────────────────────────────────────────

export interface CrosswalkMapping {
  id: string;
  framework: Framework;
  nativeField: string;
  canonicalField: CanonicalField;
  description?: string;
}

export interface FrameworkNativeField {
  name: string;
  framework: Framework;
  description?: string;
}

// ─── Questions ────────────────────────────────────────────────────────────────

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

export interface PreferredQuestion {
  id: string;
  repId: string;
  questionId: string;
  framework: Framework;
  createdAt: Date;
}

// ─── Transcript ───────────────────────────────────────────────────────────────

export interface TranscriptSegment {
  id: string;
  sessionId: string;
  speaker: SpeakerLabel;
  text: string;
  startTimeMs: number;
  endTimeMs: number;
  confidence: number;
  source: TranscriptSource;
  createdAt: Date;
}

export interface FinalTranscript {
  sessionId: string;
  segments: TranscriptSegment[];
  durationMs: number;
  speakerCount: number;
}

// ─── Coverage ─────────────────────────────────────────────────────────────────

export interface CoverageSnapshot {
  id: string;
  sessionId: string;
  fieldType: 'canonical' | 'framework_native';
  fieldName: string;
  framework?: Framework;
  score: number;
  snapshotAt: Date;
}

export interface CoverageMap {
  canonical: Record<CanonicalField, number>;
  frameworkNative: Record<string, number>;
  lastUpdated: Date;
}

export interface CoverageGap {
  field: CanonicalField | string;
  fieldType: 'canonical' | 'framework_native';
  currentScore: number;
  targetScore: number;
  framework?: Framework;
}

// ─── Source Documents & Retrieval ─────────────────────────────────────────────

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

export interface RightsProfile {
  id: string;
  licensingType: LicensingType;
  permittedRoles: UserRole[];
  permittedTeams: string[];
  attributionText?: string;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface ContentChunk {
  id: string;
  sourceDocumentId: string;
  chunkIndex: number;
  content: string;
  canonicalFields: CanonicalField[];
  frameworkNativeFields: string[];
  sectionTitle?: string;
  pageNumber?: number;
  version: number;
}

export interface SourceDocumentRef {
  id: string;
  title: string;
  author?: string;
  framework: Framework;
}

export interface Citation {
  documentTitle: string;
  framework: Framework;
  sectionTitle?: string;
  pageNumber?: number;
  passageId: string;
}

export interface RankedPassage {
  id: string;
  content: string;
  sourceDocument: SourceDocumentRef;
  framework: Framework;
  canonicalFields: CanonicalField[];
  score: number;
  citation: Citation;
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

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

export interface EvaluationIssue {
  type: 'factuality' | 'groundedness' | 'citation' | 'safety';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface EvaluationResult {
  factuality: number;
  groundedness: number;
  citationQuality: number;
  latencyMs: number;
  tokenCost: number;
  passesThreshold: boolean;
  issues: EvaluationIssue[];
}

export interface SafetyResult {
  safe: boolean;
  flaggedCategories: string[];
  confidence: number;
}

export interface ResponseMetrics {
  sessionId: string;
  responseId: string;
  latencyMs: number;
  tokenCost: number;
  factuality: number;
  groundedness: number;
  citationQuality: number;
  timestamp: Date;
}

// ─── Experiments ──────────────────────────────────────────────────────────────

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

export interface RoutingStrategy {
  frameworkWeights: Partial<Record<Framework, number>>;
  description: string;
}

export interface TargetPopulation {
  type: 'all_reps' | 'specific_teams' | 'specific_reps';
  teamIds?: string[];
  repIds?: string[];
}

export interface ExperimentAssignment {
  id: string;
  experimentId: string;
  sessionId: string;
  repId: string;
  groupName: 'control' | 'treatment';
  createdAt: Date;
}

export interface ExperimentMetric {
  name: string;
  value: number;
  timestamp: Date;
}

export interface ExperimentResults {
  experimentId: string;
  controlMetrics: AggregateMetrics;
  treatmentMetrics: AggregateMetrics;
  statisticalSignificance: number;
  isSignificant: boolean;
}

export interface AggregateMetrics {
  questionAcceptanceRate: number;
  avgIntentScore: number;
  coverageVelocity: number;
  dealOutcomeCorrelation?: number;
  sampleSize: number;
}

export interface ExperimentConfig {
  name: string;
  description: string;
  controlStrategy: RoutingStrategy;
  treatmentStrategy: RoutingStrategy;
  targetPopulation: TargetPopulation;
  durationDays: number;
  significanceThreshold: number;
}

// ─── Rep Performance ──────────────────────────────────────────────────────────

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

export interface PreCallAttendee {
  contactId: string;
  buyerPersona: BuyerPersona;
}

export interface PrioritizedTopic {
  topic: string;
  priority: number;
  canonicalField?: CanonicalField;
  framework?: Framework;
}

export interface GeneratedPlan {
  openingQuestions: string[];
  frameworkEmphasis: Framework[];
  coverageTargets: Partial<Record<CanonicalField, number>>;
  suggestedDuration: number;
}

export interface PreCallContext {
  accountId: string;
  repId: string;
  attendees: PreCallAttendee[];
  dealStage: DealStage;
  previousCoverage?: CoverageMap;
  notes?: string;
}

// ─── Summary ──────────────────────────────────────────────────────────────────

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

export interface SessionSummary {
  summary: Summary;
  transcript: TranscriptSegment[];
  questionsUsed: QuestionEvent[];
  objectionsDetected: ObjectionEvent[];
}

export interface KeyFinding {
  canonicalField: CanonicalField;
  finding: string;
  sourceFramework: Framework;
  confidence: number;
}

export interface ActionItem {
  description: string;
  assignedTo?: string;
  dueDate?: Date;
  framework?: Framework;
}

// ─── Question Events ──────────────────────────────────────────────────────────

export interface QuestionEvent {
  id: string;
  sessionId: string;
  questionId: string;
  eventType: QuestionEventType;
  framework: Framework;
  intentScore?: number;
  timestamp: Date;
}

// ─── Objection Events ─────────────────────────────────────────────────────────

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

// ─── Framework Weighting ──────────────────────────────────────────────────────

export interface FrameworkWeightingProfile {
  dealStage: DealStage;
  weights: Record<Framework, number>;
}

export const DEFAULT_FRAMEWORK_WEIGHTS: Record<DealStage, Record<Framework, number>> = {
  first_discovery: {
    RAIN: 0.25,
    Challenger: 0.25,
    ValueSelling: 0.15,
    MEDDICC: 0.10,
    SevenStories: 0.10,
    GreatDemo: 0.05,
    SaaSBackwards: 0.10,
  },
  qualification: {
    MEDDICC: 0.30,
    ValueSelling: 0.20,
    Challenger: 0.15,
    RAIN: 0.15,
    SaaSBackwards: 0.10,
    SevenStories: 0.05,
    GreatDemo: 0.05,
  },
  demo_proof: {
    GreatDemo: 0.30,
    ValueSelling: 0.25,
    SaaSBackwards: 0.20,
    Challenger: 0.10,
    MEDDICC: 0.10,
    RAIN: 0.03,
    SevenStories: 0.02,
  },
  negotiation: {
    SevenStories: 0.25,
    ValueSelling: 0.20,
    Challenger: 0.20,
    MEDDICC: 0.15,
    SaaSBackwards: 0.10,
    RAIN: 0.05,
    GreatDemo: 0.05,
  },
  close: {
    MEDDICC: 0.25,
    ValueSelling: 0.25,
    Challenger: 0.15,
    SevenStories: 0.15,
    SaaSBackwards: 0.10,
    RAIN: 0.05,
    GreatDemo: 0.05,
  },
};

// ─── Conflict Resolution ──────────────────────────────────────────────────────

export interface ConflictLog {
  id: string;
  sessionId: string;
  conflictingFrameworks: Framework[];
  resolutionPolicy: ConflictResolutionPolicy;
  repChoice?: Framework;
  contextSummary?: string;
  createdAt: Date;
}

// ─── Outcome Signals ──────────────────────────────────────────────────────────

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

// ─── Voice Profiles ───────────────────────────────────────────────────────────

export interface VoiceProfile {
  id: string;
  repId: string;
  sampleAudioUrl?: string;
  createdAt: Date;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export interface ExportEvent {
  id: string;
  sessionId: string;
  platform: ExportPlatform;
  success: boolean;
  externalId?: string;
  errorMessage?: string;
  retryable: boolean;
  attemptCount: number;
  timestamp: Date;
}

export interface ExportTarget {
  platform: ExportPlatform;
  credentials: OAuthTokens;
  config: PlatformConfig;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

export interface PlatformConfig {
  instanceUrl?: string;
  tenantId?: string;
  customFields?: Record<string, string>;
}

export interface ExportResult {
  success: boolean;
  externalId?: string;
  error?: ExportError;
  retryable: boolean;
}

export interface ExportError {
  code: string;
  message: string;
  retryAfterMs?: number;
}

export interface ExportPreview {
  platform: ExportPlatform;
  recordCount: number;
  payload: Record<string, unknown>;
}

// ─── Audio ────────────────────────────────────────────────────────────────────

export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
  sampleRate: number;
  channels: number;
}

export interface TranscriptionConfig {
  sessionId: string;
  repId: string;
  voiceProfileId?: string;
  language: 'en';
  enableDiarization: boolean;
  maxSpeakers: number;
}

export interface SessionHandle {
  sessionId: string;
  startedAt: Date;
}

// ─── AI Engine Types ──────────────────────────────────────────────────────────

export interface SessionContext {
  sessionId: string;
  accountId: string;
  repId: string;
  activeFrameworks: Framework[];
  dealStage: DealStage;
  currentCoverage: CoverageMap;
  buyerPersonas: BuyerPersona[];
  preferredQuestions: string[];
  experimentGroup?: ExperimentAssignment;
}

export type CoachingEvent =
  | { type: 'coverage_update'; data: CoverageUpdate }
  | { type: 'question_suggestion'; data: QuestionSuggestion }
  | { type: 'intent_score'; data: IntentScoreUpdate }
  | { type: 'objection_detected'; data: ObjectionAlert }
  | { type: 'stage_transition_hint'; data: StageTransitionHint }
  | { type: 'talk_time_nudge'; data: TalkTimeNudge };

export interface CoverageUpdate {
  field: CanonicalField | string;
  fieldType: 'canonical' | 'framework_native';
  previousScore: number;
  newScore: number;
  framework?: Framework;
}

export interface QuestionSuggestion {
  questionId: string;
  text: string;
  framework: Framework;
  canonicalField?: CanonicalField;
  confidence: number;
  alternatives: QuestionSuggestion[];
}

export interface IntentScoreUpdate {
  questionId: string;
  score: number;
  isMet: boolean;
  followUpNeeded: boolean;
}

export interface IntentScore {
  questionId: string;
  score: number;
  isMet: boolean;
  evaluatedAt: Date;
}

export interface ObjectionAlert {
  type: ObjectionType;
  confidence: number;
  triggerText: string;
  timestamp: number;
  suggestedResponse?: string;
  framework?: Framework;
}

export interface ObjectionDetection {
  type: ObjectionType;
  confidence: number;
  triggerText: string;
  timestamp: number;
}

export interface StageTransitionHint {
  currentStage: DealStage;
  suggestedStage: DealStage;
  triggerSignal: string;
  confidence: number;
}

export interface TalkTimeNudge {
  repTalkRatio: number;
  threshold: number;
  message: string;
}

// ─── Framework Classifier Types ───────────────────────────────────────────────

export interface ClassificationContext {
  recentTranscript: TranscriptSegment[];
  coverageGaps: CoverageGap[];
  buyerPersona: BuyerPersona;
  dealStage: DealStage;
  frameworkWeights: FrameworkWeightingProfile;
  activeFrameworks: Framework[];
}

export interface FrameworkRouting {
  primaryFramework: Framework;
  secondaryFrameworks: Framework[];
  confidence: number;
  reasoning: string;
}

// ─── Expert Panel Types ───────────────────────────────────────────────────────

export interface GuidanceToken {
  token: string;
  sourceFramework?: Framework;
  citationRef?: string;
  isComplete: boolean;
}

export interface FrameworkGuidance {
  framework: Framework;
  guidance: string;
  confidence: number;
  citations: Citation[];
}

export interface ResolvedGuidance {
  resolvedText: string;
  policy: ConflictResolutionPolicy;
  contributions: FrameworkGuidance[];
  conflictDetected: boolean;
}

// ─── Retrieval Types ──────────────────────────────────────────────────────────

export interface RetrievalQuery {
  text: string;
  frameworks: Framework[];
  canonicalFields?: CanonicalField[];
  userRole: UserRole;
  rightsContext: RightsContext;
  maxResults: number;
  enableGraphExpansion: boolean;
}

export interface RightsContext {
  userId: string;
  role: UserRole;
  teamIds: string[];
}

export interface ScoredDocument {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface SearchFilters {
  frameworks?: Framework[];
  canonicalFields?: CanonicalField[];
  userRole: UserRole;
  permittedTeams: string[];
}

// ─── Ingestion Types ──────────────────────────────────────────────────────────

export interface SourceDocumentUpload {
  file: Buffer;
  filename: string;
  mimeType: SupportedMimeType;
  metadata: DocumentMetadata;
  rightsProfile: RightsProfile;
  frameworkAffiliation: Framework[];
}

export interface DocumentMetadata {
  title: string;
  author?: string;
  chapter?: string;
  section?: string;
  pageCount?: number;
}

export interface IngestionResult {
  documentId: string;
  chunksCreated: number;
  duplicatesDetected: number;
  processingTimeMs: number;
  status: IngestionStatus;
}

export interface DuplicateReport {
  duplicates: DuplicateMatch[];
  totalChecked: number;
}

export interface DuplicateMatch {
  newChunkIndex: number;
  existingChunkId: string;
  existingDocumentId: string;
  similarityScore: number;
}

// ─── Sync Types ───────────────────────────────────────────────────────────────

export interface SyncItem {
  type: 'transcript_segment' | 'coverage_update' | 'image_capture' | 'intent_score';
  sessionId: string;
  timestamp: number;
  payload: unknown;
}

export interface SyncResult {
  itemsSynced: number;
  failures: number;
  lastSyncAt: Date;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'completed' | 'failed';
  pendingItems: number;
  lastSyncAt?: Date;
  error?: string;
}

// ─── Generated Response (for Evaluation) ─────────────────────────────────────

export interface GeneratedResponse {
  id: string;
  sessionId: string;
  content: string;
  citations: Citation[];
  framework: Framework;
  generatedAt: Date;
}
