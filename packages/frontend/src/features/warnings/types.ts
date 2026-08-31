// ─── Warnings & Notifications — Type Definitions ─────────────────────────────
// Types for the warning display panel and approval flow.

import type { RuleResult } from '@ptv-discovery-coach/shared';

/** Warning severity levels mapped from rule types */
export type WarningSeverity = 'error' | 'warning' | 'info';

/** Counts of warnings grouped by severity */
export interface SeverityCounts {
  error: number;
  warning: number;
  info: number;
}

/** A warning formatted for display in the panel */
export interface DisplayWarning {
  /** Unique identifier (matches ruleId from RuleResult) */
  id: string;
  /** Severity level */
  severity: WarningSeverity;
  /** Plain-language description of what is wrong */
  message: string;
  /** Order numbers and descriptions of affected items */
  affectedItems: string[];
  /** The limit or threshold that was exceeded (if applicable) */
  threshold?: number;
  /** The actual measured value (if applicable) */
  actual?: number;
  /** Recommended corrective action in plain language */
  suggestedAction?: string;
}

/** Props for the WarningPanel component */
export interface WarningPanelProps {
  /** Rule evaluation results from the rules engine */
  warnings: RuleResult[];
  /** Whether the plan can be approved (zero Error-severity warnings) */
  canApprove: boolean;
  /** Callback when the Approve Plan button is clicked */
  onApprove?: () => void;
  /** CSS class for root container */
  className?: string;
}
