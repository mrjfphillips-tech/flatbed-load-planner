/**
 * Verification Service — Checklist generation, completion, discrepancy reporting,
 * and loader progress tracking for flatbed load plans.
 *
 * Requirements: 18.1, 18.2, 18.3, 18.4
 */

import { db, schema } from '../../db/index.js';
import { eq } from 'drizzle-orm';
import type {
  IVerificationRepository,
  ChecklistRecord,
  ChecklistItemCheck,
  SecurementCheck,
  LoadingProgressRecord,
  LoadingStep,
} from './VerificationRepository.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GenerateChecklistInput {
  planVersionId: string;
  /** Items from the plan's placed freight (order numbers / IDs) */
  itemIds: string[];
  /** Securement assignment IDs from the plan */
  securementIds: string[];
}

export interface UpdateChecklistInput {
  itemPresenceChecks?: ChecklistItemCheck[];
  securementChecks?: SecurementCheck[];
  weightCheckVerified?: boolean;
  weightCheckNotes?: string;
  damageCheckVerified?: boolean;
  damageCheckNotes?: string;
}

export interface CompleteChecklistInput {
  driverId: string;
}

export interface ReportDiscrepancyInput {
  driverId: string;
  description: string;
}

export interface InitLoadingProgressInput {
  planId: string;
  steps: { stepNumber: number; description: string }[];
}

export interface MarkStepCompleteInput {
  stepNumber: number;
  completedBy: string;
}

// ─── Default Drizzle Repository Implementation ────────────────────────────────

class DrizzleVerificationRepository implements IVerificationRepository {
  async getChecklistByPlanVersionId(planVersionId: string): Promise<ChecklistRecord | null> {
    const [row] = await db
      .select()
      .from(schema.verificationChecklists)
      .where(eq(schema.verificationChecklists.planVersionId, planVersionId));
    return (row as unknown as ChecklistRecord) ?? null;
  }

  async insertChecklist(data: Omit<ChecklistRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChecklistRecord> {
    const [row] = await db
      .insert(schema.verificationChecklists)
      .values({
        planVersionId: data.planVersionId,
        driverId: data.driverId,
        itemPresenceChecks: data.itemPresenceChecks,
        securementChecks: data.securementChecks,
        weightCheckVerified: data.weightCheckVerified,
        weightCheckNotes: data.weightCheckNotes,
        damageCheckVerified: data.damageCheckVerified,
        damageCheckNotes: data.damageCheckNotes,
        allVerified: data.allVerified,
        verifiedAt: data.verifiedAt,
        nonConformanceDescription: data.nonConformanceDescription,
        supervisorNotified: data.supervisorNotified,
      })
      .returning();
    return row as unknown as ChecklistRecord;
  }

  async updateChecklist(id: string, data: Partial<ChecklistRecord>): Promise<ChecklistRecord | null> {
    const [row] = await db
      .update(schema.verificationChecklists)
      .set({ ...(data as any), updatedAt: new Date() })
      .where(eq(schema.verificationChecklists.id, id))
      .returning();
    return (row as unknown as ChecklistRecord) ?? null;
  }

  async getLoadingProgressByPlanId(planId: string): Promise<LoadingProgressRecord | null> {
    const [row] = await db
      .select()
      .from(schema.loadingProgress)
      .where(eq(schema.loadingProgress.planId, planId));
    return (row as unknown as LoadingProgressRecord) ?? null;
  }

  async insertLoadingProgress(data: Omit<LoadingProgressRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<LoadingProgressRecord> {
    const [row] = await db
      .insert(schema.loadingProgress)
      .values({
        planId: data.planId,
        totalSteps: data.totalSteps,
        completedSteps: data.completedSteps,
        steps: data.steps,
      })
      .returning();
    return row as unknown as LoadingProgressRecord;
  }

  async updateLoadingProgress(id: string, data: Partial<LoadingProgressRecord>): Promise<LoadingProgressRecord | null> {
    const [row] = await db
      .update(schema.loadingProgress)
      .set({ ...(data as any), updatedAt: new Date() })
      .where(eq(schema.loadingProgress.id, id))
      .returning();
    return (row as unknown as LoadingProgressRecord) ?? null;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class VerificationService {
  private repo: IVerificationRepository;

  constructor(repo?: IVerificationRepository) {
    this.repo = repo ?? new DrizzleVerificationRepository();
  }

  /**
   * Get or generate a verification checklist for an approved plan version.
   * If one already exists for the plan version, return it. Otherwise generate a new one.
   *
   * Requirement 18.1: Generate verification checklist with item presence, securement,
   * weight, and damage checks.
   */
  async getOrGenerateChecklist(input: GenerateChecklistInput): Promise<ChecklistRecord> {
    const { planVersionId, itemIds, securementIds } = input;

    // Check if a checklist already exists for this plan version
    const existing = await this.repo.getChecklistByPlanVersionId(planVersionId);
    if (existing) {
      return existing;
    }

    // Generate a new checklist
    const itemPresenceChecks: ChecklistItemCheck[] = itemIds.map((itemId) => ({
      itemId,
      verified: false,
    }));

    const securementChecks: SecurementCheck[] = securementIds.map((securementId) => ({
      securementId,
      verified: false,
    }));

    const checklist = await this.repo.insertChecklist({
      planVersionId,
      driverId: null,
      itemPresenceChecks,
      securementChecks,
      weightCheckVerified: false,
      weightCheckNotes: null,
      damageCheckVerified: false,
      damageCheckNotes: null,
      allVerified: false,
      verifiedAt: null,
      nonConformanceDescription: null,
      supervisorNotified: false,
    });

    return checklist;
  }

  /**
   * Update individual checklist items (item presence, securement, weight, damage).
   */
  async updateChecklist(planVersionId: string, input: UpdateChecklistInput): Promise<ChecklistRecord> {
    const checklist = await this.repo.getChecklistByPlanVersionId(planVersionId);

    if (!checklist) {
      throw new ChecklistNotFoundError(planVersionId);
    }

    if (checklist.allVerified) {
      throw new ChecklistAlreadyCompletedError(planVersionId);
    }

    const updateData: Partial<ChecklistRecord> = {};

    if (input.itemPresenceChecks !== undefined) {
      updateData.itemPresenceChecks = input.itemPresenceChecks;
    }
    if (input.securementChecks !== undefined) {
      updateData.securementChecks = input.securementChecks;
    }
    if (input.weightCheckVerified !== undefined) {
      updateData.weightCheckVerified = input.weightCheckVerified;
    }
    if (input.weightCheckNotes !== undefined) {
      updateData.weightCheckNotes = input.weightCheckNotes;
    }
    if (input.damageCheckVerified !== undefined) {
      updateData.damageCheckVerified = input.damageCheckVerified;
    }
    if (input.damageCheckNotes !== undefined) {
      updateData.damageCheckNotes = input.damageCheckNotes;
    }

    const updated = await this.repo.updateChecklist(checklist.id, updateData);
    return updated!;
  }

  /**
   * Mark the checklist as fully complete.
   * All items must be verified before this can succeed.
   *
   * Requirement 18.2: Record verification timestamp and Driver identity.
   */
  async completeChecklist(planVersionId: string, input: CompleteChecklistInput): Promise<ChecklistRecord> {
    const checklist = await this.repo.getChecklistByPlanVersionId(planVersionId);

    if (!checklist) {
      throw new ChecklistNotFoundError(planVersionId);
    }

    if (checklist.allVerified) {
      throw new ChecklistAlreadyCompletedError(planVersionId);
    }

    // Verify all items are checked
    const allItemsVerified = (checklist.itemPresenceChecks ?? []).every((c) => c.verified);
    const allSecurementVerified = (checklist.securementChecks ?? []).every((c) => c.verified);
    const weightVerified = checklist.weightCheckVerified;
    const damageVerified = checklist.damageCheckVerified;

    if (!allItemsVerified || !allSecurementVerified || !weightVerified || !damageVerified) {
      throw new ChecklistIncompleteError(planVersionId);
    }

    const now = new Date();
    const updated = await this.repo.updateChecklist(checklist.id, {
      allVerified: true,
      verifiedAt: now,
      driverId: input.driverId,
    });

    return updated!;
  }

  /**
   * Report a non-conforming item in the checklist.
   *
   * Requirement 18.3: Require discrepancy description and notify Supervisor.
   */
  async reportDiscrepancy(planVersionId: string, input: ReportDiscrepancyInput): Promise<ChecklistRecord> {
    const checklist = await this.repo.getChecklistByPlanVersionId(planVersionId);

    if (!checklist) {
      throw new ChecklistNotFoundError(planVersionId);
    }

    if (!input.description || input.description.trim().length === 0) {
      throw new DiscrepancyDescriptionRequiredError();
    }

    const updated = await this.repo.updateChecklist(checklist.id, {
      nonConformanceDescription: input.description,
      supervisorNotified: true,
      driverId: input.driverId,
    });

    return updated!;
  }

  // ─── Loading Progress ─────────────────────────────────────────────────────────

  /**
   * Get or initialize loading progress for a plan.
   *
   * Requirement 18.4: Loaders mark loading steps as complete in sequence.
   */
  async getOrInitLoadingProgress(input: InitLoadingProgressInput): Promise<LoadingProgressRecord> {
    const { planId, steps } = input;

    const existing = await this.repo.getLoadingProgressByPlanId(planId);
    if (existing) {
      return existing;
    }

    const loadingSteps: LoadingStep[] = steps.map((s) => ({
      stepNumber: s.stepNumber,
      description: s.description,
      completed: false,
    }));

    const progress = await this.repo.insertLoadingProgress({
      planId,
      totalSteps: steps.length,
      completedSteps: 0,
      steps: loadingSteps,
    });

    return progress;
  }

  /**
   * Get loading progress for a plan.
   */
  async getLoadingProgress(planId: string): Promise<LoadingProgressRecord> {
    const progress = await this.repo.getLoadingProgressByPlanId(planId);

    if (!progress) {
      throw new LoadingProgressNotFoundError(planId);
    }

    return progress;
  }

  /**
   * Mark a step as complete. Steps must be completed in sequence.
   *
   * Requirement 18.4: Step-by-step completion marking with real-time progress.
   */
  async markStepComplete(planId: string, input: MarkStepCompleteInput): Promise<LoadingProgressRecord> {
    const progress = await this.repo.getLoadingProgressByPlanId(planId);

    if (!progress) {
      throw new LoadingProgressNotFoundError(planId);
    }

    const steps = progress.steps ?? [];
    const stepIndex = steps.findIndex((s) => s.stepNumber === input.stepNumber);

    if (stepIndex === -1) {
      throw new StepNotFoundError(planId, input.stepNumber);
    }

    // Enforce sequential completion: all prior steps must be completed
    for (let i = 0; i < stepIndex; i++) {
      if (!steps[i].completed) {
        throw new StepOutOfOrderError(planId, input.stepNumber, steps[i].stepNumber);
      }
    }

    if (steps[stepIndex].completed) {
      throw new StepAlreadyCompletedError(planId, input.stepNumber);
    }

    // Mark the step as complete
    steps[stepIndex].completed = true;
    steps[stepIndex].completedBy = input.completedBy;
    steps[stepIndex].completedAt = new Date().toISOString();

    const completedSteps = steps.filter((s) => s.completed).length;

    const updated = await this.repo.updateLoadingProgress(progress.id, {
      steps,
      completedSteps,
    });

    return updated!;
  }
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ChecklistNotFoundError extends Error {
  public statusCode = 404;
  constructor(planVersionId: string) {
    super(`Verification checklist not found for plan version: ${planVersionId}`);
    this.name = 'ChecklistNotFoundError';
  }
}

export class ChecklistAlreadyCompletedError extends Error {
  public statusCode = 409;
  constructor(planVersionId: string) {
    super(`Verification checklist already completed for plan version: ${planVersionId}`);
    this.name = 'ChecklistAlreadyCompletedError';
  }
}

export class ChecklistIncompleteError extends Error {
  public statusCode = 400;
  constructor(planVersionId: string) {
    super(`Not all checklist items are verified for plan version: ${planVersionId}`);
    this.name = 'ChecklistIncompleteError';
  }
}

export class DiscrepancyDescriptionRequiredError extends Error {
  public statusCode = 400;
  constructor() {
    super('A description of the discrepancy is required');
    this.name = 'DiscrepancyDescriptionRequiredError';
  }
}

export class LoadingProgressNotFoundError extends Error {
  public statusCode = 404;
  constructor(planId: string) {
    super(`Loading progress not found for plan: ${planId}`);
    this.name = 'LoadingProgressNotFoundError';
  }
}

export class StepNotFoundError extends Error {
  public statusCode = 404;
  constructor(planId: string, stepNumber: number) {
    super(`Step ${stepNumber} not found in loading progress for plan: ${planId}`);
    this.name = 'StepNotFoundError';
  }
}

export class StepOutOfOrderError extends Error {
  public statusCode = 400;
  constructor(planId: string, attemptedStep: number, missingStep: number) {
    super(`Cannot complete step ${attemptedStep} before step ${missingStep} for plan: ${planId}`);
    this.name = 'StepOutOfOrderError';
  }
}

export class StepAlreadyCompletedError extends Error {
  public statusCode = 409;
  constructor(planId: string, stepNumber: number) {
    super(`Step ${stepNumber} is already completed for plan: ${planId}`);
    this.name = 'StepAlreadyCompletedError';
  }
}
