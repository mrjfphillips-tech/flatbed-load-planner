// ─── Load Diagram Generator Page ─────────────────────────────────────────────
// Feature: load-diagram-generator
//
// Top-level page for the load-diagram flow. Provides wizard navigation
// (Upload → Diagram → Export) and a global metric/imperial unit toggle that
// re-displays all values without changing the underlying canonical data.
// _Requirements: 6.1, 10.1, 10.4_

import { useLoadDiagramStore, type LoadDiagramStep } from '../features/load-diagram/load-diagram-store';
import { UnitToggle } from '../features/load-diagram/UnitToggle';
import { UploadWizard } from '../features/load-diagram/UploadWizard';
import { DiagramViewer } from '../features/load-diagram/DiagramViewer';
import { PlanEditor } from '../features/load-diagram/PlanEditor';
import { ExportPanel } from '../features/load-diagram/ExportPanel';
import { useState } from 'react';

const STEPS: { id: LoadDiagramStep; label: string }[] = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Diagram' },
  { id: 3, label: 'Export' },
];

export function LoadDiagramPage() {
  const {
    currentStep,
    displayUnitSystem,
    planId,
    setCurrentStep,
    setDisplayUnitSystem,
  } = useLoadDiagramStore();

  function canGoTo(step: LoadDiagramStep): boolean {
    if (step === 1) return true;
    // Steps 2 and 3 require a computed plan.
    return planId !== null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Load Diagram Generator</h1>
            <p className="mt-1 text-sm text-gray-600">
              Upload freight, generate a 3D-packed loading diagram, and export it.
            </p>
          </div>
          <UnitToggle value={displayUnitSystem} onChange={setDisplayUnitSystem} />
        </div>

        {/* Wizard nav */}
        <nav className="mb-6 flex gap-2" aria-label="Wizard steps">
          {STEPS.map((step) => {
            const active = step.id === currentStep;
            const enabled = canGoTo(step.id);
            return (
              <button
                key={step.id}
                type="button"
                disabled={!enabled}
                onClick={() => setCurrentStep(step.id)}
                className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : enabled
                      ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                }`}
              >
                {step.id}. {step.label}
              </button>
            );
          })}
        </nav>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          {currentStep === 1 && (
            <UploadWizard onGenerated={() => setCurrentStep(2)} />
          )}
          {currentStep === 2 && <DiagramStep />}
          {currentStep === 3 && <ExportPanel />}
        </div>
      </div>
    </div>
  );
}

/** Diagram step: toggle between viewing the plan and editing placements. */
function DiagramStep() {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5">
        {(['view', 'edit'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 text-sm font-medium rounded ${
              mode === m ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {m === 'view' ? 'View' : 'Edit'}
          </button>
        ))}
      </div>
      {mode === 'view' ? <DiagramViewer /> : <PlanEditor />}
    </div>
  );
}
