// ─── Fleet Wizard Shell ──────────────────────────────────────────────────────
// 4-step wizard container for the fleet planning workflow:
//   Step 1 (Fleet File Upload) → Step 2 (Orders File Upload) →
//   Step 3 (Rules Review) → Step 4 (Generate & Review)
//
// Renders placeholder content for each step; actual step components are
// wired in tasks 7.3–7.5.
//
// Requirements: 6.1, 6.2

import { useFleetStore } from './fleet-store';
import { FleetWizardNav } from './FleetWizardNav';
import type { FleetWizardStep } from './types';

export interface FleetWizardShellProps {
  /** Optional slot overrides for each step's content */
  stepContent?: Partial<Record<FleetWizardStep, React.ReactNode>>;
  /** Optional classname for the outer container */
  className?: string;
}

export function FleetWizardShell({ stepContent, className = '' }: FleetWizardShellProps) {
  const currentStep = useFleetStore((s) => s.currentStep);
  const nextStep = useFleetStore((s) => s.nextStep);
  const previousStep = useFleetStore((s) => s.previousStep);
  const goToStep = useFleetStore((s) => s.goToStep);
  const canProceedFromStep = useFleetStore((s) => s.canProceedFromStep);

  // Subscribe to data that affects canProceedFromStep so the component re-renders
  const vehicleRecords = useFleetStore((s) => s.vehicleRecords);
  const ordersByDeliveryNumber = useFleetStore((s) => s.ordersByDeliveryNumber);
  const activeRules = useFleetStore((s) => s.activeRules);
  const fleetPlanResult = useFleetStore((s) => s.fleetPlanResult);
  void vehicleRecords; void ordersByDeliveryNumber; void activeRules; void fleetPlanResult;

  const canGoNext = canProceedFromStep(currentStep);
  const canGoBack = currentStep > 1;

  function handleStepClick(step: FleetWizardStep) {
    // Allow navigating back to completed steps
    if (step < currentStep) {
      goToStep(step);
    }
  }

  function canNavigateTo(step: FleetWizardStep): boolean {
    return step < currentStep;
  }

  // Resolve content for the current step — use slot override or placeholder
  const content = stepContent?.[currentStep] ?? <StepPlaceholder step={currentStep} />;

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* Step indicator */}
      <FleetWizardNav
        currentStep={currentStep}
        onStepClick={handleStepClick}
        canNavigateTo={canNavigateTo}
      />

      {/* Step content area */}
      <div className="min-h-[24rem] rounded-lg border border-gray-200 bg-white p-6">
        {content}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={previousStep}
          disabled={!canGoBack}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${canGoBack
              ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          ← Back
        </button>

        {currentStep < 4 && (
          <button
            type="button"
            onClick={nextStep}
            disabled={!canGoNext}
            className={`
              px-5 py-2 rounded-md text-sm font-medium transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${canGoNext
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-300 text-white cursor-not-allowed'
              }
            `}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step Placeholder ────────────────────────────────────────────────────────
// Rendered when no stepContent override is provided for a given step.

const STEP_META: Record<FleetWizardStep, { title: string; description: string }> = {
  1: {
    title: 'Upload Fleet File',
    description: 'Upload a CSV or XLSX file describing today\'s available vehicles and their specifications.',
  },
  2: {
    title: 'Upload Orders File',
    description: 'Upload the orders file. Each order\'s Delivery Number will be matched to a vehicle in the fleet.',
  },
  3: {
    title: 'Review Rules',
    description: 'Review and confirm the stacking and placement rules that will be applied to each vehicle\'s plan.',
  },
  4: {
    title: 'Generate & Review',
    description: 'Generate load plans for all vehicles and review the results in the fleet summary dashboard.',
  },
};

function StepPlaceholder({ step }: { step: FleetWizardStep }) {
  const { title, description } = STEP_META[step];

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[20rem] gap-4 text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 text-2xl text-gray-400">
        {step}
      </div>
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      <p className="max-w-md text-sm text-gray-500">{description}</p>
    </div>
  );
}
