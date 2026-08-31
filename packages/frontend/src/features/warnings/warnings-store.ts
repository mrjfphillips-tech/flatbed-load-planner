// ─── Warnings & Notifications Zustand Store ──────────────────────────────────
// Manages warning state derived from rule evaluation results.

import { create } from 'zustand';
import type { RuleResult } from '@ptv-discovery-coach/shared';
import type { SeverityCounts } from './types';

// ─── State Interface ─────────────────────────────────────────────────────────

export interface WarningsState {
  /** All active rule evaluation results (includes passed and failed) */
  warnings: RuleResult[];
  /** Whether the plan can be approved (no Error-severity failures) */
  canApprove: boolean;
  /** Count of warnings by severity */
  severityCounts: SeverityCounts;

  // Actions
  /** Update warnings from a new rule evaluation */
  setWarnings: (warnings: RuleResult[], canApprove: boolean) => void;
  /** Clear all warnings */
  clearWarnings: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeSeverityCounts(warnings: RuleResult[]): SeverityCounts {
  const failed = warnings.filter((w) => !w.passed);
  return {
    error: failed.filter((w) => w.severity === 'error').length,
    warning: failed.filter((w) => w.severity === 'warning').length,
    info: failed.filter((w) => w.severity === 'info').length,
  };
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useWarningsStore = create<WarningsState>()((set) => ({
  warnings: [],
  canApprove: true,
  severityCounts: { error: 0, warning: 0, info: 0 },

  setWarnings: (warnings, canApprove) => {
    set({
      warnings,
      canApprove,
      severityCounts: computeSeverityCounts(warnings),
    });
  },

  clearWarnings: () => {
    set({
      warnings: [],
      canApprove: true,
      severityCounts: { error: 0, warning: 0, info: 0 },
    });
  },
}));
