/**
 * Plan Repository — Data access interface for Plan Service.
 *
 * Abstracts database operations to enable testing with in-memory implementations.
 */

export interface PlanRecord {
  id: string;
  createdBy: string;
  trailerId: string;
  tractorId: string;
  currentVersion: number;
  status: string;
  pattern: string | null;
  freightManifest: Record<string, unknown>[] | null;
  multiLoadSetId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VersionRecord {
  id: string;
  planId: string;
  versionNumber: number;
  status: string;
  placedFreight: Record<string, unknown>[] | null;
  weightMetrics: Record<string, unknown> | null;
  securementPlan: Record<string, unknown> | null;
  loadingSequence: Record<string, unknown>[] | null;
  warnings: Record<string, unknown>[] | null;
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
}

export interface IPlanRepository {
  insertPlan(data: Omit<PlanRecord, 'id' | 'createdAt' | 'updatedAt' | 'multiLoadSetId'>): Promise<PlanRecord>;
  insertVersion(data: Omit<VersionRecord, 'id' | 'createdAt'>): Promise<VersionRecord>;
  getPlanById(planId: string): Promise<PlanRecord | null>;
  getVersionByPlanAndNumber(planId: string, versionNumber: number): Promise<VersionRecord | null>;
  getVersionsByPlanId(planId: string): Promise<VersionRecord[]>;
  listPlans(options: { userId?: string; status?: string; limit: number; offset: number }): Promise<PlanRecord[]>;
  updatePlan(planId: string, data: Partial<PlanRecord>): Promise<PlanRecord | null>;
  updateVersion(planId: string, versionNumber: number, data: Partial<VersionRecord>): Promise<VersionRecord | null>;
}
