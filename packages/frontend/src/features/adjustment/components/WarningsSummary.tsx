// ─── Warnings Summary ────────────────────────────────────────────────────────
// Compact summary of rule evaluation results after adjustments.
// Shows count by severity and an expandable list.

import { useState } from 'react';
import type { RuleResult } from '@ptv-discovery-coach/shared';
import { useAdjustmentStore } from '../adjustment-store';

const SEVERITY_CONFIG = {
  hard_constraint: { label: 'Error', className: 'bg-red-100 text-red-700', icon: '✕' },
  soft_preference: { label: 'Warning', className: 'bg-amber-100 text-amber-700', icon: '⚠' },
  advisory: { label: 'Info', className: 'bg-blue-100 text-blue-700', icon: 'ℹ' },
} as const;

export function WarningsSummary() {
  const { ruleResults, canApprove } = useAdjustmentStore();
  const [expanded, setExpanded] = useState(false);

  if (ruleResults.length === 0) return null;

  const failed = ruleResults.filter((r) => !r.passed);
  const hardCount = failed.filter((r) => r.ruleType === 'hard_constraint').length;
  const softCount = failed.filter((r) => r.ruleType === 'soft_preference').length;
  const advisoryCount = failed.filter((r) => r.ruleType === 'advisory').length;

  return (
    <div
      className="border border-gray-200 rounded-lg overflow-hidden"
      data-testid="warnings-summary"
      role="region"
      aria-label="Rule evaluation warnings"
    >
      {/* Summary bar */}
      <button
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 text-sm"
        onClick={() => setExpanded(!expanded)}
        data-testid="warnings-toggle"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Warnings</span>
          {hardCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700" data-testid="error-count">
              {hardCount} Error{hardCount > 1 ? 's' : ''}
            </span>
          )}
          {softCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700" data-testid="warning-count">
              {softCount} Warning{softCount > 1 ? 's' : ''}
            </span>
          )}
          {advisoryCount > 0 && (
            <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700" data-testid="info-count">
              {advisoryCount} Info
            </span>
          )}
        </div>
        <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded warnings list */}
      {expanded && (
        <ul className="divide-y divide-gray-100 max-h-48 overflow-y-auto" data-testid="warnings-list">
          {failed.map((result) => (
            <WarningItem key={result.ruleId} result={result} />
          ))}
        </ul>
      )}

      {/* Approval status */}
      <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50 text-xs">
        {canApprove ? (
          <span className="text-green-700" data-testid="approval-status">✓ Plan can be approved</span>
        ) : (
          <span className="text-red-700" data-testid="approval-status">✕ Cannot approve — resolve errors first</span>
        )}
      </div>
    </div>
  );
}

function WarningItem({ result }: { result: RuleResult }) {
  const config = SEVERITY_CONFIG[result.ruleType];

  return (
    <li
      className="px-3 py-2 text-sm"
      data-testid={`warning-item-${result.ruleId}`}
    >
      <div className="flex items-start gap-2">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${config.className}`}>
          {config.icon} {config.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-gray-800">{result.message}</p>
          {result.affectedItems.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              Items: {result.affectedItems.join(', ')}
            </p>
          )}
          {result.suggestedAction && (
            <p className="text-xs text-gray-600 mt-0.5 italic">{result.suggestedAction}</p>
          )}
        </div>
      </div>
    </li>
  );
}
