// ─── Barrel Export for @ptv-discovery-coach/shared ────────────────────────────
// This file re-exports all types and interfaces from the organized sub-modules.
// Legacy types from ./types.ts are also exported for backward compatibility.

// Legacy types (preserved for backward compatibility with existing consumers)
// These export MEDDICElement, IndustrySegment, and other legacy-format types
export {
  type MEDDICElement,
  MEDDIC_ELEMENTS,
  type IndustrySegment,
  INDUSTRY_SEGMENTS,
  INDUSTRY_SEGMENT_LABELS,
  type MEDDICScores,
  defaultMEDDICScores,
  type User,
  type RepQuestionPreference,
  type Attachment,
  type AnalysisResult,
  type GapRecommendation,
  type WeightedQuestion,
  type ContactInput,
  type SessionContact,
  type RecoveryStatus,
} from './types';

// Re-export organized type modules (new multi-framework architecture)
export * from './types/framework';
export * from './types/audio';
export * from './types/ai';
export * from './types/retrieval';
export * from './types/export';
export * from './types/ingestion';
export * from './types/evaluation';
export * from './types/entities';

// Component interfaces (service contracts)
export * from './interfaces/services';

// OptiFlow Flatbed Steel Load Planner types
export * from './flatbed';
