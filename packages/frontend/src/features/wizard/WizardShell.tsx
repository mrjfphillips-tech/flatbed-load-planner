// ─── Wizard Shell ────────────────────────────────────────────────────────────
// Main container that renders the wizard navigation and delegates step content
// to the appropriate feature module components.

import { useWizardStore } from './wizard-store';
import type { WizardStep } from './wizard-store';
import { useEquipmentStore } from '../equipment/equipment-store';
import { useUnitsStore } from './units-store';
import { WizardNav } from './WizardNav';
import { EquipmentStep } from './steps/EquipmentStep';
import { SteelOrdersStep } from './steps/SteelOrdersStep';
import { RulesStep } from './steps/RulesStep';
import { GeneratePlanStep } from './steps/GeneratePlanStep';

export interface WizardShellProps {
  /** Optional classname for the wizard container */
  className?: string;
}

export function WizardShell({ className = '' }: WizardShellProps) {
  const currentStep = useWizardStore((s) => s.currentStep);
  const unsavedChanges = useWizardStore((s) => s.unsavedChanges);
  const unitSystem = useUnitsStore((s) => s.unitSystem);
  const setUnitSystem = useUnitsStore((s) => s.setUnitSystem);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Unit system toggle */}
      <div className="flex items-center justify-end px-4 py-2 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Units:</span>
          <button
            type="button"
            onClick={() => setUnitSystem('metric')}
            className={`px-2 py-1 rounded ${
              unitSystem === 'metric'
                ? 'bg-blue-600 text-white font-medium'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            Metric (m, kg)
          </button>
          <button
            type="button"
            onClick={() => setUnitSystem('imperial')}
            className={`px-2 py-1 rounded ${
              unitSystem === 'imperial'
                ? 'bg-blue-600 text-white font-medium'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            Imperial (ft, lbs)
          </button>
        </div>
      </div>

      {/* Unsaved changes indicator */}
      {unsavedChanges && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-xs text-amber-700">
          You have unsaved changes
        </div>
      )}

      {/* Step navigation */}
      <WizardNav className="px-4 py-3 border-b border-gray-200 bg-white" />

      {/* Step content area */}
      <div className="flex-1 overflow-auto p-4">
        <StepContent step={currentStep} />
      </div>

      {/* Step footer with navigation buttons */}
      <WizardFooter />
    </div>
  );
}

// ─── Step Content Router ─────────────────────────────────────────────────────

function StepContent({ step }: { step: WizardStep }) {
  switch (step) {
    case 1:
      return <EquipmentStep />;
    case 2:
      return <SteelOrdersStep />;
    case 3:
      return <RulesStep />;
    case 4:
      return <GeneratePlanStep />;
    default:
      return null;
  }
}

// ─── Wizard Footer (Prev / Next) ────────────────────────────────────────────

function WizardFooter() {
  const currentStep = useWizardStore((s) => s.currentStep);
  const nextStep = useWizardStore((s) => s.nextStep);
  const previousStep = useWizardStore((s) => s.previousStep);
  const canProceedFromStep = useWizardStore((s) => s.canProceedFromStep);
  const getStepValidation = useWizardStore((s) => s.getStepValidation);
  // Subscribe to data that affects step validation so footer re-renders
  const orderItems = useWizardStore((s) => s.orderItems);
  const activeRules = useWizardStore((s) => s.activeRules);
  // These subscriptions ensure re-render when step data changes (used implicitly by canProceedFromStep)
  void orderItems;
  void activeRules;

  // For step 1, also check equipment store directly (avoids circular store deps)
  const equipmentCombination = useEquipmentStore((s) => s.combination);
  const payloadError = useEquipmentStore((s) => s.payloadError);

  const canProceedStep1 = currentStep === 1
    ? (equipmentCombination !== null && !payloadError)
    : canProceedFromStep(currentStep);
  const canProceed = currentStep === 1 ? canProceedStep1 : canProceedFromStep(currentStep);

  const validation = getStepValidation(currentStep);
  // Override validation message for step 1 when equipment store has data
  const showValidationReason = currentStep === 1
    ? (!equipmentCombination ? 'Select a tractor-trailer combination' : payloadError || undefined)
    : (!validation.isComplete ? validation.reason : undefined);

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
      {/* Previous button */}
      <button
        type="button"
        onClick={previousStep}
        disabled={currentStep === 1}
        className={`
          px-4 py-2 text-sm rounded-md transition-colors
          ${currentStep === 1
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-gray-700 hover:bg-gray-100'
          }
        `}
      >
        ← Previous
      </button>

      {/* Validation message */}
      {showValidationReason && (
        <span className="text-xs text-gray-500">{showValidationReason}</span>
      )}

      {/* Next button */}
      {currentStep < 4 && (
        <button
          type="button"
          onClick={nextStep}
          disabled={!canProceed}
          className={`
            px-4 py-2 text-sm font-medium rounded-md transition-colors
            ${canProceed
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          Next →
        </button>
      )}
    </div>
  );
}
