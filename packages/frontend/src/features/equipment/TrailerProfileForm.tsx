// ─── Trailer Profile Form ────────────────────────────────────────────────────
// Form for creating/editing trailer profiles with all required attributes.

import { useState } from 'react';
import type { TrailerProfile, DeckMaterial, Position2D } from '@ptv-discovery-coach/shared';
import { validateTrailerProfile } from '@ptv-discovery-coach/shared';
import { useEquipmentStore } from './equipment-store';

interface TrailerProfileFormProps {
  /** Optional existing trailer to edit */
  initial?: TrailerProfile;
  /** Callback after successful save */
  onSave?: (trailer: TrailerProfile) => void;
  /** Callback to cancel editing */
  onCancel?: () => void;
}

const DECK_MATERIALS: DeckMaterial[] = ['steel', 'aluminum', 'wood'];

function parsePositions(raw: string): Position2D[] {
  if (!raw.trim()) return [];
  return raw.split(';').map((pair) => {
    const [x, y] = pair.split(',').map(Number);
    return { x: x || 0, y: y || 0 };
  });
}

function formatPositions(positions: Position2D[]): string {
  return positions.map((p) => `${p.x},${p.y}`).join(';');
}

export function TrailerProfileForm({ initial, onSave, onCancel }: TrailerProfileFormProps) {
  const addTrailerProfile = useEquipmentStore((s) => s.addTrailerProfile);
  const selectTrailer = useEquipmentStore((s) => s.selectTrailer);

  const [name, setName] = useState(initial?.name ?? '');
  const [lengthFt, setLengthFt] = useState(initial?.lengthFt ?? 48);
  const [deckWidthIn, setDeckWidthIn] = useState(initial?.deckWidthIn ?? 96);
  const [deckHeightIn, setDeckHeightIn] = useState(initial?.deckHeightIn ?? 60);
  const [maxGrossWeight, setMaxGrossWeight] = useState(initial?.maxGrossWeight ?? 80000);
  const [tareWeight, setTareWeight] = useState(initial?.tareWeight ?? 12500);
  const [axleCount, setAxleCount] = useState(initial?.axleCount ?? 2);
  const [axlePositionsStr, setAxlePositionsStr] = useState(
    initial?.axlePositions.join(',') ?? '432,480'
  );
  const [axleRatingsStr, setAxleRatingsStr] = useState(
    initial?.axleWeightRatings.join(',') ?? '34000,34000'
  );
  const [kingpinPosition, setKingpinPosition] = useState(initial?.kingpinPosition ?? 36);
  const [rearOverhangLimit, setRearOverhangLimit] = useState(initial?.rearOverhangLimit ?? 48);
  const [deckMaterial, setDeckMaterial] = useState<DeckMaterial>(initial?.deckMaterial ?? 'steel');
  const [stakePocketsStr, setStakePocketsStr] = useState(
    initial ? formatPositions(initial.stakePockets) : ''
  );
  const [anchorPointsStr, setAnchorPointsStr] = useState(
    initial ? formatPositions(initial.anchorPoints) : ''
  );
  const [maxConcentratedLoadPSF, setMaxConcentratedLoadPSF] = useState(
    initial?.maxConcentratedLoadPSF ?? 800
  );

  const [errors, setErrors] = useState<string[]>([]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const axlePositions = axlePositionsStr.split(',').map(Number).filter((n) => !isNaN(n));
    const axleWeightRatings = axleRatingsStr.split(',').map(Number).filter((n) => !isNaN(n));

    const trailer: TrailerProfile = {
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim() || `${lengthFt}-ft Flatbed`,
      lengthFt,
      deckWidthIn,
      deckHeightIn,
      maxGrossWeight,
      tareWeight,
      axleCount,
      axlePositions,
      axleWeightRatings,
      kingpinPosition,
      rearOverhangLimit,
      deckMaterial,
      stakePockets: parsePositions(stakePocketsStr),
      anchorPoints: parsePositions(anchorPointsStr),
      maxConcentratedLoadPSF,
    };

    const validation = validateTrailerProfile(trailer);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors([]);
    addTrailerProfile(trailer);
    selectTrailer(trailer);
    onSave?.(trailer);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Trailer profile form">
      <h3 className="text-lg font-semibold text-gray-800">Trailer Profile</h3>

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
            placeholder="48-ft Standard Flatbed"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Length (ft)</span>
          <input
            type="number"
            value={lengthFt}
            onChange={(e) => setLengthFt(Number(e.target.value))}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            min={20}
            max={60}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Deck Width (in)</span>
          <input
            type="number"
            value={deckWidthIn}
            onChange={(e) => setDeckWidthIn(Number(e.target.value))}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            min={48}
            max={120}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Deck Height (in)</span>
          <input
            type="number"
            value={deckHeightIn}
            onChange={(e) => setDeckHeightIn(Number(e.target.value))}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            min={30}
            max={72}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Max Gross Weight (lbs)</span>
          <input
            type="number"
            value={maxGrossWeight}
            onChange={(e) => setMaxGrossWeight(Number(e.target.value))}
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
          <span className="text-sm font-medium text-gray-700">Axle Count</span>
          <input
            type="number"
            value={axleCount}
            onChange={(e) => setAxleCount(Number(e.target.value))}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            min={1}
            max={6}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Kingpin Position (in)</span>
          <input
            type="number"
            value={kingpinPosition}
            onChange={(e) => setKingpinPosition(Number(e.target.value))}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            min={0}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Rear Overhang Limit (in)</span>
          <input
            type="number"
            value={rearOverhangLimit}
            onChange={(e) => setRearOverhangLimit(Number(e.target.value))}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            min={0}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Deck Material</span>
          <select
            value={deckMaterial}
            onChange={(e) => setDeckMaterial(e.target.value as DeckMaterial)}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            {DECK_MATERIALS.map((m) => (
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">Max Concentrated Load (PSF)</span>
          <input
            type="number"
            value={maxConcentratedLoadPSF}
            onChange={(e) => setMaxConcentratedLoadPSF(Number(e.target.value))}
            className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            min={0}
          />
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">
          Axle Positions (comma-separated inches from kingpin)
        </span>
        <input
          type="text"
          value={axlePositionsStr}
          onChange={(e) => setAxlePositionsStr(e.target.value)}
          className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="432,480"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">
          Axle Weight Ratings (comma-separated lbs)
        </span>
        <input
          type="text"
          value={axleRatingsStr}
          onChange={(e) => setAxleRatingsStr(e.target.value)}
          className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="34000,34000"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">
          Stake Pockets (x,y pairs separated by semicolons)
        </span>
        <input
          type="text"
          value={stakePocketsStr}
          onChange={(e) => setStakePocketsStr(e.target.value)}
          className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="48,-48;48,48;144,-48;144,48"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-gray-700">
          Anchor Points (x,y pairs separated by semicolons)
        </span>
        <input
          type="text"
          value={anchorPointsStr}
          onChange={(e) => setAnchorPointsStr(e.target.value)}
          className="mt-1 block w-full rounded border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          placeholder="24,-46;24,46;96,-46;96,46"
        />
      </label>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Save Trailer Profile
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
