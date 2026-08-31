// ─── Generate Plan Step (Step 4) ─────────────────────────────────────────────
// The final wizard step that triggers load plan generation via the Web Worker.
// Displays generation progress, results, and warnings.

import { useCallback } from 'react';
import { useWizardStore } from '../wizard-store';
import { usePlannerWorker } from '../../planner';
import type { PlanRequest } from '@ptv-discovery-coach/shared';

export function GeneratePlanStep() {
  const combination = useWizardStore((s) => s.combination);
  const selectedTrailer = useWizardStore((s) => s.selectedTrailer);
  const selectedTractor = useWizardStore((s) => s.selectedTractor);
  const orderItems = useWizardStore((s) => s.orderItems);
  const activeRules = useWizardStore((s) => s.activeRules);
  const patternOverride = useWizardStore((s) => s.patternOverride);
  const currentPlan = useWizardStore((s) => s.currentPlan);
  const setCurrentPlan = useWizardStore((s) => s.setCurrentPlan);
  const setIsGenerating = useWizardStore((s) => s.setIsGenerating);
  const setWarnings = useWizardStore((s) => s.setWarnings);

  const {
    status,
    result,
    error,
    progress,
    progressPercent,
    isGenerating,
    generate,
    cancel,
    reset,
  } = usePlannerWorker();

  const handleGenerate = useCallback(() => {
    if (!combination || !selectedTrailer || !selectedTractor) return;

    const request: PlanRequest = {
      items: orderItems,
      equipment: combination,
      trailer: selectedTrailer,
      tractor: selectedTractor,
      rules: activeRules,
      patternOverride: patternOverride ?? undefined,
    };

    setIsGenerating(true);
    generate(request);
  }, [
    combination,
    selectedTrailer,
    selectedTractor,
    orderItems,
    activeRules,
    patternOverride,
    generate,
    setIsGenerating,
  ]);

  // Sync worker result back to wizard store
  if (result && !currentPlan) {
    setCurrentPlan(result);
    setWarnings(result.ruleResults.filter((r) => !r.passed));
    setIsGenerating(false);
  }

  if ((status === 'error' || status === 'timeout' || status === 'cancelled') && useWizardStore.getState().isGenerating) {
    setIsGenerating(false);
  }

  const canGenerate = !!(combination && selectedTrailer && selectedTractor && orderItems.length > 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Generate Load Plan</h2>
        <p className="mt-1 text-sm text-gray-600">
          Generate an optimized load plan based on your equipment, orders, and rules.
        </p>
      </div>

      {/* Generation summary */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-600">Equipment:</span>
          <span className="font-medium text-gray-900">
            {selectedTractor?.name ?? 'None'} + {selectedTrailer?.name ?? 'None'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Order items:</span>
          <span className="font-medium text-gray-900">{orderItems.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Active rules:</span>
          <span className="font-medium text-gray-900">{activeRules.length}</span>
        </div>
        {patternOverride && (
          <div className="flex justify-between">
            <span className="text-gray-600">Pattern override:</span>
            <span className="font-medium text-amber-700">{patternOverride}</span>
          </div>
        )}
      </div>

      {/* Generate button */}
      {!currentPlan && !isGenerating && (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={`
            px-6 py-3 text-sm font-medium rounded-lg transition-colors
            ${canGenerate
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          Generate Load Plan
        </button>
      )}

      {/* Generating state */}
      {isGenerating && (
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <div className="text-sm text-gray-700">
            {progress ?? 'Generating...'}
            {progressPercent !== null && (
              <span className="ml-2 text-gray-500">({progressPercent}%)</span>
            )}
          </div>
          <button
            type="button"
            onClick={cancel}
            className="ml-auto text-xs text-red-600 hover:text-red-800 underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error state */}
      {(status === 'error' || status === 'timeout') && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          <p className="font-medium">Generation failed</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={reset}
            className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Success state — plan overview */}
      {currentPlan && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            <p className="font-medium">✓ Load plan generated successfully</p>
            <p className="mt-1">
              {currentPlan.placedFreight.length} item{currentPlan.placedFreight.length !== 1 ? 's' : ''} placed
              {currentPlan.unplacedItems?.length > 0 && (
                <span className="text-amber-700">
                  {' '}({currentPlan.unplacedItems.length} items could not be placed)
                </span>
              )}
            </p>
          </div>

          {/* Warnings summary */}
          {currentPlan.ruleResults && currentPlan.ruleResults.filter((r) => !r.passed).length > 0 && (
            <div className="border border-gray-200 rounded-lg p-4 text-sm">
              <h4 className="font-medium text-gray-900 mb-2">
                Warnings ({currentPlan.ruleResults.filter((r) => !r.passed).length})
              </h4>
              <ul className="space-y-1">
                {currentPlan.ruleResults.filter((r) => !r.passed).slice(0, 5).map((w, idx) => (
                  <li key={idx} className="text-gray-700">
                    <span className={`font-medium ${
                      w.ruleType === 'hard_constraint' ? 'text-red-600' :
                      w.ruleType === 'soft_preference' ? 'text-yellow-600' :
                      'text-blue-600'
                    }`}>
                      {w.ruleType === 'hard_constraint' ? '⛔' : w.ruleType === 'soft_preference' ? '⚠️' : 'ℹ️'}
                    </span>{' '}
                    {w.message}
                  </li>
                ))}
                {currentPlan.ruleResults.filter((r) => !r.passed).length > 5 && (
                  <li className="text-gray-500 text-xs">
                    ...and {currentPlan.ruleResults.filter((r) => !r.passed).length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
