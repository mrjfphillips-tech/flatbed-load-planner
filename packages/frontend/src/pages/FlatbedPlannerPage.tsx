/**
 * Flatbed Load Planner Page
 *
 * Renders the four-step wizard for the OptiFlow Flatbed Steel Load Planner:
 * Equipment → Steel Orders → Rules → Generate Load Plan
 */

import { WizardShell } from '../features/wizard/WizardShell';

export function FlatbedPlannerPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            OptiFlow Flatbed Load Optimizer
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Plan, visualize, and export flatbed load configurations
          </p>
        </div>
        <WizardShell />
      </div>
    </div>
  );
}
