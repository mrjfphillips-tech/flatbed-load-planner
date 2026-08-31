// ─── Supervisor Override Dialog ──────────────────────────────────────────────
// Modal dialog displayed when a manual adjustment causes a Hard_Constraint
// violation. The planner is warned but may keep the position by getting
// Supervisor acknowledgment.

import { useState } from 'react';
import type { RuleResult } from '@ptv-discovery-coach/shared';
import { useAdjustmentStore } from '../adjustment-store';

interface SupervisorOverrideDialogProps {
  /** The hard constraint violations that triggered this dialog */
  violations: RuleResult[];
  /** Called when dialog is dismissed (override acknowledged or cancelled) */
  onClose: () => void;
}

export function SupervisorOverrideDialog({ violations, onClose }: SupervisorOverrideDialogProps) {
  const { addOverride } = useAdjustmentStore();
  const [supervisorName, setSupervisorName] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleOverride = () => {
    if (!supervisorName.trim()) {
      setError('Supervisor name is required');
      return;
    }
    if (!reason.trim()) {
      setError('A reason for the override is required');
      return;
    }

    // Record an override for each violation
    violations.forEach((v) => {
      addOverride({
        ruleId: v.ruleId,
        acknowledgedBy: supervisorName.trim(),
        acknowledgedAt: new Date(),
        reason: reason.trim(),
      });
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-title"
      data-testid="supervisor-override-dialog"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-red-600 text-xl" aria-hidden="true">⚠</span>
          <h2 id="override-title" className="text-lg font-semibold text-gray-900">
            Hard Constraint Violation
          </h2>
        </div>

        {/* Violations list */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            The following hard constraint(s) are violated by this adjustment:
          </p>
          <ul className="space-y-2" data-testid="violation-list">
            {violations.map((v) => (
              <li
                key={v.ruleId}
                className="text-sm bg-red-50 border border-red-200 rounded p-2"
                data-testid={`violation-${v.ruleId}`}
              >
                <span className="font-medium text-red-800">{v.message}</span>
                {v.suggestedAction && (
                  <p className="text-xs text-red-600 mt-1">
                    Suggested: {v.suggestedAction}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Override form */}
        <div className="space-y-3 border-t border-gray-200 pt-4">
          <p className="text-sm text-gray-700 font-medium">
            To keep this position, Supervisor acknowledgment is required:
          </p>

          <div>
            <label htmlFor="supervisor-name" className="block text-xs text-gray-600 mb-1">
              Supervisor Name
            </label>
            <input
              id="supervisor-name"
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              value={supervisorName}
              onChange={(e) => { setSupervisorName(e.target.value); setError(''); }}
              placeholder="Enter supervisor name"
              data-testid="supervisor-name-input"
            />
          </div>

          <div>
            <label htmlFor="override-reason" className="block text-xs text-gray-600 mb-1">
              Reason for Override
            </label>
            <textarea
              id="override-reason"
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
              rows={2}
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(''); }}
              placeholder="Explain why this override is acceptable"
              data-testid="override-reason-input"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600" data-testid="override-error">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-5">
          <button
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            onClick={onClose}
            data-testid="cancel-override-btn"
          >
            Cancel (Revert Change)
          </button>
          <button
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            onClick={handleOverride}
            data-testid="confirm-override-btn"
          >
            Override with Supervisor Acknowledgment
          </button>
        </div>
      </div>
    </div>
  );
}
