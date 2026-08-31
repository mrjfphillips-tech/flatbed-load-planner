// ─── Multi-Load Manual Reassignment Component ───────────────────────────────
// Allows planners to drag/select items and move them between trailers in a
// multi-load set. Displays weight metrics per trailer and highlights changes.

import { useCallback, useMemo, useState } from 'react';
import type { PlacedFreight, TrailerLoadState, WeightMetrics } from '@ptv-discovery-coach/shared';
import { useMultiLoadStore } from '../multi-load-store';

// ─── Sub-components ──────────────────────────────────────────────────────────

interface TrailerTabProps {
  trailerState: TrailerLoadState;
  isActive: boolean;
  onSelect: () => void;
  canApprove: boolean;
}

/** Tab button for switching between trailers */
function TrailerTab({ trailerState, isActive, onSelect, canApprove }: TrailerTabProps) {
  const itemCount = trailerState.placedFreight.length;
  const totalWeight = trailerState.placedFreight.reduce(
    (sum, pf) => sum + pf.item.pieceWeight * pf.item.quantity,
    0
  );

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`px-4 py-2 rounded-t-md text-sm font-medium border-b-2 transition-colors ${
        isActive
          ? 'border-blue-600 bg-white text-blue-700'
          : 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
      aria-selected={isActive}
      role="tab"
    >
      <span className="block">Trailer {trailerState.trailerIndex + 1}</span>
      <span className="text-xs text-gray-500">
        {itemCount} items • {(totalWeight / 1000).toFixed(1)}k lbs
      </span>
      {!canApprove && (
        <span className="ml-1 inline-block w-2 h-2 rounded-full bg-red-500" title="Has violations" />
      )}
    </button>
  );
}

interface WeightMetricsPanelProps {
  metrics: WeightMetrics;
}

/** Displays weight metrics for a single trailer */
function WeightMetricsPanel({ metrics }: WeightMetricsPanelProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-gray-50 rounded-md text-sm">
      <div>
        <span className="text-gray-500 text-xs block">Total Gross</span>
        <span className="font-medium">{metrics.totalGross.toLocaleString()} lbs</span>
      </div>
      <div>
        <span className="text-gray-500 text-xs block">Steer Axle</span>
        <span className={`font-medium ${metrics.axleUtilization.steer > 100 ? 'text-red-600' : metrics.axleUtilization.steer > 95 ? 'text-amber-600' : ''}`}>
          {metrics.steerWeight.toLocaleString()} lbs ({metrics.axleUtilization.steer.toFixed(1)}%)
        </span>
      </div>
      <div>
        <span className="text-gray-500 text-xs block">Drive Axle</span>
        <span className={`font-medium ${metrics.axleUtilization.drive > 100 ? 'text-red-600' : metrics.axleUtilization.drive > 95 ? 'text-amber-600' : ''}`}>
          {metrics.driveWeight.toLocaleString()} lbs ({metrics.axleUtilization.drive.toFixed(1)}%)
        </span>
      </div>
      <div>
        <span className="text-gray-500 text-xs block">Trailer Axle</span>
        <span className={`font-medium ${metrics.axleUtilization.trailer > 100 ? 'text-red-600' : metrics.axleUtilization.trailer > 95 ? 'text-amber-600' : ''}`}>
          {metrics.trailerWeight.toLocaleString()} lbs ({metrics.axleUtilization.trailer.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}

interface FreightItemRowProps {
  freight: PlacedFreight;
  isSelected: boolean;
  onSelect: () => void;
  onReassign: (destinationTrailerIndex: number) => void;
  availableTrailers: number[];
  currentTrailerIndex: number;
}

/** Row representing a single freight item with reassignment controls */
function FreightItemRow({
  freight,
  isSelected,
  onSelect,
  onReassign,
  availableTrailers,
  currentTrailerIndex,
}: FreightItemRowProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded border transition-colors cursor-pointer ${
        isSelected ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
      }`}
      onClick={onSelect}
      role="listitem"
      aria-selected={isSelected}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs bg-gray-200 px-1.5 py-0.5 rounded">
            {freight.item.orderNumber}
          </span>
          <span className="text-sm truncate">{freight.item.productType.replace(/_/g, ' ')}</span>
          <span className="text-xs text-gray-500">Stop {freight.item.deliveryStop}</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {(freight.item.pieceWeight * freight.item.quantity).toLocaleString()} lbs •{' '}
          {freight.item.dimensions.length}"×{freight.item.dimensions.width}"
        </div>
      </div>

      <div className="relative ml-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowDropdown(!showDropdown);
          }}
          className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100"
          aria-label={`Move item ${freight.item.orderNumber} to another trailer`}
        >
          Move →
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-lg z-10 min-w-[140px]">
            {availableTrailers
              .filter((idx) => idx !== currentTrailerIndex)
              .map((idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReassign(idx);
                    setShowDropdown(false);
                  }}
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50"
                >
                  Trailer {idx + 1}
                </button>
              ))}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReassign(-1);
                setShowDropdown(false);
              }}
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-amber-50 text-amber-700 border-t"
            >
              Unassign
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export interface MultiLoadReassignmentProps {
  /** CSS class for the root container */
  className?: string;
  /** Called when any reassignment occurs */
  onReassignmentChange?: () => void;
}

/**
 * Multi-load manual reassignment interface.
 *
 * Allows planners to:
 * - View items on each trailer in the multi-load set
 * - Move items between trailers using dropdown controls
 * - See updated weight metrics immediately after reassignment
 * - View unassigned items and assign them to any trailer
 */
export function MultiLoadReassignment({ className, onReassignmentChange }: MultiLoadReassignmentProps) {
  const {
    trailers,
    unassignedItems,
    activeTrailerIndex,
    summary,
    canApproveByTrailer,
    lastError,
    setActiveTrailer,
    reassignItemToTrailer,
    assignItem,
    clearError,
  } = useMultiLoadStore();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const activeTrailer = useMemo(
    () => trailers.find((t) => t.trailerIndex === activeTrailerIndex),
    [trailers, activeTrailerIndex]
  );

  const availableTrailerIndices = useMemo(
    () => trailers.map((t) => t.trailerIndex),
    [trailers]
  );

  const handleReassign = useCallback(
    (itemId: string, sourceIndex: number, destIndex: number) => {
      reassignItemToTrailer(itemId, sourceIndex, destIndex);
      setSelectedItemId(null);
      onReassignmentChange?.();
    },
    [reassignItemToTrailer, onReassignmentChange]
  );

  const handleAssignFromPool = useCallback(
    (itemId: string, destIndex: number) => {
      assignItem(itemId, destIndex);
      setSelectedItemId(null);
      onReassignmentChange?.();
    },
    [assignItem, onReassignmentChange]
  );

  if (trailers.length === 0) {
    return (
      <div className={className}>
        <p className="text-gray-500 text-sm p-4">No multi-load plan available.</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className ?? ''}`}>
      {/* Error display */}
      {lastError && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded px-3 py-2 text-sm text-red-700">
          <span>{lastError}</span>
          <button type="button" onClick={clearError} className="text-red-400 hover:text-red-600">
            ✕
          </button>
        </div>
      )}

      {/* Summary bar */}
      {summary && (
        <div className="flex items-center gap-4 text-sm px-1">
          <span className="text-gray-600">
            {summary.trailerCount} trailers • {summary.totalFreightWeight.toLocaleString()} lbs total
          </span>
          {!summary.stopIntegrityPreserved && (
            <span className="text-amber-600 text-xs">
              ⚠ Stops {summary.splitStops.join(', ')} split across trailers
            </span>
          )}
          {unassignedItems.length > 0 && (
            <span className="text-amber-600 text-xs">
              {unassignedItems.length} unassigned item{unassignedItems.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Trailer tabs */}
      <div className="flex gap-1 border-b border-gray-200" role="tablist" aria-label="Trailer selection">
        {trailers.map((t) => (
          <TrailerTab
            key={t.trailerIndex}
            trailerState={t}
            isActive={t.trailerIndex === activeTrailerIndex}
            onSelect={() => setActiveTrailer(t.trailerIndex)}
            canApprove={canApproveByTrailer.get(t.trailerIndex) ?? true}
          />
        ))}
      </div>

      {/* Active trailer content */}
      {activeTrailer && (
        <div className="flex flex-col gap-3">
          {/* Weight metrics */}
          <WeightMetricsPanel metrics={activeTrailer.weightMetrics} />

          {/* Items list */}
          <div className="flex flex-col gap-1.5" role="list" aria-label={`Items on trailer ${activeTrailerIndex + 1}`}>
            {activeTrailer.placedFreight.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No items on this trailer.</p>
            ) : (
              activeTrailer.placedFreight.map((pf) => (
                <FreightItemRow
                  key={pf.item.orderNumber}
                  freight={pf}
                  isSelected={selectedItemId === pf.item.orderNumber}
                  onSelect={() => setSelectedItemId(pf.item.orderNumber)}
                  onReassign={(destIdx) =>
                    handleReassign(pf.item.orderNumber, activeTrailerIndex, destIdx)
                  }
                  availableTrailers={availableTrailerIndices}
                  currentTrailerIndex={activeTrailerIndex}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Unassigned items pool */}
      {unassignedItems.length > 0 && (
        <div className="border-t border-gray-200 pt-3">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Unassigned Items ({unassignedItems.length})
          </h3>
          <div className="flex flex-col gap-1.5" role="list" aria-label="Unassigned items">
            {unassignedItems.map((pf) => (
              <FreightItemRow
                key={pf.item.orderNumber}
                freight={pf}
                isSelected={selectedItemId === pf.item.orderNumber}
                onSelect={() => setSelectedItemId(pf.item.orderNumber)}
                onReassign={(destIdx) => handleAssignFromPool(pf.item.orderNumber, destIdx)}
                availableTrailers={availableTrailerIndices}
                currentTrailerIndex={-1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
