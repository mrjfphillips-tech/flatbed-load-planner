// ─── Component Interfaces (Service Contracts) ─────────────────────────────────
// Requirements: 7.1, 7.2, 7.3

import type {
  AudioChunk,
  TranscriptionConfig,
  SessionHandle,
  FinalTranscript,
  TranscriptSegment,
  VoiceProfile,
} from '../types/audio';

import type {
  ClassificationContext,
  FrameworkRouting,
  GuidanceToken,
  FrameworkGuidance,
  ResolvedGuidance,
  ObjectionDetection,
  SessionContext,
  CoverageScoreMap,
  CoverageGap,
  QuestionIntentScore,
} from '../types/ai';

import type {
  RetrievalQuery,
  RankedPassage,
  ScoredDocument,
  SearchFilters,
} from '../types/retrieval';

import type {
  ExportTarget,
  ExportResult,
  ExportPreview,
  SyncResult,
  BufferStatus,
} from '../types/export';

import type {
  SourceDocumentUpload,
  IngestionResult,
  DuplicateReport,
} from '../types/ingestion';

import type {
  EvaluationResult,
  SafetyResult,
  AIOutput,
} from '../types/evaluation';

import type {
  CanonicalField,
  ConflictResolutionPolicy,
  DealStage,
} from '../types/framework';

import type {
  Experiment,
  ExperimentAssignment,
  PreCallPlan,
  CoverageMap,
  Summary,
  QuestionEvent,
  ObjectionEvent,
} from '../types/entities';

// ─── Experiment Types for Engine ──────────────────────────────────────────────

export interface ExperimentConfig {
  name: string;
  description: string;
  controlStrategy: { frameworkWeights: Partial<Record<string, number>>; description: string };
  treatmentStrategy: { frameworkWeights: Partial<Record<string, number>>; description: string };
  targetPopulation: { type: 'all_reps' | 'specific_teams' | 'specific_reps'; teamIds?: string[]; repIds?: string[] };
  durationDays: number;
  significanceThreshold: number;
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

// ─── Response Metrics ─────────────────────────────────────────────────────────

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

// ─── Content Chunk (for indexing) ─────────────────────────────────────────────

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

// ─── Sync Item ────────────────────────────────────────────────────────────────

export interface SyncItem {
  type: 'transcript_segment' | 'coverage_update' | 'image_capture' | 'intent_score';
  sessionId: string;
  timestamp: number;
  payload: unknown;
}

// ─── Coaching Event Types ─────────────────────────────────────────────────────

export interface CoverageUpdate {
  field: CanonicalField | string;
  fieldType: 'canonical' | 'framework_native';
  previousScore: number;
  newScore: number;
  framework?: string;
}

export interface QuestionSuggestion {
  questionId: string;
  text: string;
  framework: string;
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

export interface ObjectionAlert {
  type: string;
  confidence: number;
  triggerText: string;
  timestamp: number;
  suggestedResponse?: string;
  framework?: string;
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

export type CoachingEvent =
  | { type: 'coverage_update'; data: CoverageUpdate }
  | { type: 'question_suggestion'; data: QuestionSuggestion }
  | { type: 'intent_score'; data: IntentScoreUpdate }
  | { type: 'objection_detected'; data: ObjectionAlert }
  | { type: 'stage_transition_hint'; data: StageTransitionHint }
  | { type: 'talk_time_nudge'; data: TalkTimeNudge };

// ─── Pre-Call Context ─────────────────────────────────────────────────────────

export interface PreCallContext {
  accountId: string;
  repId: string;
  attendees: { contactId: string; buyerPersona: string }[];
  dealStage: DealStage;
  previousCoverage?: CoverageMap;
  notes?: string;
}

// ─── Session Summary ──────────────────────────────────────────────────────────

export interface SessionSummary {
  summary: Summary;
  transcript: TranscriptSegment[];
  questionsUsed: QuestionEvent[];
  objectionsDetected: ObjectionEvent[];
}

// ─── 1. Audio Capture Service ─────────────────────────────────────────────────

/**
 * Manages microphone access and audio streaming from the device.
 */
export interface AudioCaptureService {
  /** Request microphone access using browser's Web Audio API */
  requestMicrophoneAccess(): Promise<boolean>;

  /** Start capturing audio, emitting chunks at configured interval */
  startCapture(sessionId: string): Promise<void>;

  /** Pause audio capture without ending the session */
  pauseCapture(): void;

  /** Resume previously paused capture */
  resumeCapture(): void;

  /** Stop capturing and release microphone */
  stopCapture(): Promise<void>;

  /** Register callback for audio chunks */
  onAudioChunk(callback: (chunk: AudioChunk) => void): void;

  /** Register callback for audio signal loss detection */
  onSignalLoss(callback: (durationMs: number) => void): void;
}

// ─── 2. Transcription Engine ──────────────────────────────────────────────────

/**
 * Converts audio streams to text with speaker diarization.
 * Implementations: Azure Speech Services (online), Whisper.cpp WASM (offline).
 */
export interface TranscriptionEngine {
  /** Start a transcription session */
  startSession(config: TranscriptionConfig): Promise<SessionHandle>;

  /** Process an audio chunk (called continuously during session) */
  processAudioChunk(sessionId: string, chunk: AudioChunk): Promise<void>;

  /** Register a voice profile for improved diarization */
  registerVoiceProfile(repId: string, audioSample: ArrayBuffer): Promise<VoiceProfile>;

  /** End session and finalize transcript */
  endSession(sessionId: string): Promise<FinalTranscript>;

  /** Register callback for real-time transcript segments */
  onSegment(callback: (segment: TranscriptSegment) => void): void;
}

// ─── 3. Framework Classifier ──────────────────────────────────────────────────

/**
 * Determines which framework(s) are most relevant for the current conversation context.
 */
export interface FrameworkClassifier {
  /** Classify current context to determine relevant frameworks */
  classify(ctx: ClassificationContext): Promise<FrameworkRouting>;
}

// ─── 4. Expert Panel ──────────────────────────────────────────────────────────

/**
 * Routed ensemble of framework-specialized models that generate
 * grounded answers with explicit attribution.
 */
export interface ExpertPanel {
  /** Generate guidance from routed frameworks */
  generateGuidance(
    routing: FrameworkRouting,
    retrievedPassages: RankedPassage[],
    context: SessionContext,
  ): AsyncIterable<GuidanceToken>;

  /** Detect and resolve conflicts between frameworks */
  resolveConflict(
    conflictingGuidance: FrameworkGuidance[],
    policy: ConflictResolutionPolicy,
  ): Promise<ResolvedGuidance>;
}

// ─── 5. Retrieval Engine ──────────────────────────────────────────────────────

/**
 * Hybrid search combining BM25 sparse retrieval, dense vector retrieval,
 * RRF fusion, cross-encoder reranking, and graph expansion.
 */
export interface RetrievalEngine {
  /** Execute hybrid retrieval */
  search(query: RetrievalQuery): Promise<RankedPassage[]>;

  /** Index new content chunks */
  indexChunks(chunks: ContentChunk[]): Promise<void>;

  /** Remove all chunks for a document */
  removeDocument(documentId: string): Promise<void>;
}

/**
 * Low-level hybrid search pipeline steps (for internal composition).
 */
export interface HybridSearchPipeline {
  /** Step 1a: Sparse BM25 retrieval */
  sparseSearch(query: string, filters: SearchFilters): Promise<ScoredDocument[]>;

  /** Step 1b: Dense vector retrieval */
  denseSearch(embedding: Float32Array, filters: SearchFilters): Promise<ScoredDocument[]>;

  /** Step 2: RRF fusion merge */
  fusionMerge(sparse: ScoredDocument[], dense: ScoredDocument[], k: number): ScoredDocument[];

  /** Step 3: Cross-encoder reranking */
  rerank(candidates: ScoredDocument[], query: string, topK: number): Promise<RankedPassage[]>;

  /** Step 4: Graph expansion (optional) */
  expandViaGraph(passages: RankedPassage[]): Promise<RankedPassage[]>;
}

// ─── 6. Objection Coach ───────────────────────────────────────────────────────

/**
 * Detects objections in real-time and surfaces coached response strategies.
 */
export interface ObjectionCoach {
  /** Analyze segment for objection patterns */
  detectObjection(
    segment: TranscriptSegment,
    context: SessionContext,
  ): Promise<ObjectionDetection | null>;

  /** Generate coached response for detected objection */
  generateResponse(
    objection: ObjectionDetection,
    context: SessionContext,
    retrievedPassages: RankedPassage[],
  ): AsyncIterable<GuidanceToken>;
}

// ─── 7. Question Intent Scorer ────────────────────────────────────────────────

/**
 * Evaluates whether the intent of a suggested question was achieved
 * based on the customer's response, regardless of exact wording.
 */
export interface QuestionIntentScorer {
  /** Score customer response against suggested question intent */
  scoreIntent(
    sessionId: string,
    questionId: string,
    responseSegments: TranscriptSegment[],
  ): Promise<QuestionIntentScore>;
}

// ─── 8. Coverage Analyzer ─────────────────────────────────────────────────────

/**
 * Tracks and computes coverage scores across canonical and framework-native fields.
 */
export interface CoverageAnalyzer {
  /** Update coverage based on new intent scores */
  updateCoverage(
    sessionId: string,
    intentScore: QuestionIntentScore,
    field: CanonicalField | string,
  ): Promise<CoverageScoreMap>;

  /** Get cumulative coverage across all sessions for an account */
  getAccountCoverage(accountId: string): Promise<CoverageScoreMap>;

  /** Identify gaps relative to stage targets */
  identifyGaps(coverage: CoverageScoreMap, dealStage: DealStage): CoverageGap[];
}

// ─── 9. Evaluation Engine ─────────────────────────────────────────────────────

/**
 * Scores AI outputs for factuality, groundedness, citation quality;
 * enforces safety filters.
 */
export interface EvaluationEngine {
  /** Evaluate a generated response */
  evaluate(
    response: AIOutput,
    sources: RankedPassage[],
  ): Promise<EvaluationResult>;

  /** Check safety of content */
  checkSafety(content: string): Promise<SafetyResult>;

  /** Log response metrics for observability */
  logMetrics(metrics: ResponseMetrics): Promise<void>;
}

// ─── 10. Export Adapter ───────────────────────────────────────────────────────

/**
 * Formats and transmits session data to external CRM and productivity platforms.
 */
export interface ExportAdapter {
  /** Export session data to CRM */
  exportSession(sessionId: string, target: ExportTarget): Promise<ExportResult>;

  /** Export contacts for an account */
  exportContacts(accountId: string, target: ExportTarget): Promise<ExportResult>;

  /** Preview export payload before confirming */
  previewExport(sessionId: string, target: ExportTarget): Promise<ExportPreview>;
}

// ─── 11. Ingestion Pipeline ───────────────────────────────────────────────────

/**
 * Parses, chunks, embeds, tags, and indexes source documents and media.
 */
export interface IngestionPipeline {
  /** Ingest a new document */
  ingest(document: SourceDocumentUpload): Promise<IngestionResult>;

  /** Re-ingest an updated document (incremental) */
  reIngest(documentId: string, updatedContent: SourceDocumentUpload): Promise<IngestionResult>;

  /** Check for duplicates across existing indexed content */
  detectDuplicates(chunks: ContentChunk[]): Promise<DuplicateReport>;
}

// ─── 12. Background Sync Manager ─────────────────────────────────────────────

/**
 * Buffers data during offline mode and syncs when connectivity returns.
 */
export interface BackgroundSyncManager {
  /** Buffer a data item for later sync */
  buffer(item: SyncItem): Promise<void>;

  /** Start sync process when online */
  startSync(): Promise<SyncResult>;

  /** Get current sync status */
  getStatus(): BufferStatus;

  /** Monitor connectivity changes */
  onConnectivityChange(callback: (online: boolean) => void): void;
}

// ─── 13. Experiment Engine ────────────────────────────────────────────────────

/**
 * Manages A/B test configurations and group assignments.
 */
export interface ExperimentEngine {
  /** Create a new experiment */
  createExperiment(config: ExperimentConfig): Promise<Experiment>;

  /** Assign a session to an experiment group */
  assignGroup(sessionId: string, repId: string): Promise<ExperimentAssignment>;

  /** Record an experiment metric */
  recordMetric(assignment: ExperimentAssignment, metric: ExperimentMetric): Promise<void>;

  /** Get experiment results with statistical significance */
  getResults(experimentId: string): Promise<ExperimentResults>;

  /** Stop experiment early */
  stopExperiment(experimentId: string, reason: string): Promise<void>;
}

// ─── 14. AI Engine Orchestrator ───────────────────────────────────────────────

/**
 * Coordinates framework classification, question selection, intent scoring,
 * coverage analysis, and objection detection.
 */
export interface AIEngineOrchestrator {
  /** Process new transcript segment and produce coaching events */
  processSegment(
    ctx: SessionContext,
    segment: TranscriptSegment,
  ): AsyncIterable<CoachingEvent>;

  /** Generate pre-call plan */
  generatePreCallPlan(ctx: PreCallContext): Promise<PreCallPlan>;

  /** Generate post-session summary */
  generateSummary(sessionId: string): Promise<SessionSummary>;

  /** Evaluate question intent score */
  scoreIntent(
    sessionId: string,
    questionId: string,
    responseSegments: TranscriptSegment[],
  ): Promise<QuestionIntentScore>;
}
