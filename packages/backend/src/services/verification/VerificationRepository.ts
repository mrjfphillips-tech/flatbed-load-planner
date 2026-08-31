/**
 * Verification Repository — Data access interface for Verification Service.
 *
 * Abstracts database operations to enable testing with in-memory implementations.
 */

// ─── Checklist Record ─────────────────────────────────────────────────────────

export interface ChecklistItemCheck {
  itemId: string;
  verified: boolean;
  notes?: string;
}

export interface SecurementCheck {
  securementId: string;
  verified: boolean;
  notes?: string;
}

export interface ChecklistRecord {
  id: string;
  planVersionId: string;
  driverId: string | null;
  itemPresenceChecks: ChecklistItemCheck[] | null;
  securementChecks: SecurementCheck[] | null;
  weightCheckVerified: boolean;
  weightCheckNotes: string | null;
  damageCheckVerified: boolean;
  damageCheckNotes: string | null;
  allVerified: boolean;
  verifiedAt: Date | null;
  nonConformanceDescription: string | null;
  supervisorNotified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Loading Progress Record ──────────────────────────────────────────────────

export interface LoadingStep {
  stepNumber: number;
  description: string;
  completed: boolean;
  completedBy?: string;
  completedAt?: string;
}

export interface LoadingProgressRecord {
  id: string;
  planId: string;
  totalSteps: number;
  completedSteps: number;
  steps: LoadingStep[] | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Repository Interface ─────────────────────────────────────────────────────

export interface IVerificationRepository {
  // Checklist operations
  getChecklistByPlanVersionId(planVersionId: string): Promise<ChecklistRecord | null>;
  insertChecklist(data: Omit<ChecklistRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ChecklistRecord>;
  updateChecklist(id: string, data: Partial<ChecklistRecord>): Promise<ChecklistRecord | null>;

  // Loading progress operations
  getLoadingProgressByPlanId(planId: string): Promise<LoadingProgressRecord | null>;
  insertLoadingProgress(data: Omit<LoadingProgressRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<LoadingProgressRecord>;
  updateLoadingProgress(id: string, data: Partial<LoadingProgressRecord>): Promise<LoadingProgressRecord | null>;
}
