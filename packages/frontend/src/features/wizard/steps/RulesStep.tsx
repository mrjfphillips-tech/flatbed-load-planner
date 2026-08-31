// ─── Rules Step (Step 3) ─────────────────────────────────────────────────────
// Presents the rule summary panel and pattern override selection before
// the planner proceeds to generation. Advisory rules must be acknowledged.

import { useEffect } from 'react';
import { useWizardStore } from '../wizard-store';
import { RuleSummaryPanel } from '../RuleSummaryPanel';
import { PatternOverrideSelect } from '../PatternOverrideSelect';
import { getRuleSummary, createRuleSet, defaultRules } from '@ptv-discovery-coach/shared';

export function RulesStep() {
  const activeRules = useWizardStore((s) => s.activeRules);
  const ruleSummary = useWizardStore((s) => s.ruleSummary);
  const setActiveRules = useWizardStore((s) => s.setActiveRules);
  const setRuleSummary = useWizardStore((s) => s.setRuleSummary);

  // Load default rules on mount if none are loaded yet
  useEffect(() => {
    if (activeRules.length === 0) {
      const ruleSet = createRuleSet(defaultRules);
      const allRules = [...ruleSet.defaultRules, ...ruleSet.customRules];
      setActiveRules(allRules);
      setRuleSummary(getRuleSummary(ruleSet));
    }
  }, [activeRules.length, setActiveRules, setRuleSummary]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Rules &amp; Configuration</h2>
        <p className="mt-1 text-sm text-gray-600">
          Review active loading rules and select a pattern override if needed.
          Acknowledge advisory rules before generating the load plan.
        </p>
      </div>

      {/* Rule summary grouped by type */}
      <RuleSummaryPanel />

      {/* Separator */}
      <hr className="border-gray-200" />

      {/* Pattern override selection */}
      <PatternOverrideSelect />

      {/* Readiness indicator */}
      {ruleSummary && (
        <div className="text-sm text-gray-500">
          {useWizardStore.getState().areAdvisoryRulesAcknowledged() ? (
            <span className="text-green-600 font-medium">
              ✓ Ready to proceed to plan generation
            </span>
          ) : (
            <span className="text-amber-600">
              Please acknowledge all advisory rules above to continue
            </span>
          )}
        </div>
      )}
    </div>
  );
}
