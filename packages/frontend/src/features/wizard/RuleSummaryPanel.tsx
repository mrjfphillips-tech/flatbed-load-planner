// ─── Rule Summary Panel ──────────────────────────────────────────────────────
// Presents a summary of active rules grouped by type before plan generation.
// Advisory rules require explicit acknowledgment before the planner can proceed.

import { useWizardStore } from './wizard-store';

export interface RuleSummaryPanelProps {
  /** Optional classname for container */
  className?: string;
}

export function RuleSummaryPanel({ className = '' }: RuleSummaryPanelProps) {
  const ruleSummary = useWizardStore((s) => s.ruleSummary);
  const ruleAcknowledgements = useWizardStore((s) => s.ruleAcknowledgements);
  const acknowledgeAdvisoryRule = useWizardStore((s) => s.acknowledgeAdvisoryRule);
  const acknowledgeAllAdvisoryRules = useWizardStore((s) => s.acknowledgeAllAdvisoryRules);
  const areAdvisoryRulesAcknowledged = useWizardStore((s) => s.areAdvisoryRulesAcknowledged);

  if (!ruleSummary) {
    return (
      <div className={`p-4 text-gray-500 ${className}`}>
        No rules loaded. Configure rules before proceeding.
      </div>
    );
  }

  const allAcknowledged = areAdvisoryRulesAcknowledged();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with total count */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Active Rules ({ruleSummary.totalCount})
        </h3>
        {allAcknowledged && (
          <span className="text-sm text-green-600 font-medium">✓ All rules acknowledged</span>
        )}
      </div>

      {/* Hard Constraints */}
      {ruleSummary.hardConstraints.length > 0 && (
        <RuleGroup
          title="Hard Constraints"
          subtitle="Must never be violated — violations prevent plan approval"
          rules={ruleSummary.hardConstraints}
          badgeColor="bg-red-100 text-red-800"
          iconColor="text-red-600"
        />
      )}

      {/* Soft Preferences */}
      {ruleSummary.softPreferences.length > 0 && (
        <RuleGroup
          title="Soft Preferences"
          subtitle="Should be followed — violations produce warnings but allow approval"
          rules={ruleSummary.softPreferences}
          badgeColor="bg-yellow-100 text-yellow-800"
          iconColor="text-yellow-600"
        />
      )}

      {/* Advisory Rules — require acknowledgment */}
      {ruleSummary.advisoryRules.length > 0 && (
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="font-medium text-blue-900">
                Advisory Rules ({ruleSummary.advisoryRules.length})
              </h4>
              <p className="text-xs text-blue-700">
                Noted for reference — acknowledge before generating plan
              </p>
            </div>
            {!allAcknowledged && (
              <button
                type="button"
                onClick={acknowledgeAllAdvisoryRules}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Acknowledge All
              </button>
            )}
          </div>

          <ul className="space-y-2">
            {ruleSummary.advisoryRules.map((rule) => {
              const isAcknowledged = ruleAcknowledgements.includes(rule.id);
              return (
                <li
                  key={rule.id}
                  className="flex items-start gap-2 text-sm"
                >
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAcknowledged}
                      onChange={() => !isAcknowledged && acknowledgeAdvisoryRule(rule.id)}
                      className="mt-0.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Acknowledge advisory rule: ${rule.name}`}
                    />
                    <div>
                      <span className="font-medium text-blue-900">{rule.name}</span>
                      <p className="text-blue-700 text-xs">{rule.description}</p>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Internal: Rule Group Section ────────────────────────────────────────────

interface RuleGroupProps {
  title: string;
  subtitle: string;
  rules: { id: string; name: string; description: string }[];
  badgeColor: string;
  iconColor: string;
}

function RuleGroup({ title, subtitle, rules, badgeColor, iconColor }: RuleGroupProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="mb-2">
        <h4 className="font-medium text-gray-900">
          {title}{' '}
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
            {rules.length}
          </span>
        </h4>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
      <ul className="space-y-1.5">
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-start gap-2 text-sm">
            <span className={`mt-0.5 ${iconColor}`} aria-hidden="true">•</span>
            <div>
              <span className="font-medium text-gray-800">{rule.name}</span>
              <span className="text-gray-500"> — {rule.description}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
