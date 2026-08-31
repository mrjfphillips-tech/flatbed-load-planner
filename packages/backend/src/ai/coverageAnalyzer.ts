/**
 * CoverageAnalyzerImpl
 *
 * Tracks and computes coverage scores (0–100) across canonical and framework-native fields.
 * Coverage for a field is defined as the percentage of questions targeting that field
 * that have achieved a Question_Intent_Score >= configurable threshold (default 70).
 *
 * Implements the CoverageAnalyzer interface from shared/interfaces/services.ts.
 *
 * Key behaviors:
 * - updateCoverage: recalculates coverage for a field based on new intent scores
 * - getAccountCoverage: aggregates coverage across all sessions for an account
 * - identifyGaps: returns fields below a threshold with recommended stakeholder personas
 * - Tracks wrap-up mode: all canonical fields at 80+
 * - suggestStakeholders: maps coverage gaps to buyer personas
 * - Persists coverage snapshots to the database on each update
 *
 * Requirements: 2.1, 2.4, 2.6, 3.8, 3.9, 3.15
 */

import type { CoverageAnalyzer } from '@ptv-discovery-coach/shared';

import type {
  CoverageScoreMap,
  CoverageGap,
  QuestionIntentScore,
  StakeholderRecommendation,
} from '@ptv-discovery-coach/shared';

import type {
  CanonicalField,
  BuyerPersona,
  DealStage,
  Framework,
} from '@ptv-discovery-coach/shared';

import { CANONICAL_FIELDS } from '@ptv-discovery-coach/shared';

import { db, schema } from '../db/index';
import { sql } from 'drizzle-orm';

// ─── Configuration ────────────────────────────────────────────────────────────

export interface CoverageAnalyzerConfig {
  /**
   * The Question_Intent_Score threshold at or above which a question is considered "met".
   * Default: 70
   */
  intentScoreThreshold?: number;

  /**
   * Percentage of questions for a field that must reach the intent score threshold
   * for the field to be considered covered (advancement threshold).
   * Default: 0.70 (70%)
   */
  advancementThreshold?: number;

  /**
   * Coverage score below which a field is considered a "gap".
   * Default: 60
   */
  gapThreshold?: number;

  /**
   * Coverage score at or above which all canonical fields trigger wrap-up mode.
   * Default: 80
   */
  wrapUpThreshold?: number;
}

// ─── Stakeholder Persona Mapping ──────────────────────────────────────────────

/**
 * Maps canonical fields to buyer personas best positioned to address them.
 * Used by suggestStakeholders() to recommend who should be involved
 * to fill coverage gaps.
 */
const CANONICAL_FIELD_PERSONA_MAP: Record<CanonicalField, BuyerPersona[]> = {
  pain: ['fleet_manager', 'operations_analyst'],
  value_metric: ['logistics_director', 'supply_chain_vp'],
  stakeholder: ['supply_chain_vp', 'logistics_director'],
  decision_criteria: ['supply_chain_vp', 'it_architect'],
  story: ['fleet_manager', 'operations_analyst'],
  demo_proof: ['it_architect', 'operations_analyst'],
  next_step_commitment: ['logistics_director', 'supply_chain_vp'],
};

/**
 * Default deal stage coverage targets. Higher deal stages expect higher coverage.
 */
const DEAL_STAGE_TARGETS: Record<DealStage, Partial<Record<CanonicalField, number>>> = {
  first_discovery: {
    pain: 60,
    value_metric: 40,
    stakeholder: 50,
    decision_criteria: 30,
    story: 20,
    demo_proof: 20,
    next_step_commitment: 40,
  },
  qualification: {
    pain: 80,
    value_metric: 60,
    stakeholder: 70,
    decision_criteria: 60,
    story: 40,
    demo_proof: 30,
    next_step_commitment: 60,
  },
  demo_proof: {
    pain: 90,
    value_metric: 80,
    stakeholder: 80,
    decision_criteria: 70,
    story: 60,
    demo_proof: 70,
    next_step_commitment: 70,
  },
  negotiation: {
    pain: 90,
    value_metric: 90,
    stakeholder: 90,
    decision_criteria: 80,
    story: 80,
    demo_proof: 80,
    next_step_commitment: 80,
  },
  close: {
    pain: 95,
    value_metric: 95,
    stakeholder: 95,
    decision_criteria: 90,
    story: 85,
    demo_proof: 85,
    next_step_commitment: 90,
  },
};

// ─── Internal Types ───────────────────────────────────────────────────────────

/**
 * Internal state tracking intent scores for a session.
 */
interface FieldIntentScores {
  questionId: string;
  score: number;
  isMet: boolean;
}

// ─── Service Implementation ───────────────────────────────────────────────────

export class CoverageAnalyzerImpl implements CoverageAnalyzer {
  private readonly intentScoreThreshold: number;
  private readonly advancementThreshold: number;
  private readonly gapThreshold: number;
  private readonly wrapUpThreshold: number;

  /**
   * In-memory cache of intent scores per session, keyed by sessionId -> fieldName -> scores[]
   */
  private sessionFieldScores: Map<string, Map<string, FieldIntentScores[]>> = new Map();

  constructor(config: CoverageAnalyzerConfig = {}) {
    this.intentScoreThreshold = config.intentScoreThreshold ?? 70;
    this.advancementThreshold = config.advancementThreshold ?? 0.70;
    this.gapThreshold = config.gapThreshold ?? 60;
    this.wrapUpThreshold = config.wrapUpThreshold ?? 80;
  }

  // ─── CoverageAnalyzer Interface ─────────────────────────────────────────────

  /**
   * Update coverage based on a new intent score for a field.
   * Coverage = percentage of questions for that field that achieved
   * intent score >= threshold (configurable, default 70).
   *
   * Persists a coverage snapshot to the database on each update.
   */
  async updateCoverage(
    sessionId: string,
    intentScore: QuestionIntentScore,
    field: CanonicalField | string,
  ): Promise<CoverageScoreMap> {
    // Track the new intent score in session state
    this.trackIntentScore(sessionId, field, intentScore);

    // Recalculate coverage for this field
    const fieldScores = this.getFieldScores(sessionId, field);
    const newScore = this.calculateFieldCoverage(fieldScores);

    // Determine field type
    const fieldType = this.isCanonicalField(field) ? 'canonical' : 'framework_native';

    // Persist snapshot to database
    await this.persistCoverageSnapshot(sessionId, fieldType, field, newScore);

    // Build and return the full coverage map for this session
    return this.buildSessionCoverageMap(sessionId);
  }

  /**
   * Get cumulative coverage across all sessions for an account.
   * Aggregates the latest coverage snapshot per field across all sessions
   * belonging to the given account.
   */
  async getAccountCoverage(accountId: string): Promise<CoverageScoreMap> {
    // Query all sessions for this account, then get the max coverage per field
    const results = await db.execute(sql`
      SELECT
        cs.field_type,
        cs.field_name,
        cs.framework,
        MAX(cs.score) as max_score
      FROM coverage_snapshots cs
      INNER JOIN sessions s ON cs.session_id = s.id
      WHERE s.account_id = ${accountId}
      GROUP BY cs.field_type, cs.field_name, cs.framework
    `);

    const canonical: Record<string, number> = {};
    const frameworkNative: Record<string, number> = {};

    // Initialize canonical fields to 0
    for (const cf of CANONICAL_FIELDS) {
      canonical[cf] = 0;
    }

    for (const row of (results as unknown as Array<{
      field_type: string;
      field_name: string;
      framework: string | null;
      max_score: number;
    }>)) {
      if (row.field_type === 'canonical') {
        canonical[row.field_name] = Math.min(100, Math.max(0, row.max_score));
      } else {
        // For framework-native fields, key is "framework:fieldName"
        const key = row.framework
          ? `${row.framework}:${row.field_name}`
          : row.field_name;
        frameworkNative[key] = Math.min(100, Math.max(0, row.max_score));
      }
    }

    return {
      canonical: canonical as Record<CanonicalField, number>,
      frameworkNative,
      lastUpdated: new Date(),
    };
  }

  /**
   * Identify gaps relative to deal stage targets.
   * Returns fields below the gap threshold (default 60) or below the
   * deal-stage-specific targets.
   */
  identifyGaps(coverage: CoverageScoreMap, dealStage: DealStage): CoverageGap[] {
    const gaps: CoverageGap[] = [];
    const targets = DEAL_STAGE_TARGETS[dealStage] ?? DEAL_STAGE_TARGETS.first_discovery;

    // Check canonical fields
    for (const field of CANONICAL_FIELDS) {
      const currentScore = coverage.canonical[field] ?? 0;
      const targetScore = targets[field] ?? this.gapThreshold;

      if (currentScore < targetScore) {
        gaps.push({
          field,
          fieldType: 'canonical',
          currentScore,
          targetScore,
        });
      }
    }

    // Check framework-native fields
    for (const [key, score] of Object.entries(coverage.frameworkNative)) {
      if (score < this.gapThreshold) {
        const [framework] = key.split(':');
        gaps.push({
          field: key,
          fieldType: 'framework_native',
          currentScore: score,
          targetScore: this.gapThreshold,
          framework: framework as Framework,
        });
      }
    }

    // Sort by severity (largest gap first)
    gaps.sort((a, b) => (b.targetScore - b.currentScore) - (a.targetScore - a.currentScore));

    return gaps;
  }

  // ─── Additional Methods (beyond interface) ──────────────────────────────────

  /**
   * Determine whether all canonical fields have reached the wrap-up threshold (80+).
   * When true, the system should suggest wrap-up and next-step commitment questions.
   *
   * Requirements: 3.9
   */
  isWrapUpReady(coverage: CoverageScoreMap): boolean {
    for (const field of CANONICAL_FIELDS) {
      const score = coverage.canonical[field] ?? 0;
      if (score < this.wrapUpThreshold) {
        return false;
      }
    }
    return true;
  }

  /**
   * Suggest stakeholder personas that can help fill coverage gaps.
   * Maps each gap to the buyer personas best positioned to address it.
   *
   * Requirements: 3.8
   */
  suggestStakeholders(gaps: CoverageGap[]): StakeholderRecommendation[] {
    const recommendations: StakeholderRecommendation[] = [];
    const seenPersonas = new Set<BuyerPersona>();

    for (const gap of gaps) {
      if (gap.fieldType !== 'canonical') continue;

      const field = gap.field as CanonicalField;
      const personas = CANONICAL_FIELD_PERSONA_MAP[field] ?? [];

      for (const persona of personas) {
        if (seenPersonas.has(persona)) continue;
        seenPersonas.add(persona);

        // Collect all canonical fields this persona can address
        const relevantFields = CANONICAL_FIELDS.filter(
          (cf) => CANONICAL_FIELD_PERSONA_MAP[cf]?.includes(persona)
        );

        // Priority based on how many gaps this persona can address
        const gapFieldsForPersona = gaps
          .filter((g) => g.fieldType === 'canonical' && relevantFields.includes(g.field as CanonicalField))
          .length;

        recommendations.push({
          buyerPersona: persona,
          relevantFields,
          rationale: `Can address ${gapFieldsForPersona} coverage gap(s) including ${field}`,
          priority: gapFieldsForPersona,
        });
      }
    }

    // Sort by priority (most gaps addressable first)
    recommendations.sort((a, b) => b.priority - a.priority);

    return recommendations;
  }

  /**
   * Calculate whether a field should advance based on the configurable
   * advancement threshold (default 70% of questions at 70+ score).
   *
   * Requirements: 3.15
   */
  shouldFieldAdvance(sessionId: string, field: CanonicalField | string): boolean {
    const fieldScores = this.getFieldScores(sessionId, field);
    if (fieldScores.length === 0) return false;

    const metCount = fieldScores.filter((s) => s.score >= this.intentScoreThreshold).length;
    const proportion = metCount / fieldScores.length;

    return proportion >= this.advancementThreshold;
  }

  /**
   * Get the advancement proportion for a field (useful for UI progress).
   */
  getAdvancementProportion(sessionId: string, field: CanonicalField | string): number {
    const fieldScores = this.getFieldScores(sessionId, field);
    if (fieldScores.length === 0) return 0;

    const metCount = fieldScores.filter((s) => s.score >= this.intentScoreThreshold).length;
    return metCount / fieldScores.length;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Track a new intent score in the in-memory session state.
   */
  private trackIntentScore(
    sessionId: string,
    field: CanonicalField | string,
    intentScore: QuestionIntentScore,
  ): void {
    if (!this.sessionFieldScores.has(sessionId)) {
      this.sessionFieldScores.set(sessionId, new Map());
    }

    const sessionMap = this.sessionFieldScores.get(sessionId)!;
    if (!sessionMap.has(field)) {
      sessionMap.set(field, []);
    }

    const fieldScores = sessionMap.get(field)!;

    // Update existing score for the same question or add new
    const existingIdx = fieldScores.findIndex((s) => s.questionId === intentScore.questionId);
    const entry: FieldIntentScores = {
      questionId: intentScore.questionId,
      score: intentScore.score,
      isMet: intentScore.score >= this.intentScoreThreshold,
    };

    if (existingIdx >= 0) {
      fieldScores[existingIdx] = entry;
    } else {
      fieldScores.push(entry);
    }
  }

  /**
   * Get all intent scores tracked for a field in a session.
   */
  private getFieldScores(sessionId: string, field: CanonicalField | string): FieldIntentScores[] {
    return this.sessionFieldScores.get(sessionId)?.get(field) ?? [];
  }

  /**
   * Calculate coverage score for a field.
   * Coverage = (number of questions with score >= threshold / total questions) * 100
   */
  private calculateFieldCoverage(fieldScores: FieldIntentScores[]): number {
    if (fieldScores.length === 0) return 0;

    const metCount = fieldScores.filter((s) => s.isMet).length;
    return Math.round((metCount / fieldScores.length) * 100);
  }

  /**
   * Check if a field name is a canonical field.
   */
  private isCanonicalField(field: string): field is CanonicalField {
    return CANONICAL_FIELDS.includes(field as CanonicalField);
  }

  /**
   * Persist a coverage snapshot to the database.
   */
  private async persistCoverageSnapshot(
    sessionId: string,
    fieldType: 'canonical' | 'framework_native',
    fieldName: string,
    score: number,
    framework?: string,
  ): Promise<void> {
    await db.insert(schema.coverageSnapshots).values({
      sessionId,
      fieldType,
      fieldName,
      framework: framework ?? null,
      score: Math.min(100, Math.max(0, score)),
    });
  }

  /**
   * Build the full coverage map for a session from in-memory state.
   */
  private buildSessionCoverageMap(sessionId: string): CoverageScoreMap {
    const canonical: Record<string, number> = {};
    const frameworkNative: Record<string, number> = {};

    // Initialize canonical fields to 0
    for (const cf of CANONICAL_FIELDS) {
      canonical[cf] = 0;
    }

    const sessionMap = this.sessionFieldScores.get(sessionId);
    if (sessionMap) {
      for (const [field, scores] of sessionMap.entries()) {
        const coverage = this.calculateFieldCoverage(scores);
        if (this.isCanonicalField(field)) {
          canonical[field] = coverage;
        } else {
          frameworkNative[field] = coverage;
        }
      }
    }

    return {
      canonical: canonical as Record<CanonicalField, number>,
      frameworkNative,
      lastUpdated: new Date(),
    };
  }
}
