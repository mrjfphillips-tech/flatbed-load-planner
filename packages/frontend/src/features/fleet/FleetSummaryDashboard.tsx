// ─── Fleet Summary Dashboard ─────────────────────────────────────────────────
// Displays fleet-level results after batch generation: a summary row of totals
// and a vehicle table/card grid. Clicking a vehicle selects it for detail view.
//
// Requirements: 5.1, 4.5

import { useFleetStore } from './fleet-store';
import type { VehiclePlanEntry, FleetPlanResult } from './types';

// ─── Component ───────────────────────────────────────────────────────────────

export function FleetSummaryDashboard() {
  const fleetPlanResult = useFleetStore((s) => s.fleetPlanResult);
  const selectedVehicleId = useFleetStore((s) => s.selectedVehicleId);
  const selectVehicle = useFleetStore((s) => s.selectVehicle);

  if (!fleetPlanResult) {
    return (
      <div className="p-6 text-center text-gray-500">
        No fleet plan results available. Generate plans first.
      </div>
    );
  }

  const { vehicles, summary, unmatchedOrders } = fleetPlanResult;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Fleet Summary</h2>
        <p className="mt-1 text-sm text-gray-600">
          Overview of all vehicle plan results. Click a vehicle to view its detailed load plan.
        </p>
      </div>

      {/* Fleet-level totals */}
      <FleetTotals summary={summary} />

      {/* Orders placed/unplaced */}
      <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <span className="text-gray-500">Orders Placed:</span>{' '}
            <span className="font-semibold text-gray-900">{summary.totalOrdersPlaced}</span>
          </div>
          <div>
            <span className="text-gray-500">Orders Unplaced:</span>{' '}
            <span className="font-semibold text-gray-900">{summary.totalOrdersUnplaced}</span>
          </div>
          {unmatchedOrders.length > 0 && (
            <div>
              <span className="text-gray-500">Unmatched Orders:</span>{' '}
              <span className="font-semibold text-amber-700">{unmatchedOrders.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* Vehicle results table */}
      <VehicleTable
        vehicles={vehicles}
        selectedVehicleId={selectedVehicleId}
        onSelectVehicle={selectVehicle}
      />
    </div>
  );
}

// ─── Fleet Totals ────────────────────────────────────────────────────────────

function FleetTotals({ summary }: { summary: FleetPlanResult['summary'] }) {
  return (
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
  );
}

// ─── Vehicle Results Table ───────────────────────────────────────────────────

function VehicleTable({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
}: {
  vehicles: VehiclePlanEntry[];
  selectedVehicleId: string | null;
  onSelectVehicle: (vehicleId: string) => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">
          Vehicle Results ({vehicles.length})
        </span>
      </div>
      <div className="max-h-96 overflow-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Vehicle ID</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">License Plate</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Condition</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Status</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Orders</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Total Weight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vehicles.map((entry) => {
              const isSelected = entry.vehicleId === selectedVehicleId;
              const totalWeight = computeTotalWeight(entry);

              return (
                <tr
                  key={entry.vehicleId}
                  onClick={() => onSelectVehicle(entry.vehicleId)}
                  className={`
                    cursor-pointer transition-colors
                    ${isSelected
                      ? 'bg-blue-50 hover:bg-blue-100'
                      : 'hover:bg-gray-50'
                    }
                  `}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select vehicle ${entry.vehicleId}`}
                  aria-selected={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectVehicle(entry.vehicleId);
                    }
                  }}
                >
                  <td className="px-3 py-2 text-gray-900 font-medium">{entry.vehicleId}</td>
                  <td className="px-3 py-2 text-gray-700">{entry.licensePlate}</td>
                  <td className="px-3 py-2 text-gray-700">{entry.vehicleType}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                      {entry.conditionCode}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {entry.assignedOrders.length}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {formatWeight(totalWeight)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Helper Components ───────────────────────────────────────────────────────

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
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
    >
      <span aria-hidden="true">{icons[status]}</span>
      {status}
    </span>
  );
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Compute total weight (in lbs) for a vehicle's assigned orders.
 */
function computeTotalWeight(entry: VehiclePlanEntry): number {
  return entry.assignedOrders.reduce((sum, order) => sum + order.totalLineWeight, 0);
}

/**
 * Format weight for display — shows in lbs with thousands separator.
 */
function formatWeight(weightLbs: number): string {
  if (weightLbs === 0) return '—';
  return `${weightLbs.toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs`;
}
