// ─── Equipment Combination Display ───────────────────────────────────────────
// Shows calculated payload, gross weight, per-axle limits, and error state.

import { useEquipmentStore } from './equipment-store';
import { useUnitsStore, displayWeight } from '../wizard/units-store';

export function CombinationDisplay() {
  const combination = useEquipmentStore((s) => s.combination);
  const payloadError = useEquipmentStore((s) => s.payloadError);
  const selectedTractor = useEquipmentStore((s) => s.selectedTractor);
  const selectedTrailer = useEquipmentStore((s) => s.selectedTrailer);
  const unitSystem = useUnitsStore((s) => s.unitSystem);

  if (!selectedTractor || !selectedTrailer) {
    return (
      <div className="rounded border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        Select both a tractor and trailer to see combination metrics.
      </div>
    );
  }

  if (payloadError) {
    return (
      <div
        className="rounded border border-red-300 bg-red-50 p-4"
        role="alert"
        aria-live="polite"
        data-testid="payload-error"
      >
        <h4 className="text-sm font-semibold text-red-800">
          ⚠ Invalid Combination — Cannot Proceed
        </h4>
        <p className="mt-1 text-sm text-red-700">{payloadError}</p>
      </div>
    );
  }

  if (!combination) {
    return null;
  }

  return (
    <div
      className="rounded border border-green-200 bg-green-50 p-4"
      aria-label="Equipment combination summary"
      data-testid="combination-display"
    >
      <h4 className="text-sm font-semibold text-green-800">Combination Summary</h4>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="font-medium text-gray-600">Available Payload</dt>
        <dd className="font-semibold text-gray-900">
          {displayWeight(combination.availablePayload, unitSystem)}
        </dd>

        <dt className="font-medium text-gray-600">Total Legal Gross</dt>
        <dd className="text-gray-900">
          {displayWeight(combination.totalLegalGross, unitSystem)}
        </dd>

        <dt className="font-medium text-gray-600">Steer Axle Limit</dt>
        <dd className="text-gray-900">
          {displayWeight(combination.perAxleLimits.steer, unitSystem)}
        </dd>

        <dt className="font-medium text-gray-600">Drive Axle Limit</dt>
        <dd className="text-gray-900">
          {displayWeight(combination.perAxleLimits.drive, unitSystem)}
        </dd>

        <dt className="font-medium text-gray-600">Trailer Axle Limit</dt>
        <dd className="text-gray-900">
          {displayWeight(combination.perAxleLimits.trailer, unitSystem)}
        </dd>
      </dl>
    </div>
  );
}
