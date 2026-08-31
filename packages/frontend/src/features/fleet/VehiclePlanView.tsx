// ─── Per-Vehicle Plan View ───────────────────────────────────────────────────
// Displays a single vehicle's load plan with DrawingRenderer and metrics.
// Supports prev/next vehicle navigation and returning to the fleet summary.
//
// Requirements: 5.2, 5.3, 5.4

import { useMemo } from 'react';
import { useFleetStore } from './fleet-store';
import { resolveVehicleProfile, isProfileResolutionError } from './profile-resolver';
import { DrawingRenderer } from '../drawing/DrawingRenderer';
import type { VehiclePlanEntry, VehicleRecord } from './types';

// ─── Component ───────────────────────────────────────────────────────────────

export interface VehiclePlanViewProps {
  /** Callback to return to the fleet summary (no re-run of planning engine) */
  onBackToSummary: () => void;
}

export function VehiclePlanView({ onBackToSummary }: VehiclePlanViewProps) {
  const fleetPlanResult = useFleetStore((s) => s.fleetPlanResult);
  const selectedVehicleId = useFleetStore((s) => s.selectedVehicleId);
  const selectVehicle = useFleetStore((s) => s.selectVehicle);
  const vehicleRecords = useFleetStore((s) => s.vehicleRecords);

  // Find the selected vehicle entry from the fleet plan result
  const vehicles = fleetPlanResult?.vehicles ?? [];
  const currentIndex = vehicles.findIndex((v) => v.vehicleId === selectedVehicleId);
  const currentEntry: VehiclePlanEntry | undefined = vehicles[currentIndex];

  // Navigation state
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < vehicles.length - 1;

  // Resolve trailer profile for DrawingRenderer
  const trailerProfile = useMemo(() => {
    if (!currentEntry) return null;

    // Find the matching VehicleRecord to re-resolve the profile
    const record: VehicleRecord | undefined = vehicleRecords.find(
      (r) => r.vehicleId === currentEntry.vehicleId
    );
    if (!record) return null;

    const resolved = resolveVehicleProfile(record);
    if (isProfileResolutionError(resolved)) return null;

    return resolved.trailer;
  }, [currentEntry, vehicleRecords]);

  // ─── Navigation Handlers ─────────────────────────────────────────────────

  const handlePrevious = () => {
    if (hasPrevious) {
      selectVehicle(vehicles[currentIndex - 1].vehicleId);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      selectVehicle(vehicles[currentIndex + 1].vehicleId);
    }
  };

  // ─── Guard: No selection ─────────────────────────────────────────────────

  if (!currentEntry) {
    return (
      <div className="p-6 text-center text-gray-500">
        No vehicle selected. Return to the fleet summary to select a vehicle.
        <div className="mt-4">
          <button
            type="button"
            onClick={onBackToSummary}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            ← Back to Fleet Summary
          </button>
        </div>
      </div>
    );
  }

  const { licensePlate, vehicleType, conditionCode, status, planResult, assignedOrders, error } =
    currentEntry;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Back link + navigation header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToSummary}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
          aria-label="Back to fleet summary"
        >
          ← Fleet Summary
        </button>

        {/* Vehicle position indicator */}
        <span className="text-xs text-gray-500">
          Vehicle {currentIndex + 1} of {vehicles.length}
        </span>
      </div>

      {/* Vehicle Header (Req 5.4) */}
      <VehicleHeader
        licensePlate={licensePlate}
        vehicleType={vehicleType}
        conditionCode={conditionCode}
        status={status}
      />

      {/* Previous / Next navigation (Req 5.3) */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevious}
          disabled={!hasPrevious}
          className={`
            px-4 py-2 text-sm rounded-md transition-colors
            ${hasPrevious
              ? 'text-gray-700 hover:bg-gray-100 border border-gray-300'
              : 'text-gray-400 cursor-not-allowed border border-gray-200'
            }
          `}
          aria-label="Previous vehicle"
        >
          ← Previous
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={!hasNext}
          className={`
            px-4 py-2 text-sm rounded-md transition-colors
            ${hasNext
              ? 'text-gray-700 hover:bg-gray-100 border border-gray-300'
              : 'text-gray-400 cursor-not-allowed border border-gray-200'
            }
          `}
          aria-label="Next vehicle"
        >
          Next →
        </button>
      </div>

      {/* Plan content: either drawing + metrics or error state */}
      {status === 'failed' && !planResult && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          <p className="font-medium">✗ Plan generation failed</p>
          <p className="mt-1">{error ?? 'An unknown error occurred during planning.'}</p>
          <p className="mt-2 text-xs text-red-600">
            Assigned orders: {assignedOrders.length}
          </p>
        </div>
      )}

      {planResult && trailerProfile && (
        <>
          {/* Weight Metrics */}
          <WeightMetricsPanel weightMetrics={planResult.weightMetrics} />

          {/* Plan Stats */}
          <PlanStats
            placedCount={planResult.placedFreight.length}
            unplacedCount={planResult.unplacedItems.length}
            assignedCount={assignedOrders.length}
            status={status}
          />

          {/* Drawing Renderer (Req 5.2) — reuses existing component */}
          <DrawingRenderer
            trailer={trailerProfile}
            placedFreight={planResult.placedFreight}
            className="mt-4"
          />

          {/* Warnings */}
          {planResult.warnings && planResult.warnings.length > 0 && (
            <WarningsPanel warnings={planResult.warnings} />
          )}
        </>
      )}

      {/* Edge case: planResult exists but trailer profile couldn't be resolved */}
      {planResult && !trailerProfile && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <p className="font-medium">⚠ Unable to resolve trailer profile</p>
          <p className="mt-1">
            The vehicle's condition code ({conditionCode}) could not be resolved to a display
            profile. Metrics are available but the drawing cannot be rendered.
          </p>
          {/* Still show metrics */}
          <WeightMetricsPanel weightMetrics={planResult.weightMetrics} />
        </div>
      )}
    </div>
  );
}

// ─── Vehicle Header ──────────────────────────────────────────────────────────

function VehicleHeader({
  licensePlate,
  vehicleType,
  conditionCode,
  status,
}: {
  licensePlate: string;
  vehicleType: string;
  conditionCode: string;
  status: 'success' | 'partial' | 'failed' | 'pending';
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* License plate — prominent display */}
          <div className="px-3 py-1.5 bg-gray-900 text-white rounded font-mono text-lg font-bold tracking-wider">
            {licensePlate}
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-900">{vehicleType}</span>
            <span className="text-xs text-gray-500">
              Condition: <span className="font-medium text-blue-700">{conditionCode}</span>
            </span>
          </div>
        </div>

        <StatusBadge status={status} />
      </div>
    </div>
  );
}

// ─── Weight Metrics Panel ────────────────────────────────────────────────────

function WeightMetricsPanel({
  weightMetrics,
}: {
  weightMetrics: {
    totalGross: number;
    steerWeight: number;
    driveWeight: number;
    trailerWeight: number;
    cgLongitudinal: number;
    cgLateral: number;
    axleUtilization: { steer: number; drive: number; trailer: number };
  };
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Weight Metrics</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <MetricItem
          label="Total Gross"
          value={`${weightMetrics.totalGross.toLocaleString()} lbs`}
        />
        <MetricItem
          label="Steer Axle"
          value={`${weightMetrics.steerWeight.toLocaleString()} lbs`}
          utilization={weightMetrics.axleUtilization.steer}
        />
        <MetricItem
          label="Drive Axle"
          value={`${weightMetrics.driveWeight.toLocaleString()} lbs`}
          utilization={weightMetrics.axleUtilization.drive}
        />
        <MetricItem
          label="Trailer Axle"
          value={`${weightMetrics.trailerWeight.toLocaleString()} lbs`}
          utilization={weightMetrics.axleUtilization.trailer}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
        <MetricItem
          label="CG Longitudinal"
          value={`${weightMetrics.cgLongitudinal.toFixed(1)}"`}
        />
        <MetricItem
          label="CG Lateral"
          value={`${weightMetrics.cgLateral.toFixed(1)}"`}
        />
      </div>
    </div>
  );
}

function MetricItem({
  label,
  value,
  utilization,
}: {
  label: string;
  value: string;
  utilization?: number;
}) {
  const utilizationColor =
    utilization !== undefined
      ? utilization > 100
        ? 'text-red-600'
        : utilization > 95
          ? 'text-amber-600'
          : 'text-green-700'
      : '';

  return (
    <div>
      <span className="text-gray-500 text-xs block">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
      {utilization !== undefined && (
        <span className={`ml-1 text-xs ${utilizationColor}`}>
          ({utilization.toFixed(1)}%)
        </span>
      )}
    </div>
  );
}

// ─── Plan Stats ──────────────────────────────────────────────────────────────

function PlanStats({
  placedCount,
  unplacedCount,
  assignedCount,
  status,
}: {
  placedCount: number;
  unplacedCount: number;
  assignedCount: number;
  status: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-6 text-sm p-3 rounded-lg bg-gray-50 border border-gray-200">
      <div>
        <span className="text-gray-500">Assigned:</span>{' '}
        <span className="font-semibold text-gray-900">{assignedCount}</span>
      </div>
      <div>
        <span className="text-gray-500">Placed:</span>{' '}
        <span className="font-semibold text-green-700">{placedCount}</span>
      </div>
      {unplacedCount > 0 && (
        <div>
          <span className="text-gray-500">Unplaced:</span>{' '}
          <span className="font-semibold text-amber-700">{unplacedCount}</span>
        </div>
      )}
      {status === 'partial' && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
          Partial — some items could not be placed
        </span>
      )}
    </div>
  );
}

// ─── Warnings Panel ──────────────────────────────────────────────────────────

function WarningsPanel({ warnings }: { warnings: string[] }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-900 mb-2">
        Warnings ({warnings.length})
      </h4>
      <ul className="space-y-1 text-sm text-gray-700">
        {warnings.slice(0, 8).map((w, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5" aria-hidden="true">⚠</span>
            <span>{w}</span>
          </li>
        ))}
        {warnings.length > 8 && (
          <li className="text-xs text-gray-500 pl-5">
            ...and {warnings.length - 8} more
          </li>
        )}
      </ul>
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'success' | 'partial' | 'failed' | 'pending' }) {
  const styles = {
    success: 'bg-green-100 text-green-800',
    partial: 'bg-amber-100 text-amber-800',
    failed: 'bg-red-100 text-red-800',
    pending: 'bg-gray-100 text-gray-600',
  };

  const icons = {
    success: '✓',
    partial: '⚠',
    failed: '✗',
    pending: '○',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status]}`}
    >
      <span aria-hidden="true">{icons[status]}</span>
      {status}
    </span>
  );
}
