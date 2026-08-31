import { describe, it, expect } from 'vitest';
import {
  defaultMEDDICScores,
  MEDDIC_ELEMENTS,
  FRAMEWORKS,
  CANONICAL_FIELDS,
  DEAL_STAGES,
  BUYER_PERSONAS,
  USER_ROLES,
  OBJECTION_TYPES,
  SUPPORTED_FORMATS,
  DEFAULT_FRAMEWORK_WEIGHTS,
} from './index';

import type {
  // Entity types
  Account,
  Session,
  Contact,
  Question,
  SourceDocument,
  RightsProfile,
  Chunk,
  EvaluationRecord,
  Experiment,
  RepPerformanceMetrics,
  PreCallPlan,
  Summary,
  // Framework types
  Framework,
  CanonicalField,
  DealStage,
  BuyerPersona,
  UserRole,
  ObjectionType,
  SupportedFormat,
  CrosswalkMapping,
  FrameworkWeightingProfile,
  // Audio types
  AudioChunk,
  TranscriptSegment,
  SpeakerLabel,
  VoiceProfile,
  // AI types
  ClassificationContext,
  FrameworkRouting,
  GuidanceToken,
  ObjectionDetection,
  SessionContext,
  CoverageScoreMap,
  CoverageGap,
  // Retrieval types
  RetrievalQuery,
  RankedPassage,
  CitationReference,
  // Export types
  ExportResult,
  ExportPreview,
  ExportError,
  OAuthCredentials,
  SyncResult,
  BufferStatus,
  // Ingestion types
  SourceDocumentUpload,
  IngestionResult,
  DuplicateReport,
  DocumentMetadata,
  // Evaluation types
  AIOutput,
  EvaluationResult,
  SafetyResult,
  // Service interfaces
  AudioCaptureService,
  TranscriptionEngine,
  FrameworkClassifier,
  ExpertPanel,
  RetrievalEngine,
  ObjectionCoach,
  QuestionIntentScorer,
  CoverageAnalyzer,
  EvaluationEngine,
  ExportAdapter,
  IngestionPipeline,
  BackgroundSyncManager,
} from './index';

describe('shared types', () => {
  it('defaultMEDDICScores returns all elements at 0', () => {
    const scores = defaultMEDDICScores();
    for (const element of MEDDIC_ELEMENTS) {
      expect(scores[element]).toBe(0);
    }
  });

  it('MEDDIC_ELEMENTS contains all 12 elements', () => {
    expect(MEDDIC_ELEMENTS).toHaveLength(12);
  });
});

describe('framework enums', () => {
  it('FRAMEWORKS contains all 7 sales methodologies', () => {
    expect(FRAMEWORKS).toHaveLength(7);
    expect(FRAMEWORKS).toContain('ValueSelling');
    expect(FRAMEWORKS).toContain('MEDDICC');
    expect(FRAMEWORKS).toContain('RAIN');
    expect(FRAMEWORKS).toContain('Challenger');
    expect(FRAMEWORKS).toContain('SevenStories');
    expect(FRAMEWORKS).toContain('GreatDemo');
    expect(FRAMEWORKS).toContain('SaaSBackwards');
  });

  it('CANONICAL_FIELDS contains all 7 canonical fields', () => {
    expect(CANONICAL_FIELDS).toHaveLength(7);
    expect(CANONICAL_FIELDS).toContain('pain');
    expect(CANONICAL_FIELDS).toContain('value_metric');
    expect(CANONICAL_FIELDS).toContain('stakeholder');
    expect(CANONICAL_FIELDS).toContain('decision_criteria');
    expect(CANONICAL_FIELDS).toContain('story');
    expect(CANONICAL_FIELDS).toContain('demo_proof');
    expect(CANONICAL_FIELDS).toContain('next_step_commitment');
  });

  it('DEAL_STAGES contains all 5 stages', () => {
    expect(DEAL_STAGES).toHaveLength(5);
    expect(DEAL_STAGES).toContain('first_discovery');
    expect(DEAL_STAGES).toContain('qualification');
    expect(DEAL_STAGES).toContain('demo_proof');
    expect(DEAL_STAGES).toContain('negotiation');
    expect(DEAL_STAGES).toContain('close');
  });

  it('BUYER_PERSONAS contains all 5 personas', () => {
    expect(BUYER_PERSONAS).toHaveLength(5);
    expect(BUYER_PERSONAS).toContain('fleet_manager');
    expect(BUYER_PERSONAS).toContain('logistics_director');
    expect(BUYER_PERSONAS).toContain('supply_chain_vp');
    expect(BUYER_PERSONAS).toContain('it_architect');
    expect(BUYER_PERSONAS).toContain('operations_analyst');
  });

  it('USER_ROLES contains all 3 roles', () => {
    expect(USER_ROLES).toHaveLength(3);
    expect(USER_ROLES).toContain('rep');
    expect(USER_ROLES).toContain('manager');
    expect(USER_ROLES).toContain('admin');
  });

  it('OBJECTION_TYPES contains all 6 types', () => {
    expect(OBJECTION_TYPES).toHaveLength(6);
    expect(OBJECTION_TYPES).toContain('price');
    expect(OBJECTION_TYPES).toContain('timing');
    expect(OBJECTION_TYPES).toContain('competitor');
    expect(OBJECTION_TYPES).toContain('status_quo');
    expect(OBJECTION_TYPES).toContain('authority_deflection');
    expect(OBJECTION_TYPES).toContain('feature_gap');
  });

  it('SUPPORTED_FORMATS contains all 9 formats', () => {
    expect(SUPPORTED_FORMATS).toHaveLength(9);
    expect(SUPPORTED_FORMATS).toContain('pdf');
    expect(SUPPORTED_FORMATS).toContain('docx');
    expect(SUPPORTED_FORMATS).toContain('pptx');
    expect(SUPPORTED_FORMATS).toContain('epub');
    expect(SUPPORTED_FORMATS).toContain('mp3');
    expect(SUPPORTED_FORMATS).toContain('wav');
    expect(SUPPORTED_FORMATS).toContain('mp4');
    expect(SUPPORTED_FORMATS).toContain('csv');
    expect(SUPPORTED_FORMATS).toContain('txt');
  });
});

describe('DEFAULT_FRAMEWORK_WEIGHTS', () => {
  it('defines weights for all 5 deal stages', () => {
    const stages: DealStage[] = ['first_discovery', 'qualification', 'demo_proof', 'negotiation', 'close'];
    for (const stage of stages) {
      expect(DEFAULT_FRAMEWORK_WEIGHTS[stage]).toBeDefined();
    }
  });

  it('each stage has weights for all 7 frameworks', () => {
    for (const stage of DEAL_STAGES) {
      const weights = DEFAULT_FRAMEWORK_WEIGHTS[stage];
      for (const framework of FRAMEWORKS) {
        expect(weights[framework]).toBeGreaterThanOrEqual(0);
        expect(weights[framework]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('weights within each stage sum to approximately 1.0', () => {
    for (const stage of DEAL_STAGES) {
      const weights = DEFAULT_FRAMEWORK_WEIGHTS[stage];
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it('first_discovery prioritizes RAIN and Challenger', () => {
    const weights = DEFAULT_FRAMEWORK_WEIGHTS['first_discovery'];
    expect(weights.RAIN).toBe(0.25);
    expect(weights.Challenger).toBe(0.25);
  });

  it('qualification prioritizes MEDDICC', () => {
    const weights = DEFAULT_FRAMEWORK_WEIGHTS['qualification'];
    expect(weights.MEDDICC).toBe(0.30);
  });
});

describe('type exports compile correctly', () => {
  it('entity interfaces are accessible', () => {
    // Type-level assertions — if these compile, the exports are correct
    const account: Account = {
      id: '1',
      name: 'Test Account',
      organizationId: 'org-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(account.id).toBe('1');
    expect(account.name).toBe('Test Account');
  });

  it('session interface has all required fields', () => {
    const session: Session = {
      id: '1',
      accountId: 'acc-1',
      repId: 'rep-1',
      dealStage: 'first_discovery',
      status: 'active',
      startedAt: new Date(),
      isOfflineRecovery: false,
      createdAt: new Date(),
    };
    expect(session.status).toBe('active');
    expect(session.dealStage).toBe('first_discovery');
  });

  it('coverage map has canonical and framework native fields', () => {
    const coverage: CoverageScoreMap = {
      canonical: {
        pain: 80,
        value_metric: 60,
        stakeholder: 40,
        decision_criteria: 30,
        story: 20,
        demo_proof: 10,
        next_step_commitment: 0,
      },
      frameworkNative: {
        'MEDDICC:champion': 50,
      },
      lastUpdated: new Date(),
    };
    expect(coverage.canonical.pain).toBe(80);
    expect(coverage.frameworkNative['MEDDICC:champion']).toBe(50);
  });

  it('framework routing has required fields', () => {
    const routing: FrameworkRouting = {
      primaryFramework: 'ValueSelling',
      secondaryFrameworks: ['MEDDICC', 'RAIN'],
      confidence: 0.85,
      reasoning: 'Pain-focused context matches ValueSelling',
    };
    expect(routing.primaryFramework).toBe('ValueSelling');
    expect(routing.confidence).toBe(0.85);
  });
});
