// ─── Fleet Generate Step (Step 4) ────────────────────────────────────────────
// Triggers fleet plan generation: resolves vehicle profiles, invokes the fleet
// planner service, shows progress, and transitions to the fleet summary view.
//
// Requirements: 4.1, 6.1

import { useCallback, useState } from 'react';
import { useFleetStore } from '../fleet-store';
import { resolveVehicleProfile, isProfileResolutionError } from '../profile-resolver';
import { generateFleetPlan } from '../fleet-planner';
import type { FleetPlanVehicle } from '../fleet-planner';
import type { ProfileResolutionError } from '../types';

export function FleetGenerateStep() {
  // Fleet store state
  const vehicleRecords = useFleetStore((s) => s.vehicleRecords);
  const ordersByDeliveryNumber = useFleetStore((s) => s.ordersByDeliveryNumber);
  const activeRules = useFleetStore((s) => s.activeRules);
  const isGenerating = useFleetStore((s) => s.isGenerating);
  const generationProgress = useFleetStore((s) => s.generationProgress);
  const fleetPlanResult = useFleetStore((s) => s.fleetPlanResult);

  // Fleet store actions
  const setIsGenerating = useFleetStore((s) => s.setIsGenerating);
  const setGenerationProgress = useFleetStore((s) => s.setGenerationProgress);
  const setFleetPlanResult = useFleetStore((s) => s.setFleetPlanResult);

  // Local state for profile resolution errors
  const [resolutionErrors, setResolutionErrors] = useState<ProfileResolutionError[]>([]);

  // ─── Generate Handler ────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setResolutionErrors([]);
    setIsGenerating(true);
    setGenerationProgress({ completed: 0, total: 0 });

    try {
      // Resolve profiles for all valid vehicles
      const resolvedVehicles: FleetPlanVehicle[] = [];
      const errors: ProfileResolutionError[] = [];

      for (const record of vehicleRecords) {
        // Skip idle vehicles — only plan for active ones
        if (record.status === 'idle') continue;

        const result = resolveVehicleProfile(record);

        if (isProfileResolutionError(result)) {
          errors.push(result);
          continue;
        }

        // Find orders assigned to this vehicle
        const assignedOrders = ordersByDeliveryNumber.get(record.vehicleId) ?? [];

        resolvedVehicles.push({
          vehicleId: record.vehicleId,
          licensePlate: record.licensePlate,
          vehicleType: record.vehicleType,
          conditionCode: record.conditionCode,
          profile: result,
          orders: assignedOrders,
        });
      }

      setResolutionErrors(errors);

      // Invoke fleet planner with progress tracking
      const result = await generateFleetPlan(
        { vehicles: resolvedVehicles, rules: activeRules },
        (completed, total) => {
          setGenerationProgress({ completed, total });
        }
      );

      // Store result — this triggers the fleet summary view
      setFleetPlanResult(result);
    } catch (error: unknown) {
      setIsGenerating(false);
      // Error is shown inline
      console.error('Fleet generation failed:', error);
    }
  }, [
    vehicleRecords,
    ordersByDeliveryNumber,
    activeRules,
    setIsGenerating,
    setGenerationProgress,
    setFleetPlanResult,
  ]);

  // ─── Computed Values ─────────────────────────────────────────────────────

  const vehiclesWithOrders = vehicleRecords.filter(
    (v) => v.status === 'active' && (ordersByDeliveryNumber.get(v.vehicleId) ?? []).length > 0
  );
  const totalVehicles = vehiclesWithOrders.length;
  const progressPercent =
    generationProgress.total > 0
      ? Math.round((generationProgress.completed / generationProgress.total) * 100)
      : 0;

  // ─── Render: Completed State ─────────────────────────────────────────────

  if (fleetPlanResult) {
    const { summary } = fleetPlanResult;

    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Fleet Plans Generated</h2>
          <p className="mt-1 text-sm text-gray-600">
            All vehicle plans have been generated. Review the results in the fleet summary below.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Vehicles"
            value={summary.totalVehicles}
            color="bg-blue-50 text-blue-800 border-blue-200"
          />
          <SummaryCard
            label="Successful"
            value={summary.successCount}
            color="bg-green-50 text-green-800 border-green-200"
          />
          <SummaryCard
            label="Partial"
            value={summary.partialCount}
            color="bg-amber-50 text-amber-800 border-amber-200"
          />
          <SummaryCard
            label="Failed"
            value={summary.failedCount}
            color="bg-red-50 text-red-800 border-red-200"
          />
        </div>

        {/* Orders summary */}
        <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-500">Orders Placed:</span>{' '}
              <span className="font-semibold text-gray-900">{summary.totalOrdersPlaced}</span>
            </div>
            <div>
              <span className="text-gray-500">Orders Unplaced:</span>{' '}
              <span className="font-semibold text-gray-900">{summary.totalOrdersUnplaced}</span>
            </div>
          </div>
        </div>

        {/* Vehicle results table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">Vehicle Results</span>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Vehicle ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Plate</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">Status</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fleetPlanResult.vehicles.map((entry) => (
                  <tr key={entry.vehicleId}>
                    <td className="px-3 py-1.5 text-gray-900 font-medium">{entry.vehicleId}</td>
                    <td className="px-3 py-1.5 text-gray-700">{entry.licensePlate}</td>
                    <td className="px-3 py-1.5 text-gray-700">{entry.vehicleType}</td>
                    <td className="px-3 py-1.5 text-center">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-900">
                      {entry.assignedOrders.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resolution errors if any */}
        {resolutionErrors.length > 0 && (
          <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
            <h4 className="text-sm font-semibold text-amber-800 mb-2">
              Profile Resolution Errors ({resolutionErrors.length})
            </h4>
            {resolutionErrors.map((err) => (
              <p key={err.vehicleId} className="text-xs text-amber-700">
                Vehicle "{err.vehicleId}": {err.reason}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Generating State ────────────────────────────────────────────

  if (isGenerating) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Generating Fleet Plans...</h2>
          <p className="mt-1 text-sm text-gray-600">
            Processing load plans for each vehicle. This may take a moment.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-700">
            <span>
              Vehicle {generationProgress.completed} of {generationProgress.total}
            </span>
            <span className="font-medium">{progressPercent}%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={generationProgress.completed}
              aria-valuemin={0}
              aria-valuemax={generationProgress.total}
              aria-label={`Fleet plan generation progress: ${generationProgress.completed} of ${generationProgress.total} vehicles completed`}
            />
          </div>

          {/* Animated spinner */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg
              className="animate-spin h-4 w-4 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Planning in progress...</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Pre-Generation State ──────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Generate Fleet Plans</h2>
        <p className="mt-1 text-sm text-gray-600">
          Generate load plans for all vehicles with assigned orders. Each vehicle
          will be planned independently using its resolved equipment profile.
        </p>
      </div>

      {/* Pre-generation summary */}
      <div className="border border-gray-200 rounded-lg p-5 bg-gray-50 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Generation Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex flex-col">
            <span className="text-gray-500">Vehicles with orders</span>
            <span className="text-lg font-semibold text-gray-900">{totalVehicles}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">Total vehicles loaded</span>
            <span className="text-lg font-semibold text-gray-900">{vehicleRecords.length}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500">Active rules</span>
            <span className="text-lg font-semibold text-gray-900">{activeRules.length}</span>
          </div>
        </div>
      </div>

      {/* Vehicle & orders preview */}
      {totalVehicles > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
            <span className="text-sm font-medium text-gray-700">
              Vehicles to Plan ({totalVehicles})
            </span>
          </div>
          <div className="max-h-48 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Vehicle ID</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Plate</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-600">Code</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vehiclesWithOrders.map((v) => (
                  <tr key={v.vehicleId}>
                    <td className="px-3 py-1.5 text-gray-900 font-medium">{v.vehicleId}</td>
                    <td className="px-3 py-1.5 text-gray-700">{v.licensePlate}</td>
                    <td className="px-3 py-1.5 text-center">
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                        {v.conditionCode}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-900">
                      {(ordersByDeliveryNumber.get(v.vehicleId) ?? []).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate button */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={totalVehicles === 0}
          className={`
            px-6 py-3 rounded-md text-sm font-medium transition-colors
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            ${totalVehicles > 0
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-blue-300 text-white cursor-not-allowed'
            }
          `}
        >
          🚀 Generate Fleet Plans
        </button>

        {totalVehicles === 0 && (
          <span className="text-sm text-amber-600">
            No vehicles have assigned orders. Go back to Step 2 to match orders.
          </span>
        )}
      </div>

      {/* Resolution errors if displayed from a previous attempt */}
      {resolutionErrors.length > 0 && (
        <div className="border border-amber-200 rounded-lg p-4 bg-amber-50">
          <h4 className="text-sm font-semibold text-amber-800 mb-2">
            Profile Resolution Errors ({resolutionErrors.length})
          </h4>
          {resolutionErrors.map((err) => (
            <p key={err.vehicleId} className="text-xs text-amber-700">
              Vehicle "{err.vehicleId}": {err.reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Internal Components ─────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs mt-1">{label}</div>
    </div>
  );
}

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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      <span aria-hidden="true">{icons[status]}</span>
      {status}
    </span>
  );
}
