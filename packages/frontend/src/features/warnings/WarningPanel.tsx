// ─── Warning Display Panel Component ─────────────────────────────────────────
// Displays rule evaluation warnings with severity counts, scrollable list,
// and plan approval control. All text is plain language without formulas.
//
// Requirements: 12.1, 12.2, 12.3, 12.4, 12.5

import React from 'react';
import type { RuleResult } from '@ptv-discovery-coach/shared';
import type { WarningPanelProps, SeverityCounts } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeSeverityCounts(warnings: RuleResult[]): SeverityCounts {
  const failed = warnings.filter((w) => !w.passed);
  return {
    error: failed.filter((w) => w.severity === 'error').length,
    warning: failed.filter((w) => w.severity === 'warning').length,
    info: failed.filter((w) => w.severity === 'info').length,
  };
}

/** Map severity to visual styling */
function severityStyles(severity: 'error' | 'warning' | 'info') {
  switch (severity) {
    case 'error':
      return {
        border: 'border-red-300',
        bg: 'bg-red-50',
        text: 'text-red-800',
        badge: 'bg-red-100 text-red-700',
        icon: '⛔',
        label: 'Error',
      };
    case 'warning':
      return {
        border: 'border-amber-300',
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        badge: 'bg-amber-100 text-amber-700',
        icon: '⚠️',
        label: 'Warning',
      };
    case 'info':
      return {
        border: 'border-blue-300',
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        badge: 'bg-blue-100 text-blue-700',
        icon: 'ℹ️',
        label: 'Info',
      };
  }
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

interface SeveritySummaryProps {
  counts: SeverityCounts;
}

function SeveritySummary({ counts }: SeveritySummaryProps): React.ReactElement {
  return (
    <div
      className="flex items-center gap-3"
      data-testid="severity-summary"
      role="status"
      aria-label={`${counts.error} errors, ${counts.warning} warnings, ${counts.info} info`}
    >
      <span
        className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
        data-testid="error-count"
      >
        ⛔ {counts.error} Error{counts.error !== 1 ? 's' : ''}
      </span>
      <span
        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700"
        data-testid="warning-count"
      >
        ⚠️ {counts.warning} Warning{counts.warning !== 1 ? 's' : ''}
      </span>
      <span
        className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"
        data-testid="info-count"
      >
        ℹ️ {counts.info} Info
      </span>
    </div>
  );
}

interface WarningItemProps {
  warning: RuleResult;
}

function WarningItem({ warning }: WarningItemProps): React.ReactElement {
  const styles = severityStyles(warning.severity);

  return (
    <li
      className={`rounded-lg border ${styles.border} ${styles.bg} p-3 space-y-1.5`}
      data-testid={`warning-item-${warning.ruleId}`}
      role="listitem"
    >
      {/* Header with severity badge and message */}
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 text-sm" aria-hidden="true">
          {styles.icon}
        </span>
        <div className="flex-1 min-w-0">
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles.badge} mb-1`}
          >
            {styles.label}
          </span>
          <p className={`text-sm font-medium ${styles.text}`} data-testid="warning-message">
            {warning.message}
          </p>
        </div>
      </div>

      {/* Affected items */}
      {warning.affectedItems.length > 0 && (
        <div className="ml-6">
          <p className="text-xs text-gray-600">
            <span className="font-medium">Affected items:</span>{' '}
            {warning.affectedItems.join(', ')}
          </p>
        </div>
      )}

      {/* Threshold/actual values */}
      {warning.threshold != null && warning.actual != null && (
        <div className="ml-6">
          <p className="text-xs text-gray-600">
            <span className="font-medium">Limit:</span> {Math.round(warning.threshold).toLocaleString()}
            {' · '}
            <span className="font-medium">Actual:</span> {Math.round(warning.actual).toLocaleString()}
          </p>
        </div>
      )}

      {/* Corrective action */}
      {warning.suggestedAction && (
        <div className="ml-6">
          <p className="text-xs text-gray-700">
            <span className="font-medium">Suggested action:</span> {warning.suggestedAction}
          </p>
        </div>
      )}
    </li>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WarningPanel({
  warnings,
  canApprove,
  onApprove,
  className = '',
}: WarningPanelProps): React.ReactElement {
  const counts = computeSeverityCounts(warnings);
  const failedWarnings = warnings.filter((w) => !w.passed);
  const hasWarnings = failedWarnings.length > 0;

  return (
    <div
      className={`flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}
      data-testid="warning-panel"
      aria-label="Load Plan Warnings"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-800">Warnings & Notifications</h2>
        <SeveritySummary counts={counts} />
      </div>

      {/* Warning List — scrollable */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ maxHeight: '360px' }}
        data-testid="warning-list"
        role="list"
        aria-label="Active warnings"
      >
        {hasWarnings ? (
          <ul className="space-y-2">
            {/* Sort: errors first, then warnings, then info */}
            {failedWarnings
              .sort((a, b) => {
                const order = { error: 0, warning: 1, info: 2 };
                return order[a.severity] - order[b.severity];
              })
              .map((warning) => (
                <WarningItem key={warning.ruleId} warning={warning} />
              ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="text-2xl mb-2" aria-hidden="true">
              ✅
            </span>
            <p className="text-sm text-gray-600">No active warnings. The load plan is clear.</p>
          </div>
        )}
      </div>

      {/* Footer with Approve Plan button */}
      <div className="border-t border-gray-100 px-4 py-3">
        <button
          onClick={onApprove}
          disabled={!canApprove}
          className={`w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            canApprove
              ? 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
          data-testid="approve-plan-button"
          aria-disabled={!canApprove}
          title={
            canApprove
              ? 'Approve the load plan'
              : 'Cannot approve: resolve all errors first'
          }
        >
          {canApprove ? 'Approve Plan' : 'Resolve Errors to Approve'}
        </button>
        {!canApprove && (
          <p className="mt-1.5 text-center text-xs text-red-600" data-testid="approval-blocked-message">
            {counts.error} error{counts.error !== 1 ? 's' : ''} must be resolved before the plan can be approved.
          </p>
        )}
      </div>
    </div>
  );
}
