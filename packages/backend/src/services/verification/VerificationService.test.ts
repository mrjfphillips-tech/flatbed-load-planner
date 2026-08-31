/**
 * Unit Tests for VerificationService — Checklist generation, completion,
 * discrepancy reporting, and loader progress tracking.
 *
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the database module to prevent PostgreSQL connection attempts
vi.mock('../../db/index.js', () => ({
  db: {},
  schema: { verificationChecklists: {}, loadingProgress: {} },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

import {
  VerificationService,
  ChecklistNotFoundError,
  ChecklistAlreadyCompletedError,
  ChecklistIncompleteError,
  DiscrepancyDescriptionRequiredError,
  LoadingProgressNotFoundError,
  StepNotFoundError,
  StepOutOfOrderError,
  StepAlreadyCompletedError,
} from './VerificationService.js';

import type {
  IVerificationRepository,
  ChecklistRecord,
  LoadingProgressRecord,
} from './VerificationRepository.js';

// ─── In-Memory Repository ─────────────────────────────────────────────────────

class InMemoryVerificationRepository implements IVerificationRepository {
  checklists: ChecklistRecord[] = [];
  loadingProgressRecords: LoadingProgressRecord[] = [];
  private idSeq = 0;
  private nextId() { return `id-${++this.idSeq}`; }

  async getChecklistByPlanVersionId(planVersionId: string): Promise<ChecklistRecord | null> {
    return this.checklists.find((c) => c.planVersionId === planVersionId) ?? null;
  }

  async insertChecklist(data: Omit<ChecklistRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChecklistRecord> {
    const record: ChecklistRecord = {
      ...data,
      id: this.nextId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.checklists.push(record);
    return record;
  }

  async updateChecklist(id: string, data: Partial<ChecklistRecord>): Promise<ChecklistRecord | null> {
    const idx = this.checklists.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.checklists[idx] = { ...this.checklists[idx], ...data, updatedAt: new Date() };
    return this.checklists[idx];
  }

  async getLoadingProgressByPlanId(planId: string): Promise<LoadingProgressRecord | null> {
    return this.loadingProgressRecords.find((p) => p.planId === planId) ?? null;
  }

  async insertLoadingProgress(data: Omit<LoadingProgressRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<LoadingProgressRecord> {
    const record: LoadingProgressRecord = {
      ...data,
      id: this.nextId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.loadingProgressRecords.push(record);
    return record;
  }

  async updateLoadingProgress(id: string, data: Partial<LoadingProgressRecord>): Promise<LoadingProgressRecord | null> {
    const idx = this.loadingProgressRecords.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.loadingProgressRecords[idx] = { ...this.loadingProgressRecords[idx], ...data, updatedAt: new Date() };
    return this.loadingProgressRecords[idx];
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VerificationService', () => {
  let repo: InMemoryVerificationRepository;
  let service: VerificationService;

  beforeEach(() => {
    repo = new InMemoryVerificationRepository();
    service = new VerificationService(repo);
  });

  // ─── Checklist Generation (Req 18.1) ──────────────────────────────────────

  describe('getOrGenerateChecklist', () => {
    it('generates a checklist with item presence, securement, weight, and damage checks', async () => {
      const result = await service.getOrGenerateChecklist({
        planVersionId: 'pv-1',
        itemIds: ['item-A', 'item-B', 'item-C'],
        securementIds: ['sec-1', 'sec-2'],
      });

      expect(result).toBeDefined();
      expect(result.planVersionId).toBe('pv-1');
      expect(result.itemPresenceChecks).toHaveLength(3);
      expect(result.itemPresenceChecks![0]).toEqual({ itemId: 'item-A', verified: false });
      expect(result.itemPresenceChecks![1]).toEqual({ itemId: 'item-B', verified: false });
      expect(result.itemPresenceChecks![2]).toEqual({ itemId: 'item-C', verified: false });
      expect(result.securementChecks).toHaveLength(2);
      expect(result.securementChecks![0]).toEqual({ securementId: 'sec-1', verified: false });
      expect(result.securementChecks![1]).toEqual({ securementId: 'sec-2', verified: false });
      expect(result.weightCheckVerified).toBe(false);
      expect(result.damageCheckVerified).toBe(false);
      expect(result.allVerified).toBe(false);
      expect(result.verifiedAt).toBeNull();
    });

    it('returns existing checklist if one already exists for the plan version', async () => {
      const first = await service.getOrGenerateChecklist({
        planVersionId: 'pv-1',
        itemIds: ['item-A'],
        securementIds: ['sec-1'],
      });

      const second = await service.getOrGenerateChecklist({
        planVersionId: 'pv-1',
        itemIds: ['item-X', 'item-Y'],
        securementIds: ['sec-99'],
      });

      // Should return the same record, not create a new one
      expect(second.id).toBe(first.id);
      expect(second.itemPresenceChecks).toHaveLength(1); // original, not overwritten
    });
  });

  // ─── Update Checklist ─────────────────────────────────────────────────────

  describe('updateChecklist', () => {
    it('updates item presence checks', async () => {
      await service.getOrGenerateChecklist({
        planVersionId: 'pv-1',
        itemIds: ['item-A', 'item-B'],
        securementIds: ['sec-1'],
      });

      const result = await service.updateChecklist('pv-1', {
        itemPresenceChecks: [
          { itemId: 'item-A', verified: true },
          { itemId: 'item-B', verified: false },
        ],
      });

      expect(result.itemPresenceChecks![0].verified).toBe(true);
      expect(result.itemPresenceChecks![1].verified).toBe(false);
    });

    it('updates weight and damage check fields', async () => {
      await service.getOrGenerateChecklist({
        planVersionId: 'pv-1',
        itemIds: ['item-A'],
        securementIds: ['sec-1'],
      });

      const result = await service.updateChecklist('pv-1', {
        weightCheckVerified: true,
        weightCheckNotes: 'Scale reading 39,800 lbs - within tolerance',
        damageCheckVerified: true,
        damageCheckNotes: 'No visible damage',
      });

      expect(result.weightCheckVerified).toBe(true);
      expect(result.weightCheckNotes).toBe('Scale reading 39,800 lbs - within tolerance');
      expect(result.damageCheckVerified).toBe(true);
      expect(result.damageCheckNotes).toBe('No visible damage');
    });

    it('throws ChecklistNotFoundError for non-existent plan version', async () => {
      await expect(
        service.updateChecklist('non-existent', { weightCheckVerified: true })
      ).rejects.toThrow(ChecklistNotFoundError);
    });

    it('throws ChecklistAlreadyCompletedError if checklist is already completed', async () => {
      // Create and complete a checklist
      await service.getOrGenerateChecklist({
        planVersionId: 'pv-1',
        itemIds: ['item-A'],
        securementIds: ['sec-1'],
      });

      // Mark everything verified
      await service.updateChecklist('pv-1', {
        itemPresenceChecks: [{ itemId: 'item-A', verified: true }],
        securementChecks: [{ securementId: 'sec-1', verified: true }],
        weightCheckVerified: true,
        damageCheckVerified: true,
      });

      await service.completeChecklist('pv-1', { driverId: 'driver-1' });

      // Try to update after completion
      await expect(
        service.updateChecklist('pv-1', { weightCheckVerified: false })
      ).rejects.toThrow(ChecklistAlreadyCompletedError);
    });
  });

  // ─── Complete Checklist (Req 18.2) ────────────────────────────────────────

  describe('completeChecklist', () => {
    it('records verification timestamp and driver identity when all items verified', async () => {
      await service.getOrGenerateChecklist({
        planVersionId: 'pv-1',
        itemIds: ['item-A', 'item-B'],
        securementIds: ['sec-1'],
      });

      await service.updateChecklist('pv-1', {
        itemPresenceChecks: [
          { itemId: 'item-A', verified: true },
          { itemId: 'item-B', verified: true },
        ],
        securementChecks: [{ securementId: 'sec-1', verified: true }],
        weightCheckVerified: true,
        damageCheckVerified: true,
      });

      const before = new Date();
      const result = await service.completeChecklist('pv-1', { driverId: 'driver-42' });

      expect(result.allVerified).toBe(true);
      expect(result.driverId).toBe('driver-42');
      expect(result.verifiedAt).toBeInstanceOf(Date);
      expect(result.verifiedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('throws ChecklistIncompleteError if not all items are verified', async () => {
      await service.getOrGenerateChecklist({
        planVersionId: 'pv-1',
        itemIds: ['item-A', 'item-B'],
        securementIds: ['sec-1'],
      });

      // Only verify some items
      await service.updateChecklist('pv-1', {
        itemPresenceChecks: [
          { itemId: 'item-A', verified: true },
          { itemId: 'item-B', verified: false }, // not verified
        ],
        securementChecks: [{ securementId: 'sec-1', verified: true }],
        weightCheckVerified: true,
        damageCheckVerified: true,
      });

      await expect(
        service.completeChecklist('pv-1', { driverId: 'driver-1' })
      ).rejects.toThrow(ChecklistIncompleteError);
    });

    it('throws ChecklistIncompleteError if weight check is not verified', async () => {
      await service.getOrGenerateChecklist({
        planVersionId: 'pv-1',
        itemIds: ['item-A'],
        securementIds: ['sec-1'],
      });

      await service.updateChecklist('pv-1', {
        itemPresenceChecks: [{ itemId: 'item-A', verified: true }],
        securementChecks: [{ securementId: 'sec-1', verified: true }],
        weightCheckVerified: false, // not verified
        damageCheckVerified: true,
      });

      await expect(
        service.completeChecklist('pv-1', { driverId: 'driver-1' })
      ).rejects.toThrow(ChecklistIncompleteError);
    });

    it('throws ChecklistNotFoundError for non-existent plan version', async () => {
      await expect(
        service.completeChecklist('missing', { driverId: 'driver-1' })
      ).rejects.toThrow(ChecklistNotFoundError);
    });

    it('throws ChecklistAlreadyCompletedError if completed twice', async () => {
      await service.getOrGenerateChecklist({
        planVersionId: 'pv-1',
        itemIds: ['item-A'],
        securementIds: ['sec-1'],
      });

      await service.updateChecklist('pv-1', {
        itemPresenceChecks: [{ itemId: 'item-A', verified: true }],
        securementChecks: [{ securementId: 'sec-1', verified: true }],
        weightCheckVerified: true,
        damageCheckVerified: true,
      });

      await service.completeChecklist('pv-1', { driverId: 'driver-1' });

      await expect(
        service.completeChecklist('pv-1', { driverId: 'driver-1' })
      ).rejects.toThrow(ChecklistAlreadyCompletedError);
    });
  });

  // ─── Non-Conforming Item / Discrepancy (Req 18.3) ─────────────────────────

  describe('reportDiscrepancy', () => {
    it('records discrepancy description and notifies supervisor', async () => {
      await service.getOrGenerateChecklist({
        planVersionId: 'pv-1',
        itemIds: ['item-A'],
        securementIds: ['sec-1'],
      });

      const result = await service.reportDiscrepancy('pv-1', {
        driverId: 'driver-5',
        description: 'Item-A has visible dent on top surface, 6 inches long',
      });

      expect(result.nonConformanceDescription).toBe(
        'Item-A has visible dent on top surface, 6 inches long'
      );
      expect(result.supervisorNotified).toBe(true);
      expect(result.driverId).toBe('driver-5');
    });

    it('throws DiscrepancyDescriptionRequiredError if description is empty', async () => {
      await service.getOrGenerateChecklist({
        planVersionId: 'pv-1',
        itemIds: ['item-A'],
        securementIds: ['sec-1'],
      });

      await expect(
        service.reportDiscrepancy('pv-1', { driverId: 'driver-1', description: '' })
      ).rejects.toThrow(DiscrepancyDescriptionRequiredError);
    });

    it('throws DiscrepancyDescriptionRequiredError if description is whitespace only', async () => {
      await service.getOrGenerateChecklist({
        planVersionId: 'pv-1',
        itemIds: ['item-A'],
        securementIds: ['sec-1'],
      });

      await expect(
        service.reportDiscrepancy('pv-1', { driverId: 'driver-1', description: '   ' })
      ).rejects.toThrow(DiscrepancyDescriptionRequiredError);
    });

    it('throws ChecklistNotFoundError for non-existent plan version', async () => {
      await expect(
        service.reportDiscrepancy('non-existent', {
          driverId: 'driver-1',
          description: 'Something wrong',
        })
      ).rejects.toThrow(ChecklistNotFoundError);
    });
  });

  // ─── Loading Progress (Req 18.4) ──────────────────────────────────────────

  describe('getOrInitLoadingProgress', () => {
    it('initializes loading progress with step-by-step tracking', async () => {
      const result = await service.getOrInitLoadingProgress({
        planId: 'plan-1',
        steps: [
          { stepNumber: 1, description: 'Place dunnage at front-left of deck' },
          { stepNumber: 2, description: 'Place coil on dunnage, eye horizontal' },
          { stepNumber: 3, description: 'Apply chains through coil eye' },
        ],
      });

      expect(result.planId).toBe('plan-1');
      expect(result.totalSteps).toBe(3);
      expect(result.completedSteps).toBe(0);
      expect(result.steps).toHaveLength(3);
      expect(result.steps![0]).toEqual({
        stepNumber: 1,
        description: 'Place dunnage at front-left of deck',
        completed: false,
      });
    });

    it('returns existing progress if already initialized', async () => {
      const first = await service.getOrInitLoadingProgress({
        planId: 'plan-1',
        steps: [{ stepNumber: 1, description: 'Step 1' }],
      });

      const second = await service.getOrInitLoadingProgress({
        planId: 'plan-1',
        steps: [
          { stepNumber: 1, description: 'Different' },
          { stepNumber: 2, description: 'Step 2' },
        ],
      });

      expect(second.id).toBe(first.id);
      expect(second.totalSteps).toBe(1); // original
    });
  });

  describe('getLoadingProgress', () => {
    it('retrieves existing loading progress', async () => {
      await service.getOrInitLoadingProgress({
        planId: 'plan-1',
        steps: [{ stepNumber: 1, description: 'Step 1' }],
      });

      const result = await service.getLoadingProgress('plan-1');
      expect(result.planId).toBe('plan-1');
    });

    it('throws LoadingProgressNotFoundError for non-existent plan', async () => {
      await expect(
        service.getLoadingProgress('missing')
      ).rejects.toThrow(LoadingProgressNotFoundError);
    });
  });

  describe('markStepComplete', () => {
    it('marks a step as complete with loader identity and timestamp', async () => {
      await service.getOrInitLoadingProgress({
        planId: 'plan-1',
        steps: [
          { stepNumber: 1, description: 'Step 1' },
          { stepNumber: 2, description: 'Step 2' },
          { stepNumber: 3, description: 'Step 3' },
        ],
      });

      const before = new Date();
      const result = await service.markStepComplete('plan-1', {
        stepNumber: 1,
        completedBy: 'loader-A',
      });

      expect(result.completedSteps).toBe(1);
      expect(result.steps![0].completed).toBe(true);
      expect(result.steps![0].completedBy).toBe('loader-A');
      expect(result.steps![0].completedAt).toBeDefined();
      const completedAt = new Date(result.steps![0].completedAt!);
      expect(completedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('provides real-time progress indicator (completedSteps / totalSteps)', async () => {
      await service.getOrInitLoadingProgress({
        planId: 'plan-1',
        steps: [
          { stepNumber: 1, description: 'Step 1' },
          { stepNumber: 2, description: 'Step 2' },
          { stepNumber: 3, description: 'Step 3' },
          { stepNumber: 4, description: 'Step 4' },
        ],
      });

      await service.markStepComplete('plan-1', { stepNumber: 1, completedBy: 'loader-A' });
      const r2 = await service.markStepComplete('plan-1', { stepNumber: 2, completedBy: 'loader-A' });

      expect(r2.completedSteps).toBe(2);
      expect(r2.totalSteps).toBe(4);
      // Progress = 2/4 = 50%
    });

    it('enforces sequential completion - cannot skip steps', async () => {
      await service.getOrInitLoadingProgress({
        planId: 'plan-1',
        steps: [
          { stepNumber: 1, description: 'Step 1' },
          { stepNumber: 2, description: 'Step 2' },
          { stepNumber: 3, description: 'Step 3' },
        ],
      });

      // Try to complete step 2 without completing step 1
      await expect(
        service.markStepComplete('plan-1', { stepNumber: 2, completedBy: 'loader-A' })
      ).rejects.toThrow(StepOutOfOrderError);
    });

    it('throws StepAlreadyCompletedError if step is already done', async () => {
      await service.getOrInitLoadingProgress({
        planId: 'plan-1',
        steps: [
          { stepNumber: 1, description: 'Step 1' },
          { stepNumber: 2, description: 'Step 2' },
        ],
      });

      await service.markStepComplete('plan-1', { stepNumber: 1, completedBy: 'loader-A' });

      await expect(
        service.markStepComplete('plan-1', { stepNumber: 1, completedBy: 'loader-A' })
      ).rejects.toThrow(StepAlreadyCompletedError);
    });

    it('throws StepNotFoundError for invalid step number', async () => {
      await service.getOrInitLoadingProgress({
        planId: 'plan-1',
        steps: [{ stepNumber: 1, description: 'Step 1' }],
      });

      await expect(
        service.markStepComplete('plan-1', { stepNumber: 99, completedBy: 'loader-A' })
      ).rejects.toThrow(StepNotFoundError);
    });

    it('throws LoadingProgressNotFoundError for non-existent plan', async () => {
      await expect(
        service.markStepComplete('missing', { stepNumber: 1, completedBy: 'loader-A' })
      ).rejects.toThrow(LoadingProgressNotFoundError);
    });

    it('allows completing all steps in sequence', async () => {
      await service.getOrInitLoadingProgress({
        planId: 'plan-1',
        steps: [
          { stepNumber: 1, description: 'Step 1' },
          { stepNumber: 2, description: 'Step 2' },
          { stepNumber: 3, description: 'Step 3' },
        ],
      });

      await service.markStepComplete('plan-1', { stepNumber: 1, completedBy: 'loader-A' });
      await service.markStepComplete('plan-1', { stepNumber: 2, completedBy: 'loader-A' });
      const final = await service.markStepComplete('plan-1', { stepNumber: 3, completedBy: 'loader-B' });

      expect(final.completedSteps).toBe(3);
      expect(final.totalSteps).toBe(3);
      expect(final.steps!.every((s) => s.completed)).toBe(true);
    });
  });

  // ─── Error Classes ──────────────────────────────────────────────────────────

  describe('error classes', () => {
    it('ChecklistNotFoundError has statusCode 404', () => {
      const err = new ChecklistNotFoundError('pv-1');
      expect(err.statusCode).toBe(404);
      expect(err.name).toBe('ChecklistNotFoundError');
      expect(err.message).toContain('pv-1');
    });

    it('ChecklistAlreadyCompletedError has statusCode 409', () => {
      const err = new ChecklistAlreadyCompletedError('pv-1');
      expect(err.statusCode).toBe(409);
      expect(err.name).toBe('ChecklistAlreadyCompletedError');
    });

    it('ChecklistIncompleteError has statusCode 400', () => {
      const err = new ChecklistIncompleteError('pv-1');
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe('ChecklistIncompleteError');
    });

    it('DiscrepancyDescriptionRequiredError has statusCode 400', () => {
      const err = new DiscrepancyDescriptionRequiredError();
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe('DiscrepancyDescriptionRequiredError');
    });

    it('LoadingProgressNotFoundError has statusCode 404', () => {
      const err = new LoadingProgressNotFoundError('plan-1');
      expect(err.statusCode).toBe(404);
      expect(err.name).toBe('LoadingProgressNotFoundError');
    });

    it('StepNotFoundError has statusCode 404', () => {
      const err = new StepNotFoundError('plan-1', 5);
      expect(err.statusCode).toBe(404);
      expect(err.message).toContain('5');
    });

    it('StepOutOfOrderError has statusCode 400', () => {
      const err = new StepOutOfOrderError('plan-1', 3, 2);
      expect(err.statusCode).toBe(400);
      expect(err.message).toContain('3');
      expect(err.message).toContain('2');
    });

    it('StepAlreadyCompletedError has statusCode 409', () => {
      const err = new StepAlreadyCompletedError('plan-1', 1);
      expect(err.statusCode).toBe(409);
      expect(err.message).toContain('1');
    });
  });
});
