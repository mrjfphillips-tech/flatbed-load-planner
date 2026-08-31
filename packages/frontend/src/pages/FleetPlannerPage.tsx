/**
 * Fleet Load Planner Page
 *
 * Entry point for the fleet planning feature. Shows a mode selector that lets
 * the user choose between "Single Truck" (redirects to /flatbed) and
 * "Fleet Planning" (renders the fleet wizard shell with actual step components).
 *
 * Handles fleet store initialization and cleanup on mode transitions.
 *
 * Requirements: 6.3, 6.4
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFleetStore } from '../features/fleet/fleet-store';
import { ModeSelector } from '../features/fleet/ModeSelector';
import { FleetWizardShell } from '../features/fleet/FleetWizardShell';
import { FleetFileUploadStep } from '../features/fleet/steps/FleetFileUploadStep';
import { OrdersFileUploadStep } from '../features/fleet/steps/OrdersFileUploadStep';
import { RulesReviewStep } from '../features/fleet/steps/RulesReviewStep';
import { FleetGenerateStep } from '../features/fleet/steps/FleetGenerateStep';
import { FleetSummaryDashboard } from '../features/fleet/FleetSummaryDashboard';
import type { FleetWizardStep } from '../features/fleet/types';

/** Step content map wiring actual step components into the wizard shell */
const FLEET_STEP_CONTENT: Partial<Record<FleetWizardStep, React.ReactNode>> = {
  1: <FleetFileUploadStep />,
  2: <OrdersFileUploadStep />,
  3: <RulesReviewStep />,
  4: <FleetGenerateStep />,
};

export function FleetPlannerPage() {
  const navigate = useNavigate();
  const mode = useFleetStore((s) => s.mode);
  const resetFleetWizard = useFleetStore((s) => s.resetFleetWizard);
  const fleetPlanResult = useFleetStore((s) => s.fleetPlanResult);

  /** Handle mode selection from the ModeSelector */
  const handleModeSelect = useCallback(
    (selectedMode: 'single' | 'fleet') => {
      if (selectedMode === 'single') {
        // Clean up fleet state and redirect to the single-truck wizard
        resetFleetWizard();
        navigate('/flatbed');
      }
      // If 'fleet' is selected, the mode is already set in the store
      // by the ModeSelector, and this component will re-render showing
      // the fleet wizard shell.
    },
    [navigate, resetFleetWizard]
  );

  /** Handle back to mode selector (reset fleet wizard state) */
  const handleBackToModeSelect = useCallback(() => {
    resetFleetWizard();
    useFleetStore.getState().setMode('single');
  }, [resetFleetWizard]);

  // ─── Mode Selector View (default state) ─────────────────────────────────

  if (mode === 'single') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              OptiFlow Flatbed Load Optimizer
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Choose a planning mode to get started
            </p>
          </div>
          <ModeSelector onSelect={handleModeSelect} className="mt-12" />
        </div>
      </div>
    );
  }

  // ─── Fleet Wizard View ───────────────────────────────────────────────────

  // Show fleet summary dashboard after plan generation completes
  const showSummaryDashboard = fleetPlanResult !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              OptiFlow Fleet Load Optimizer
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Generate load plans for multiple vehicles from a fleet manifest
            </p>
          </div>
          <button
            type="button"
            onClick={handleBackToModeSelect}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            ← Change Mode
          </button>
        </div>

        {/* Show fleet summary dashboard when results are available */}
        {showSummaryDashboard ? (
          <FleetSummaryDashboard />
        ) : (
          <FleetWizardShell stepContent={FLEET_STEP_CONTENT} />
        )}
      </div>
    </div>
  );
}
