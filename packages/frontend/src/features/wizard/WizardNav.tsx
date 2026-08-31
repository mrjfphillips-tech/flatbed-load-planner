// ─── Wizard Step Navigation Component ────────────────────────────────────────
// Renders the four-step navigation bar with step indicators, labels, and
// progress. Steps are clickable only when prior steps are complete.

import { useWizardStore, WIZARD_STEPS } from './wizard-store';
import type { WizardStep } from './wizard-store';

export interface WizardNavProps {
  /** Optional classname for the nav container */
  className?: string;
}

export function WizardNav({ className = '' }: WizardNavProps) {
  const currentStep = useWizardStore((s) => s.currentStep);
  const goToStep = useWizardStore((s) => s.goToStep);
  const canProceedFromStep = useWizardStore((s) => s.canProceedFromStep);

  function isStepAccessible(step: WizardStep): boolean {
    if (step === 1) return true;
    // Can navigate to a step if all prior steps are complete
    for (let i = 1; i < step; i++) {
      if (!canProceedFromStep(i as WizardStep)) return false;
    }
    return true;
  }

  function getStepStatus(step: WizardStep): 'completed' | 'current' | 'upcoming' {
    if (step < currentStep) return 'completed';
    if (step === currentStep) return 'current';
    return 'upcoming';
  }

  return (
    <nav className={`flex items-center justify-between ${className}`} aria-label="Wizard steps">
      {WIZARD_STEPS.map((stepInfo, index) => {
        const status = getStepStatus(stepInfo.step);
        const accessible = isStepAccessible(stepInfo.step);

        return (
          <div key={stepInfo.step} className="flex items-center flex-1">
            {/* Step indicator */}
            <button
              type="button"
              onClick={() => accessible && goToStep(stepInfo.step)}
              disabled={!accessible}
              aria-current={status === 'current' ? 'step' : undefined}
              aria-label={`Step ${stepInfo.step}: ${stepInfo.label}`}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
                ${status === 'current' ? 'bg-blue-100 text-blue-800 font-semibold' : ''}
                ${status === 'completed' ? 'text-green-700 cursor-pointer hover:bg-green-50' : ''}
                ${status === 'upcoming' && accessible ? 'text-gray-600 cursor-pointer hover:bg-gray-50' : ''}
                ${status === 'upcoming' && !accessible ? 'text-gray-400 cursor-not-allowed' : ''}
              `}
            >
              {/* Step number circle */}
              <span
                className={`
                  flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium
                  ${status === 'current' ? 'bg-blue-600 text-white' : ''}
                  ${status === 'completed' ? 'bg-green-600 text-white' : ''}
                  ${status === 'upcoming' ? 'bg-gray-300 text-gray-600' : ''}
                `}
              >
                {status === 'completed' ? '✓' : stepInfo.step}
              </span>

              {/* Step label */}
              <span className="hidden sm:inline text-sm">{stepInfo.label}</span>
            </button>

            {/* Connector line */}
            {index < WIZARD_STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  stepInfo.step < currentStep ? 'bg-green-400' : 'bg-gray-200'
                }`}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
