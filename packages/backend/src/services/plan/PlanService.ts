/**
 * Plan Service — CRUD, versioning, approval workflow, and comparison
 * for flatbed load plans.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */

import { db, schema } from '../../db/index.js';
import { eq, desc, and } from 'drizzle-orm';
import type { IPlanRepository, PlanRecord, VersionRecord } from './PlanRepository.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlanStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'superseded';

export interface CreatePlanInput {
  createdBy: string;
  trailerId: string;
  tractorId: string;
  pattern?: string;
  freightManifest?: Record<string, unknown>[];
}

export interface SavePlanInput {
  placedFreight?: Record<string, unknown>[];
  weightMetrics?: Record<string, unknown>;
  securementPlan?: Record<string, unknown>;
  loadingSequence?: Record<string, unknown>[];
  warnings?: Record<string, unknown>[];
  pattern?: string;
  freightManifest?: Record<string, unknown>[];
}

export interface VersionDiff {
  field: string;
  versionA: unknown;
  versionB: unknown;
}

export interface PlanComparison {
  planId: string;
  versionA: number;
  versionB: number;
  differences: VersionDiff[];
}

// ─── Default Drizzle Repository Implementation ────────────────────────────────

class DrizzlePlanRepository implements IPlanRepository {
  async insertPlan(data: Omit<PlanRecord, 'id' | 'createdAt' | 'updatedAt' | 'multiLoadSetId'>): Promise<PlanRecord> {
    const [plan] = await db
      .insert(schema.loadPlans)
      .values({
        createdBy: data.createdBy,
        trailerId: data.trailerId,
        tractorId: data.tractorId,
        currentVersion: data.currentVersion,
        status: data.status as any,
        pattern: data.pattern as any,
        freightManifest: data.freightManifest ?? null,
      })
      .returning();
    return plan as unknown as PlanRecord;
  }

  async insertVersion(data: Omit<VersionRecord, 'id' | 'createdAt'>): Promise<VersionRecord> {
    const [version] = await db
      .insert(schema.planVersions)
      .values({
        planId: data.planId,
        versionNumber: data.versionNumber,
        status: data.status as any,
        createdBy: data.createdBy,
        placedFreight: data.placedFreight ?? null,
        weightMetrics: data.weightMetrics ?? null,
        securementPlan: data.securementPlan ?? null,
        loadingSequence: data.loadingSequence ?? null,
        warnings: data.warnings ?? null,
        approvedBy: data.approvedBy ?? null,
        approvedAt: data.approvedAt ?? null,
        rejectionReason: data.rejectionReason ?? null,
      })
      .returning();
    return version as unknown as VersionRecord;
  }

  async getPlanById(planId: string): Promise<PlanRecord | null> {
    const [plan] = await db
      .select()
      .from(schema.loadPlans)
      .where(eq(schema.loadPlans.id, planId));
    return (plan as unknown as PlanRecord) ?? null;
  }

  async getVersionByPlanAndNumber(planId: string, versionNumber: number): Promise<VersionRecord | null> {
    const [version] = await db
      .select()
      .from(schema.planVersions)
      .where(
        and(
          eq(schema.planVersions.planId, planId),
          eq(schema.planVersions.versionNumber, versionNumber)
        )
      );
    return (version as unknown as VersionRecord) ?? null;
  }

  async getVersionsByPlanId(planId: string): Promise<VersionRecord[]> {
    const versions = await db
      .select()
      .from(schema.planVersions)
      .where(eq(schema.planVersions.planId, planId))
      .orderBy(desc(schema.planVersions.versionNumber));
    return versions as unknown as VersionRecord[];
  }

  async listPlans(options: { userId?: string; status?: string; limit: number; offset: number }): Promise<PlanRecord[]> {
    const { userId, status, limit, offset } = options;
    let query = db
      .select()
      .from(schema.loadPlans)
      .orderBy(desc(schema.loadPlans.updatedAt))
      .limit(limit)
      .offset(offset);

    const conditions = [];
    if (userId) conditions.push(eq(schema.loadPlans.createdBy, userId));
    if (status) conditions.push(eq(schema.loadPlans.status, status as any));

    if (conditions.length > 0) {
      query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions)) as any;
    }

    const plans = await query;
    return plans as unknown as PlanRecord[];
  }

  async updatePlan(planId: string, data: Partial<PlanRecord>): Promise<PlanRecord | null> {
    const [updated] = await db
      .update(schema.loadPlans)
      .set(data as any)
      .where(eq(schema.loadPlans.id, planId))
      .returning();
    return (updated as unknown as PlanRecord) ?? null;
  }

  async updateVersion(planId: string, versionNumber: number, data: Partial<VersionRecord>): Promise<VersionRecord | null> {
    const [updated] = await db
      .update(schema.planVersions)
      .set(data as any)
      .where(
        and(
          eq(schema.planVersions.planId, planId),
          eq(schema.planVersions.versionNumber, versionNumber)
        )
      )
      .returning();
    return (updated as unknown as VersionRecord) ?? null;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class PlanService {
  private repo: IPlanRepository;

  constructor(repo?: IPlanRepository) {
    this.repo = repo ?? new DrizzlePlanRepository();
  }

  /**
   * Create a new load plan with an initial draft version (v1).
   */
  async createPlan(input: CreatePlanInput) {
    const { createdBy, trailerId, tractorId, pattern, freightManifest } = input;

    const plan = await this.repo.insertPlan({
      createdBy,
      trailerId,
      tractorId,
      currentVersion: 1,
      status: 'draft',
      pattern: pattern ?? null,
      freightManifest: freightManifest ?? null,
    });

    const version = await this.repo.insertVersion({
      planId: plan.id,
      versionNumber: 1,
      status: 'draft',
      createdBy,
      placedFreight: null,
      weightMetrics: null,
      securementPlan: null,
      loadingSequence: null,
      warnings: null,
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
    });

    return { plan, version };
  }

  /**
   * Save (update) a plan — increments version number on every save.
   * If the plan is approved, creates a new version and sets status to draft (requiring re-approval).
   * Requirement 14.1: version increments on every save
   * Requirement 14.4: lock approved plans; new mods create new version
   * Requirement 14.6: modification after approval creates new version requiring re-approval
   */
  async savePlan(planId: string, userId: string, input: SavePlanInput) {
    const plan = await this.repo.getPlanById(planId);

    if (!plan) {
      throw new PlanNotFoundError(planId);
    }

    // If the plan is approved, mark the current approved version as superseded
    if (plan.status === 'approved') {
      await this.repo.updateVersion(planId, plan.currentVersion, { status: 'superseded' });
    }

    const newVersionNumber = plan.currentVersion + 1;

    const newVersion = await this.repo.insertVersion({
      planId,
      versionNumber: newVersionNumber,
      status: 'draft',
      createdBy: userId,
      placedFreight: input.placedFreight ?? null,
      weightMetrics: input.weightMetrics ?? null,
      securementPlan: input.securementPlan ?? null,
      loadingSequence: input.loadingSequence ?? null,
      warnings: input.warnings ?? null,
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
    });

    const updatedPlan = await this.repo.updatePlan(planId, {
      currentVersion: newVersionNumber,
      status: 'draft',
      pattern: input.pattern ? input.pattern : plan.pattern,
      freightManifest: input.freightManifest ?? plan.freightManifest,
      updatedAt: new Date(),
    });

    return { plan: updatedPlan, version: newVersion };
  }

  /**
   * Retrieve a plan by ID with its current version data.
   */
  async getPlan(planId: string) {
    const plan = await this.repo.getPlanById(planId);

    if (!plan) {
      throw new PlanNotFoundError(planId);
    }

    const currentVersion = await this.repo.getVersionByPlanAndNumber(planId, plan.currentVersion);

    return { plan, currentVersion };
  }

  /**
   * List all plans, optionally filtered by userId or status.
   */
  async listPlans(options?: { userId?: string; status?: PlanStatus; limit?: number; offset?: number }) {
    const { userId, status, limit = 50, offset = 0 } = options ?? {};

    const plans = await this.repo.listPlans({ userId, status, limit, offset });
    return { plans, total: plans.length };
  }

  /**
   * Get all versions for a plan (version history).
   * Requirement 14.5: retain all previous versions
   */
  async getVersionHistory(planId: string) {
    const versions = await this.repo.getVersionsByPlanId(planId);
    return versions;
  }

  /**
   * Get a specific version of a plan.
   */
  async getVersion(planId: string, versionNumber: number) {
    const version = await this.repo.getVersionByPlanAndNumber(planId, versionNumber);

    if (!version) {
      throw new VersionNotFoundError(planId, versionNumber);
    }

    return version;
  }

  /**
   * Submit a plan for approval — transitions draft → pending_approval.
   * Requirement 14.2: Planner submits, status set to "Pending Approval"
   */
  async submitForApproval(planId: string, _userId: string) {
    const plan = await this.repo.getPlanById(planId);

    if (!plan) {
      throw new PlanNotFoundError(planId);
    }

    if (plan.status !== 'draft') {
      throw new InvalidStatusTransitionError(plan.status, 'pending_approval');
    }

    const updatedPlan = await this.repo.updatePlan(planId, {
      status: 'pending_approval',
      updatedAt: new Date(),
    });

    await this.repo.updateVersion(planId, plan.currentVersion, { status: 'pending_approval' });

    return updatedPlan;
  }

  /**
   * Approve a plan — transitions pending_approval → approved.
   * Requirement 14.3: Supervisor approves
   * Requirement 14.4: Lock plan against edits after approval
   */
  async approvePlan(planId: string, approvedBy: string) {
    const plan = await this.repo.getPlanById(planId);

    if (!plan) {
      throw new PlanNotFoundError(planId);
    }

    if (plan.status !== 'pending_approval') {
      throw new InvalidStatusTransitionError(plan.status, 'approved');
    }

    const now = new Date();

    const updatedPlan = await this.repo.updatePlan(planId, {
      status: 'approved',
      updatedAt: now,
    });

    await this.repo.updateVersion(planId, plan.currentVersion, {
      status: 'approved',
      approvedBy,
      approvedAt: now,
    });

    return updatedPlan;
  }

  /**
   * Reject a plan — transitions pending_approval → rejected.
   * Requirement 14.3: Supervisor rejects with reason
   */
  async rejectPlan(planId: string, _rejectedBy: string, reason: string) {
    const plan = await this.repo.getPlanById(planId);

    if (!plan) {
      throw new PlanNotFoundError(planId);
    }

    if (plan.status !== 'pending_approval') {
      throw new InvalidStatusTransitionError(plan.status, 'rejected');
    }

    const updatedPlan = await this.repo.updatePlan(planId, {
      status: 'rejected',
      updatedAt: new Date(),
    });

    await this.repo.updateVersion(planId, plan.currentVersion, {
      status: 'rejected',
      rejectionReason: reason,
    });

    return updatedPlan;
  }

  /**
   * Compare two versions of the same plan — returns field-level differences.
   * Requirement 14.5: allow comparison between any two versions
   */
  async compareVersions(planId: string, versionA: number, versionB: number): Promise<PlanComparison> {
    const verA = await this.repo.getVersionByPlanAndNumber(planId, versionA);
    const verB = await this.repo.getVersionByPlanAndNumber(planId, versionB);

    if (!verA) {
      throw new VersionNotFoundError(planId, versionA);
    }
    if (!verB) {
      throw new VersionNotFoundError(planId, versionB);
    }

    const differences: VersionDiff[] = [];

    const fieldsToCompare: Array<keyof VersionRecord> = [
      'placedFreight',
      'weightMetrics',
      'securementPlan',
      'loadingSequence',
      'warnings',
      'status',
    ];

    for (const field of fieldsToCompare) {
      const valA = verA[field];
      const valB = verB[field];

      if (JSON.stringify(valA) !== JSON.stringify(valB)) {
        differences.push({ field, versionA: valA, versionB: valB });
      }
    }

    return { planId, versionA, versionB, differences };
  }
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class PlanNotFoundError extends Error {
  public statusCode = 404;
  constructor(planId: string) {
    super(`Plan not found: ${planId}`);
    this.name = 'PlanNotFoundError';
  }
}

export class VersionNotFoundError extends Error {
  public statusCode = 404;
  constructor(planId: string, version: number) {
    super(`Version ${version} not found for plan: ${planId}`);
    this.name = 'VersionNotFoundError';
  }
}

export class InvalidStatusTransitionError extends Error {
  public statusCode = 409;
  constructor(currentStatus: string, targetStatus: string) {
    super(`Cannot transition from '${currentStatus}' to '${targetStatus}'`);
    this.name = 'InvalidStatusTransitionError';
  }
}

export class PlanLockedError extends Error {
  public statusCode = 409;
  constructor(planId: string) {
    super(`Plan ${planId} is approved and locked. Create a new version to modify.`);
    this.name = 'PlanLockedError';
  }
}
