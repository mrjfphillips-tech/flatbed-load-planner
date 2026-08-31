// ─── Rules Review Step (Step 3) ──────────────────────────────────────────────
// Presents the rule summary panel for review before fleet plan generation.
// Reuses the existing RuleSummaryPanel from the wizard feature.
// Loads default rules on mount and syncs them to the fleet store.
//
// Requirements: 4.1, 6.1

import { useEffect } from 'react';
import { useWizardStore } from '../../wizard/wizard-store';
import { useFleetStore } from '../fleet-store';
import { RuleSummaryPanel } from '../../wizard/RuleSummaryPanel';
import { getRuleSummary, createRuleSet, defaultRules } from '@ptv-discovery-coach/shared';

export function RulesReviewStep() {
  // Wizard store — rules state (RuleSummaryPanel reads from this)
  const activeRules = useWizardStore((s) => s.activeRules);
  const setActiveRules = useWizardStore((s) => s.setActiveRules);
  const setRuleSummary = useWizardStore((s) => s.setRuleSummary);
  const areAdvisoryRulesAcknowledged = useWizardStore((s) => s.areAdvisoryRulesAcknowledged);

  // Fleet store — sync active rules for fleet planner consumption
  const setFleetActiveRules = useFleetStore((s) => s.setActiveRules);

  // Load default rules on mount if none are loaded
  useEffect(() => {
    if (activeRules.length === 0) {
      const ruleSet = createRuleSet(defaultRules);
      const allRules = [...ruleSet.defaultRules, ...ruleSet.customRules];
      setActiveRules(allRules);
      setRuleSummary(getRuleSummary(ruleSet));
    }
  }, [activeRules.length, setActiveRules, setRuleSummary]);

  // Sync wizard store rules to fleet store whenever they change
  useEffect(() => {
    if (activeRules.length > 0) {
      setFleetActiveRules(activeRules);
    }
  }, [activeRules, setFleetActiveRules]);

  const allAcknowledged = areAdvisoryRulesAcknowledged();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Review Rules</h2>
        <p className="mt-1 text-sm text-gray-600">
          Review the stacking and placement rules that will be applied to each
          vehicle's load plan. Acknowledge advisory rules before proceeding.
        </p>
      </div>

      {/* Rule summary panel (reads from wizard store) */}
      <RuleSummaryPanel />

      {/* Readiness indicator */}
      <div className="text-sm">
        {allAcknowledged ? (
          <span className="text-green-600 font-medium">
            ✓ Rules reviewed — ready to generate fleet plans
          </span>
        ) : (
          <span className="text-amber-600">
            Please acknowledge all advisory rules above to continue
          </span>
        )}
      </div>
    </div>
  );
}
