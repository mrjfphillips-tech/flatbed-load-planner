// ─── Shared Enums and Union Types ─────────────────────────────────────────────
// Requirements: 7.1, 7.2, 7.3

/**
 * The seven integrated sales frameworks used by PTV Discovery Coach.
 */
export type Framework =
  | 'ValueSelling'
  | 'MEDDICC'
  | 'RAIN'
  | 'Challenger'
  | 'SevenStories'
  | 'GreatDemo'
  | 'SaaSBackwards';

export const FRAMEWORKS: Framework[] = [
  'ValueSelling',
  'MEDDICC',
  'RAIN',
  'Challenger',
  'SevenStories',
  'GreatDemo',
  'SaaSBackwards',
];

/**
 * Shared canonical fields in the Canonical Ontology.
 * These map concepts from all seven frameworks into a unified semantic layer.
 */
export type CanonicalField =
  | 'pain'
  | 'value_metric'
  | 'stakeholder'
  | 'decision_criteria'
  | 'story'
  | 'demo_proof'
  | 'next_step_commitment';

export const CANONICAL_FIELDS: CanonicalField[] = [
  'pain',
  'value_metric',
  'stakeholder',
  'decision_criteria',
  'story',
  'demo_proof',
  'next_step_commitment',
];

/**
 * Deal stages representing the current sales opportunity phase.
 * Influences framework weighting and coverage targets.
 */
export type DealStage =
  | 'first_discovery'
  | 'qualification'
  | 'demo_proof'
  | 'negotiation'
  | 'close';

export const DEAL_STAGES: DealStage[] = [
  'first_discovery',
  'qualification',
  'demo_proof',
  'negotiation',
  'close',
];

/**
 * Classification of the customer contact on the call.
 */
export type BuyerPersona =
  | 'fleet_manager'
  | 'logistics_director'
  | 'supply_chain_vp'
  | 'it_architect'
  | 'operations_analyst';

export const BUYER_PERSONAS: BuyerPersona[] = [
  'fleet_manager',
  'logistics_director',
  'supply_chain_vp',
  'it_architect',
  'operations_analyst',
];

/**
 * Application user roles with ascending privilege levels.
 */
export type UserRole = 'rep' | 'manager' | 'admin';

export const USER_ROLES: UserRole[] = ['rep', 'manager', 'admin'];

/**
 * Types of customer objections detected in real-time from the transcript.
 */
export type ObjectionType =
  | 'price'
  | 'timing'
  | 'competitor'
  | 'status_quo'
  | 'authority_deflection'
  | 'feature_gap';

export const OBJECTION_TYPES: ObjectionType[] = [
  'price',
  'timing',
  'competitor',
  'status_quo',
  'authority_deflection',
  'feature_gap',
];

/**
 * Supported file formats for the Ingestion Pipeline.
 */
export type SupportedFormat =
  | 'pdf'
  | 'docx'
  | 'pptx'
  | 'epub'
  | 'mp3'
  | 'wav'
  | 'mp4'
  | 'csv'
  | 'txt';

export const SUPPORTED_FORMATS: SupportedFormat[] = [
  'pdf',
  'docx',
  'pptx',
  'epub',
  'mp3',
  'wav',
  'mp4',
  'csv',
  'txt',
];

/**
 * MIME types corresponding to supported ingestion formats.
 */
export type SupportedMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  | 'application/epub+zip'
  | 'audio/mpeg'
  | 'audio/wav'
  | 'video/mp4'
  | 'text/csv'
  | 'text/plain';

/**
 * Speaker labels for diarized transcripts.
 * 'Rep' is the sales rep; Customer_N identifies distinct customer speakers.
 */
export type SpeakerLabel = 'rep' | `customer_${number}`;

/**
 * States of the audio capture service.
 */
export type AudioCaptureState = 'idle' | 'capturing' | 'paused' | 'error';

/**
 * Session status tracking.
 */
export type SessionStatus = 'active' | 'completed' | 'interrupted' | 'offline_recovery';

/**
 * Ingestion pipeline processing status.
 */
export type IngestionStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Conflict resolution policies for contradictory framework guidance.
 */
export type ConflictResolutionPolicy = 'primary_wins' | 'context_adaptive' | 'present_both';

/**
 * Experiment status lifecycle.
 */
export type ExperimentStatus = 'draft' | 'active' | 'stopped' | 'completed';

/**
 * Licensing types for source documents.
 */
export type LicensingType = 'proprietary' | 'creative_commons' | 'fair_use' | 'internal_only';

/**
 * Export target platforms.
 */
export type ExportPlatform = 'salesforce' | 'microsoft365' | 'sms' | 'email';

/**
 * Sync item types for background sync.
 */
export type SyncItemType =
  | 'transcript_segment'
  | 'coverage_update'
  | 'image_capture'
  | 'intent_score';

/**
 * Sync status states.
 */
export type SyncStatusState = 'idle' | 'syncing' | 'completed' | 'failed';

/**
 * Question event types in session logging.
 */
export type QuestionEventType = 'suggested' | 'accepted' | 'skipped' | 'dismissed';

/**
 * Transcript segment source type.
 */
export type TranscriptSource = 'audio' | 'ocr';

/**
 * Outcome signal from closed deals.
 */
export type DealOutcome = 'won' | 'lost';
