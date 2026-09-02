// ─── Upload Wizard ───────────────────────────────────────────────────────────
// Feature: load-diagram-generator
//
// Step 1 of the load-diagram flow: upload an Excel file (parsed server-side into
// canonical units), review validation results and the detected unit system,
// download metric/imperial templates, pick a trailer profile, and generate the
// plan. Dimensions/weights are displayed in the selected unit system via the
// shared units module.
// _Requirements: 1.1, 1.5, 2.3, 9.1, 10.4_

import { useEffect, useRef, useState } from 'react';
import { loadDiagram } from '@ptv-discovery-coach/shared';
import { useLoadDiagramStore } from './load-diagram-store';
import {
  uploadExcel,
  templateUrl,
  listTrailers,
  createPlan,
  createPlanForVehicle,
  listFleets,
  getFleet,
  findFleetVehicle,
  type FleetSummary,
} from './api';

const { formatLength, formatWeight } = loadDiagram;

type FleetVehicle = loadDiagram.FleetVehicle & { id: string };
type TargetMode = 'fleet' | 'trailer';

interface UploadWizardProps {
  onGenerated?: (planId: string) => void;
}

export function UploadWizard({ onGenerated }: UploadWizardProps) {
  const {
    items,
    validationErrors,
    uploadSummary,
    sourceUnitSystem,
    displayUnitSystem,
    trailerProfiles,
    selectedTrailerId,
    selectedFleetVehicleId,
    selectedFleetVehicleLabel,
    isUploading,
    isGenerating,
    error,
    setUploadResult,
    setTrailerProfiles,
    selectTrailer,
    selectFleetVehicle,
    setPlanResult,
    setIsUploading,
    setIsGenerating,
    setError,
  } = useLoadDiagramStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  // Fleet selection at the Upload step.
  const [fleetList, setFleetList] = useState<FleetSummary[]>([]);
  const [activeFleetId, setActiveFleetId] = useState<string>('');
  const [fleetVehicles, setFleetVehicles] = useState<FleetVehicle[]>([]);
  // Default the target to "fleet" if any fleets exist, else "trailer".
  const [targetMode, setTargetMode] = useState<TargetMode>('trailer');
  // Set when the load sheet's Vehicle_ID auto-matched a fleet vehicle.
  const [autoAssignedLabel, setAutoAssignedLabel] = useState<string | null>(null);

  // Load trailer profiles + fleets once.
  useEffect(() => {
    let cancelled = false;
    listTrailers()
      .then((profiles) => {
        if (!cancelled) setTrailerProfiles(profiles);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    listFleets()
      .then((fleets) => {
        if (cancelled) return;
        setFleetList(fleets);
        // If a fleet vehicle is already chosen (came from the Fleet tab), keep
        // fleet mode; otherwise prefer fleet mode when fleets exist.
        if (selectedFleetVehicleId || fleets.length > 0) setTargetMode('fleet');
      })
      .catch(() => {
        /* fleets are optional */
      });
    return () => {
      cancelled = true;
    };
  }, [setTrailerProfiles, setError, selectedFleetVehicleId]);

  // Load the chosen fleet's vehicles.
  useEffect(() => {
    if (!activeFleetId) {
      setFleetVehicles([]);
      return;
    }
    let cancelled = false;
    getFleet(activeFleetId)
      .then((f) => {
        if (!cancelled) setFleetVehicles(f.vehicles as FleetVehicle[]);
      })
      .catch(() => {
        if (!cancelled) setFleetVehicles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeFleetId]);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setAutoAssignedLabel(null);
    setIsUploading(true);
    try {
      const result = await uploadExcel(file);
      setUploadResult(result);

      // If the sheet named a vehicle, try to auto-assign the matching fleet
      // vehicle so the user doesn't have to pick one.
      if (result.detectedVehicleId) {
        try {
          const match = await findFleetVehicle(result.detectedVehicleId);
          if (match) {
            setTargetMode('fleet');
            setActiveFleetId(match.fleetId);
            selectFleetVehicle(match.vehicle.id, `${match.vehicle.vehicleName} — ${match.fleetName}`);
            setAutoAssignedLabel(
              `${match.vehicle.vehicleName} (${match.vehicle.vehicleId}) — ${match.fleetName}`,
            );
          }
        } catch {
          /* auto-assign is best-effort; user can still pick manually */
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function handleGenerate() {
    if (items.length === 0) return;
    // A plan is generated against EITHER a fleet vehicle or a trailer profile.
    if (!selectedFleetVehicleId && !selectedTrailerId) return;
    setError(null);
    setIsGenerating(true);
    const name = fileName ? `Plan — ${fileName}` : 'Load Plan';
    try {
      const result = selectedFleetVehicleId
        ? await createPlanForVehicle(selectedFleetVehicleId, {
            name,
            items,
            sourceUnitSystem,
            displayUnitSystem,
          })
        : await createPlan({
            name,
            trailerProfileId: selectedTrailerId!,
            items,
            sourceUnitSystem,
            displayUnitSystem,
          });
      setPlanResult(result);
      onGenerated?.(result.planId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  }

  const hasErrors = validationErrors.length > 0;
  const canGenerate =
    items.length > 0 &&
    !hasErrors &&
    (!!selectedTrailerId || !!selectedFleetVehicleId) &&
    !isGenerating;

  return (
    <div className="space-y-6">
      {/* Template downloads */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-gray-600">Need a template?</span>
        <a
          href={templateUrl('metric')}
          className="text-blue-600 hover:underline"
          download
        >
          Metric template
        </a>
        <a
          href={templateUrl('imperial')}
          className="text-blue-600 hover:underline"
          download
        >
          Imperial template
        </a>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        role="button"
        tabIndex={0}
        aria-label="Upload Excel file"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <p className="text-gray-700">
          {isUploading
            ? 'Parsing…'
            : fileName
              ? `Selected: ${fileName}`
              : 'Drop an Excel file here, or click to choose'}
        </p>
        <p className="mt-1 text-xs text-gray-500">.xlsx — metric or imperial columns</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Validation results */}
      {hasErrors && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3">
          <p className="font-medium text-red-800">
            {validationErrors.length} validation issue(s):
          </p>
          <ul className="mt-2 max-h-40 overflow-auto text-sm text-red-700">
            {validationErrors.map((err, i) => (
              <li key={i}>
                {err.row > 0 ? `Row ${err.row}` : 'File'}
                {err.column ? ` · ${err.column}` : ''}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Upload summary */}
      {uploadSummary && !hasErrors && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          <p className="font-medium">
            Parsed {uploadSummary.totalItems} item(s) · detected {sourceUnitSystem} units
          </p>
          <p className="mt-1">
            Total weight: {formatWeight(uploadSummary.totalWeight, displayUnitSystem)} · Total
            volume:{' '}
            {formatLength(Math.cbrt(uploadSummary.totalVolume), displayUnitSystem)}³ (approx.)
          </p>
        </div>
      )}

      {/* Fleet vehicle selection (set from the Fleet tab) */}
      {/* Auto-assign notice */}
      {items.length > 0 && !hasErrors && autoAssignedLabel && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">
          Auto-assigned from the load sheet: <span className="font-medium">{autoAssignedLabel}</span>.
          You can change the selection below.
        </div>
      )}

      {/* Target selection: a fleet vehicle OR a generic trailer profile */}
      {items.length > 0 && !hasErrors && (
        <div className="space-y-3">
          <div>
            <span className="block text-sm font-medium text-gray-700">Plan against</span>
            <div className="mt-1 inline-flex rounded-md border border-gray-300 bg-white p-0.5">
              {(['fleet', 'trailer'] as TargetMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setTargetMode(m);
                    // Clear the other target when switching modes.
                    if (m === 'trailer') selectFleetVehicle(null, null);
                    else selectTrailer('');
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded ${
                    targetMode === m ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {m === 'fleet' ? 'Fleet vehicle' : 'Trailer profile'}
                </button>
              ))}
            </div>
          </div>

          {/* Fleet vehicle mode */}
          {targetMode === 'fleet' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-gray-700">Fleet</span>
                <select
                  value={activeFleetId}
                  onChange={(e) => {
                    setActiveFleetId(e.target.value);
                    selectFleetVehicle(null, null);
                  }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select a fleet…</option>
                  {fleetList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.vehicleCount})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-gray-700">Vehicle</span>
                <select
                  value={selectedFleetVehicleId ?? ''}
                  disabled={!activeFleetId}
                  onChange={(e) => {
                    const v = fleetVehicles.find((x) => x.id === e.target.value);
                    const fleetName = fleetList.find((f) => f.id === activeFleetId)?.name ?? '';
                    selectFleetVehicle(v ? v.id : null, v ? `${v.vehicleName} — ${fleetName}` : null);
                  }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                >
                  <option value="">Select a vehicle…</option>
                  {fleetVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleName} ({v.vehicleId}) — {formatLength(v.platformLength, displayUnitSystem)} L ·{' '}
                      {formatWeight(v.maxWeight, displayUnitSystem)} max
                    </option>
                  ))}
                </select>
              </label>

              {fleetList.length === 0 && (
                <p className="text-xs text-gray-500 sm:col-span-2">
                  No fleets yet — build one on the Fleet tab, or switch to a trailer profile.
                </p>
              )}
            </div>
          )}

          {/* Trailer profile mode */}
          {targetMode === 'trailer' && (
            <label className="block text-sm">
              <span className="text-gray-700">Trailer profile</span>
              <select
                value={selectedTrailerId ?? ''}
                onChange={(e) => selectTrailer(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a trailer…</option>
                {trailerProfiles.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {formatLength(t.internalLength, displayUnitSystem)} L ·{' '}
                    {formatWeight(t.maxPayloadWeight, displayUnitSystem)} max
                  </option>
                ))}
              </select>
            </label>
          )}

          {selectedFleetVehicleLabel && targetMode === 'fleet' && (
            <p className="text-xs text-blue-700">Planning against: {selectedFleetVehicleLabel}</p>
          )}
        </div>
      )}

      {/* Generate */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!canGenerate}
          onClick={() => void handleGenerate()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isGenerating ? 'Generating…' : 'Generate load plan'}
        </button>
      </div>
    </div>
  );
}
