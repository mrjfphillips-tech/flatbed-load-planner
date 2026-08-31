// ─── Fleet Wizard Navigation ─────────────────────────────────────────────────
// Step indicator component for the 4-step fleet planning wizard.
// Displays the current step, completed steps, and step labels.
//
// Requirements: 6.1, 6.2

import type { FleetWizardStep } from './types';

const STEPS: { step: FleetWizardStep; label: string }[] = [
  { step: 1, label: 'Fleet File' },
  { step: 2, label: 'Orders File' },
  { step: 3, label: 'Rules Review' },
  { step: 4, label: 'Generate & Review' },
];

export interface FleetWizardNavProps {
  currentStep: FleetWizardStep;
  /** Called when user clicks a step indicator to jump to it */
  onStepClick?: (step: FleetWizardStep) => void;
  /** Determines whether a step is reachable (clickable) */
  canNavigateTo?: (step: FleetWizardStep) => boolean;
}

export function FleetWizardNav({
  currentStep,
  onStepClick,
  canNavigateTo,
}: FleetWizardNavProps) {
  return (
    <nav aria-label="Fleet wizard progress" className="w-full">
      <ol className="flex items-center justify-between gap-2">
        {STEPS.map(({ step, label }, index) => {
          const isActive = step === currentStep;
          const isCompleted = step < currentStep;
          const isClickable =
            onStepClick != null && (canNavigateTo ? canNavigateTo(step) : isCompleted);

          return (
            <li key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepClick?.(step)}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`Step ${step}: ${label}${isCompleted ? ' (completed)' : ''}`}
                  className={`
                    flex items-center justify-center w-9 h-9 rounded-full text-sm font-medium
                    transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                    ${isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isCompleted
                        ? 'bg-green-500 text-white cursor-pointer hover:bg-green-600'
                        : 'bg-gray-200 text-gray-500 cursor-default'
                    }
                    ${isClickable && !isActive ? 'cursor-pointer' : ''}
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step
                  )}
                </button>
                <span
                  className={`text-xs text-center whitespace-nowrap ${
                    isActive ? 'font-semibold text-blue-700' : 'text-gray-500'
                  }`}
                >
                  {label}
                </span>
              </div>

              {/* Connector line between steps */}
              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mt-[-1rem] ${
                    step < currentStep ? 'bg-green-400' : 'bg-gray-200'
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
