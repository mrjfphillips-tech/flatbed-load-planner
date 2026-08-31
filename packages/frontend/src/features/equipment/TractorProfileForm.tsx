// ─── Tractor Profile Form ────────────────────────────────────────────────────
// Form for creating/editing tractor profiles.

import { useState } from 'react';
import type { TractorProfile } from '@ptv-discovery-coach/shared';
import { validateTractorProfile } from '@ptv-discovery-coach/shared';
import { useEquipmentStore } from './equipment-store';

interface TractorProfileFormProps {
  /** Optional existing tractor to edit */
  initial?: TractorProfile;
  /** Callback after successful save */
  onSave?: (tractor: TractorProfile) => void;
  /** Callback to cancel editing */
  onCancel?: () => void;
}

export function TractorProfileForm({ initial, onSave, onCancel }: TractorProfileFormProps) {
  const addTractorProfile = useEquipmentStore((s) => s.addTractorProfile);
  const selectTractor = useEquipmentStore((s) => s.selectTractor);

  const [name, setName] = useState(initial?.name ?? '');
  const [steerAxleRating, setSteerAxleRating] = useState(initial?.steerAxleRating ?? 12000);
  const [driveAxleRating, setDriveAxleRating] = useState(initial?.driveAxleRating ?? 34000);
  const [fifthWheelPosition, setFifthWheelPosition] = useState(initial?.fifthWheelPosition ?? 180);
  const [tareWeight, setTareWeight] = useState(initial?.tareWeight ?? 17500);
  const [driveAxleCount, setDriveAxleCount] = useState(initial?.driveAxleCount ?? 2);

  const [errors, setErrors] = useState<string[]>([]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const tractor: TractorProfile = {
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim() || 'Custom Tractor',
      steerAxleRating,
      driveAxleRating,
      fifthWheelPosition,
      tareWeight,
      driveAxleCount,
    };

    const validation = validateTractorProfile(tractor);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors([]);
    addTractorProfile(tractor);
    selectTractor(tractor);
    onSave?.(tractor);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Tractor profile form">
      <h3 className="text-lg font-semibold text-gray-800">Tractor Profile</h3>

      {errors.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-3" role="alert">
          {errors.map((err, i) => (
            <p key={i} className="text-sm text-red-700">{err}</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Standard Day Cab"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Steer Axle Rating (lbs)</span>
          <input
            type="number"
            value={steerAxleRating}
            onChange={(e) => setSteerAxleRating(Number(e.target.value))}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            min={0}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Drive Axle Rating (lbs)</span>
          <input
            type="number"
            value={driveAxleRating}
            onChange={(e) => setDriveAxleRating(Number(e.target.value))}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            min={0}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Fifth-Wheel Position (in)</span>
          <input
            type="number"
            value={fifthWheelPosition}
            onChange={(e) => setFifthWheelPosition(Number(e.target.value))}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            min={0}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Tare Weight (lbs)</span>
          <input
            type="number"
            value={tareWeight}
            onChange={(e) => setTareWeight(Number(e.target.value))}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            min={0}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Drive Axle Count</span>
          <select
            value={driveAxleCount}
            onChange={(e) => setDriveAxleCount(Number(e.target.value))}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value={1}>Single</option>
            <option value={2}>Tandem</option>
          </select>
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Save Tractor Profile
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
