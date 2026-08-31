/**
 * Unit Tests for PlanService - CRUD, versioning, approval workflow, comparison.
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 14.6
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../db/index.js', () => ({
  db: {},
  schema: { loadPlans: {}, planVersions: {} },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

import {
  PlanService,
  PlanNotFoundError,
  VersionNotFoundError,
  InvalidStatusTransitionError,
} from './PlanService.js';
import type { IPlanRepository, PlanRecord, VersionRecord } from './PlanRepository.js';

class InMemoryPlanRepository implements IPlanRepository {
  plans: PlanRecord[] = [];
  versions: VersionRecord[] = [];
  private idSeq = 0;
  private nextId() { return `id-${++this.idSeq}`; }

  async insertPlan(data: Omit<PlanRecord, 'id' | 'createdAt' | 'updatedAt' | 'multiLoadSetId'>): Promise<PlanRecord> {
    const plan: PlanRecord = { ...data, id: this.nextId(), multiLoadSetId: null, createdAt: new Date(), updatedAt: new Date() };
    this.plans.push(plan);
    return plan;
  }

  async insertVersion(data: Omit<VersionRecord, 'id' | 'createdAt'>): Promise<VersionRecord> {
    const v: VersionRecord = { ...data, id: this.nextId(), createdAt: new Date() };
    this.versions.push(v);
    return v;
  }

  async getPlanById(planId: string) {
    return this.plans.find(p => p.id === planId) ?? null;
  }

  async getVersionByPlanAndNumber(planId: string, vn: number) {
    return this.versions.find(v => v.planId === planId && v.versionNumber === vn) ?? null;
  }

  async getVersionsByPlanId(planId: string) {
    return this.versions.filter(v => v.planId === planId).sort((a, b) => b.versionNumber - a.versionNumber);
  }

  async listPlans(opts: { userId?: string; status?: string; limit: number; offset: number }) {
    let result = [...this.plans];
    if (opts.userId) result = result.filter(p => p.createdBy === opts.userId);
    if (opts.status) result = result.filter(p => p.status === opts.status);
    return result.slice(opts.offset, opts.offset + opts.limit);
  }

  async updatePlan(planId: string, data: Partial<PlanRecord>) {
    const idx = this.plans.findIndex(p => p.id === planId);
    if (idx === -1) return null;
    this.plans[idx] = { ...this.plans[idx], ...data };
    return this.plans[idx];
  }

  async updateVersion(planId: string, vn: number, data: Partial<VersionRecord>) {
    const idx = this.versions.findIndex(v => v.planId === planId && v.versionNumber === vn);
    if (idx === -1) return null;
    this.versions[idx] = { ...this.versions[idx], ...data };
    return this.versions[idx];
  }
}

describe('PlanService', () => {
  let repo: InMemoryPlanRepository;
  let service: PlanService;

  beforeEach(() => {
    repo = new InMemoryPlanRepository();
    service = new PlanService(repo);
  });

  describe('createPlan', () => {
    it('creates a plan with initial version 1 in draft status', async () => {
      const result = await service.createPlan({ createdBy: 'user-1', trailerId: 'trailer-1', tractorId: 'tractor-1' });
      expect(result.plan.currentVersion).toBe(1);
      expect(result.plan.status).toBe('draft');
      expect(result.plan.createdBy).toBe('user-1');
      expect(result.version.versionNumber).toBe(1);
      expect(result.version.status).toBe('draft');
    });

    it('stores plan and version in the repository', async () => {
      await service.createPlan({ createdBy: 'user-1', trailerId: 'trailer-1', tractorId: 'tractor-1' });
      expect(repo.plans).toHaveLength(1);
      expect(repo.versions).toHaveLength(1);
    });

    it('stores optional pattern and freight manifest', async () => {
      const manifest = [{ orderNumber: 'ORD-001', weight: 5000 }];
      const result = await service.createPlan({ createdBy: 'user-1', trailerId: 'trailer-1', tractorId: 'tractor-1', pattern: 'layered', freightManifest: manifest });
      expect(result.plan.pattern).toBe('layered');
      expect(result.plan.freightManifest).toEqual(manifest);
    });
  });

  describe('savePlan', () => {
    it('increments version on every save (Req 14.1)', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      const save1 = await service.savePlan(plan.id, 'user-1', { placedFreight: [{ item: 'coil-1', x: 0 }] });
      expect(save1.version.versionNumber).toBe(2);
      const save2 = await service.savePlan(plan.id, 'user-1', { placedFreight: [{ item: 'coil-1', x: 10 }] });
      expect(save2.version.versionNumber).toBe(3);
    });

    it('throws PlanNotFoundError for unknown plan ID', async () => {
      await expect(service.savePlan('nonexistent', 'user-1', {})).rejects.toThrow(PlanNotFoundError);
    });

    it('stores placed freight data in the new version', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      const freight = [{ item: 'beam-1', x: 24, y: 0, z: 0 }];
      const result = await service.savePlan(plan.id, 'user-1', { placedFreight: freight, weightMetrics: { totalGross: 45000 } });
      expect(result.version.placedFreight).toEqual(freight);
      expect(result.version.weightMetrics).toEqual({ totalGross: 45000 });
    });
  });
  describe('getPlan', () => {
    it('returns the plan with its current version', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      const result = await service.getPlan(plan.id);
      expect(result.plan.id).toBe(plan.id);
      expect(result.currentVersion).not.toBeNull();
      expect(result.currentVersion!.versionNumber).toBe(1);
    });

    it('throws PlanNotFoundError for unknown plan', async () => {
      await expect(service.getPlan('nonexistent')).rejects.toThrow(PlanNotFoundError);
    });
  });

  describe('listPlans', () => {
    it('returns all plans when no filters applied', async () => {
      await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.createPlan({ createdBy: 'user-2', trailerId: 't2', tractorId: 'tr2' });
      const result = await service.listPlans();
      expect(result.plans).toHaveLength(2);
    });

    it('filters by userId', async () => {
      await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.createPlan({ createdBy: 'user-2', trailerId: 't2', tractorId: 'tr2' });
      const result = await service.listPlans({ userId: 'user-1' });
      expect(result.plans).toHaveLength(1);
      expect(result.plans[0].createdBy).toBe('user-1');
    });

    it('filters by status', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.createPlan({ createdBy: 'user-2', trailerId: 't2', tractorId: 'tr2' });
      await service.submitForApproval(plan.id, 'user-1');
      const result = await service.listPlans({ status: 'pending_approval' });
      expect(result.plans).toHaveLength(1);
    });
  });

  describe('submitForApproval (Req 14.2)', () => {
    it('transitions draft to pending_approval', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      const result = await service.submitForApproval(plan.id, 'user-1');
      expect(result!.status).toBe('pending_approval');
    });

    it('updates the version status', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.submitForApproval(plan.id, 'user-1');
      const version = await service.getVersion(plan.id, 1);
      expect(version.status).toBe('pending_approval');
    });

    it('throws InvalidStatusTransitionError if plan is not draft', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.submitForApproval(plan.id, 'user-1');
      await expect(service.submitForApproval(plan.id, 'user-1')).rejects.toThrow(InvalidStatusTransitionError);
    });

    it('throws PlanNotFoundError for unknown plan', async () => {
      await expect(service.submitForApproval('nonexistent', 'user-1')).rejects.toThrow(PlanNotFoundError);
    });
  });

  describe('approvePlan (Req 14.3, 14.4)', () => {
    it('transitions pending_approval to approved', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.submitForApproval(plan.id, 'user-1');
      const result = await service.approvePlan(plan.id, 'supervisor-1');
      expect(result!.status).toBe('approved');
    });

    it('records approvedBy and approvedAt on the version', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.submitForApproval(plan.id, 'user-1');
      await service.approvePlan(plan.id, 'supervisor-1');
      const version = await service.getVersion(plan.id, 1);
      expect(version.approvedBy).toBe('supervisor-1');
      expect(version.approvedAt).toBeInstanceOf(Date);
    });

    it('throws InvalidStatusTransitionError if not pending_approval', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await expect(service.approvePlan(plan.id, 'supervisor-1')).rejects.toThrow(InvalidStatusTransitionError);
    });
  });

  describe('rejectPlan (Req 14.3)', () => {
    it('transitions pending_approval to rejected with reason', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.submitForApproval(plan.id, 'user-1');
      const result = await service.rejectPlan(plan.id, 'supervisor-1', 'Weight issue');
      expect(result!.status).toBe('rejected');
    });

    it('records rejection reason on the version', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.submitForApproval(plan.id, 'user-1');
      await service.rejectPlan(plan.id, 'supervisor-1', 'CG too far forward');
      const version = await service.getVersion(plan.id, 1);
      expect(version.rejectionReason).toBe('CG too far forward');
    });

    it('throws InvalidStatusTransitionError if not pending_approval', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await expect(service.rejectPlan(plan.id, 'sup-1', 'Reason')).rejects.toThrow(InvalidStatusTransitionError);
    });
  });
  describe('approved plan locking (Req 14.4, 14.6)', () => {
    it('saving approved plan supersedes the approved version', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.submitForApproval(plan.id, 'user-1');
      await service.approvePlan(plan.id, 'supervisor-1');
      await service.savePlan(plan.id, 'user-1', { placedFreight: [{ item: 'modified' }] });
      const v1 = await service.getVersion(plan.id, 1);
      expect(v1.status).toBe('superseded');
    });

    it('saving approved plan creates new draft version requiring re-approval', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.submitForApproval(plan.id, 'user-1');
      await service.approvePlan(plan.id, 'supervisor-1');
      const result = await service.savePlan(plan.id, 'user-1', { placedFreight: [{ item: 'v2' }] });
      expect(result.version.versionNumber).toBe(2);
      expect(result.version.status).toBe('draft');
      expect(result.plan!.status).toBe('draft');
    });

    it('new version after approval can go through full approval cycle', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.submitForApproval(plan.id, 'user-1');
      await service.approvePlan(plan.id, 'supervisor-1');
      await service.savePlan(plan.id, 'user-1', { placedFreight: [{ v: 2 }] });
      await service.submitForApproval(plan.id, 'user-1');
      const approved = await service.approvePlan(plan.id, 'supervisor-1');
      expect(approved!.status).toBe('approved');
    });
  });

  describe('getVersionHistory (Req 14.5)', () => {
    it('returns all versions ordered by version number desc', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.savePlan(plan.id, 'user-1', { placedFreight: [{ v: 2 }] });
      await service.savePlan(plan.id, 'user-1', { placedFreight: [{ v: 3 }] });
      const history = await service.getVersionHistory(plan.id);
      expect(history).toHaveLength(3);
      expect(history[0].versionNumber).toBe(3);
      expect(history[1].versionNumber).toBe(2);
      expect(history[2].versionNumber).toBe(1);
    });

    it('preserves superseded versions', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.submitForApproval(plan.id, 'user-1');
      await service.approvePlan(plan.id, 'supervisor-1');
      await service.savePlan(plan.id, 'user-1', { placedFreight: [{ v: 2 }] });
      const history = await service.getVersionHistory(plan.id);
      expect(history).toHaveLength(2);
      const v1 = history.find((v: any) => v.versionNumber === 1);
      expect(v1!.status).toBe('superseded');
    });
  });

  describe('getVersion', () => {
    it('returns a specific version by number', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.savePlan(plan.id, 'user-1', { placedFreight: [{ item: 'coil-A' }] });
      const v2 = await service.getVersion(plan.id, 2);
      expect(v2.placedFreight).toEqual([{ item: 'coil-A' }]);
    });

    it('throws VersionNotFoundError for nonexistent version', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await expect(service.getVersion(plan.id, 99)).rejects.toThrow(VersionNotFoundError);
    });
  });

  describe('compareVersions (Req 14.5)', () => {
    it('detects differences in placedFreight', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.savePlan(plan.id, 'user-1', { placedFreight: [{ item: 'coil-1', x: 0 }] });
      await service.savePlan(plan.id, 'user-1', { placedFreight: [{ item: 'coil-1', x: 50 }] });
      const comparison = await service.compareVersions(plan.id, 2, 3);
      const freightDiff = comparison.differences.find((d: any) => d.field === 'placedFreight');
      expect(freightDiff).toBeDefined();
      expect(freightDiff!.versionA).toEqual([{ item: 'coil-1', x: 0 }]);
      expect(freightDiff!.versionB).toEqual([{ item: 'coil-1', x: 50 }]);
    });

    it('detects differences in weightMetrics', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.savePlan(plan.id, 'user-1', { weightMetrics: { steerAxle: 12000 } });
      await service.savePlan(plan.id, 'user-1', { weightMetrics: { steerAxle: 11500 } });
      const comparison = await service.compareVersions(plan.id, 2, 3);
      const metricsDiff = comparison.differences.find((d: any) => d.field === 'weightMetrics');
      expect(metricsDiff).toBeDefined();
    });

    it('throws VersionNotFoundError for invalid version numbers', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await expect(service.compareVersions(plan.id, 1, 99)).rejects.toThrow(VersionNotFoundError);
      await expect(service.compareVersions(plan.id, 99, 1)).rejects.toThrow(VersionNotFoundError);
    });

    it('returns correct planId and version numbers', async () => {
      const { plan } = await service.createPlan({ createdBy: 'user-1', trailerId: 't1', tractorId: 'tr1' });
      await service.savePlan(plan.id, 'user-1', {});
      const comparison = await service.compareVersions(plan.id, 1, 2);
      expect(comparison.planId).toBe(plan.id);
      expect(comparison.versionA).toBe(1);
      expect(comparison.versionB).toBe(2);
    });
  });

  describe('full workflow lifecycle', () => {
    it('draft -> save -> submit -> approve -> modify -> re-approve', async () => {
      const { plan } = await service.createPlan({ createdBy: 'planner-1', trailerId: 't1', tractorId: 'tr1' });
      expect(plan.status).toBe('draft');
      await service.savePlan(plan.id, 'planner-1', { placedFreight: [{ item: 'coil-1' }] });
      await service.submitForApproval(plan.id, 'planner-1');
      const afterSubmit = await service.getPlan(plan.id);
      expect(afterSubmit.plan.status).toBe('pending_approval');
      await service.approvePlan(plan.id, 'supervisor-1');
      const afterApprove = await service.getPlan(plan.id);
      expect(afterApprove.plan.status).toBe('approved');
      await service.savePlan(plan.id, 'planner-1', { placedFreight: [{ item: 'coil-1', x: 36 }] });
      const afterModify = await service.getPlan(plan.id);
      expect(afterModify.plan.status).toBe('draft');
      expect(afterModify.plan.currentVersion).toBe(3);
      const history = await service.getVersionHistory(plan.id);
      expect(history).toHaveLength(3);
    });
  });

  describe('Error classes', () => {
    it('PlanNotFoundError has statusCode 404', () => {
      const err = new PlanNotFoundError('test-id');
      expect(err.statusCode).toBe(404);
      expect(err.message).toContain('test-id');
      expect(err.name).toBe('PlanNotFoundError');
    });

    it('VersionNotFoundError has statusCode 404', () => {
      const err = new VersionNotFoundError('plan-1', 5);
      expect(err.statusCode).toBe(404);
      expect(err.message).toContain('5');
      expect(err.message).toContain('plan-1');
    });

    it('InvalidStatusTransitionError has statusCode 409', () => {
      const err = new InvalidStatusTransitionError('draft', 'approved');
      expect(err.statusCode).toBe(409);
      expect(err.message).toContain('draft');
      expect(err.message).toContain('approved');
    });
  });
});