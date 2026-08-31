// ─── Framework Types and Canonical Ontology ───────────────────────────────────
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
 * Conflict resolution policies for contradictory framework guidance.
 */
export type ConflictResolutionPolicy = 'primary_wins' | 'context_adaptive' | 'present_both';

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
 * Ingestion pipeline processing status.
 */
export type IngestionStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Crosswalk mapping defining how each Framework's core objects align to shared canonical fields.
 */
export interface CrosswalkMapping {
  id: string;
  framework: Framework;
  nativeField: string;
  canonicalField: CanonicalField;
  description?: string;
}

/**
 * A concept that belongs exclusively to one Framework and does not map to a shared canonical field.
 */
export interface FrameworkNativeField {
  name: string;
  framework: Framework;
  description?: string;
}

/**
 * Framework weighting profile for a specific deal stage.
 */
export interface FrameworkWeightingProfile {
  dealStage: DealStage;
  weights: Record<Framework, number>;
}

/**
 * Default framework weights per deal stage, as defined in design document.
 */
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
