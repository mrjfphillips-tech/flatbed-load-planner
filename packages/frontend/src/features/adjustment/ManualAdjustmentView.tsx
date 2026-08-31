// ─── Manual Adjustment View ──────────────────────────────────────────────────
// Top-level component that integrates the interactive top-down view with drag-
// and-drop repositioning, orientation toggle, position swap, item removal,
// weight recalculation, rule re-evaluation, and supervisor override handling.
//
// Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { PlacedFreight, RuleResult, TrailerProfile } from '@ptv-discovery-coach/shared';
import { getTopViewBox } from '../drawing/views/TopView';
import { useViewBox } from '../drawing/hooks/useViewBox';
import type { DrawingOptions } from '../drawing/types';
import { DEFAULT_DRAWING_OPTIONS } from '../drawing/types';
import { useAdjustmentStore } from './adjustment-store';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { AdjustmentToolbar } from './components/AdjustmentToolbar';
import { ItemContextMenu } from './components/ItemContextMenu';
import { SupervisorOverrideDialog } from './components/SupervisorOverrideDialog';
import { UnassignedItemsList } from './components/UnassignedItemsList';
import { WarningsSummary } from './components/WarningsSummary';
import type { ManualAdjustmentViewProps } from './types';

export function ManualAdjustmentView({ onPlacementChange, className }: ManualAdjustmentViewProps) {
  const {
    placedFreight,
    unassignedItems,
    mode,
    dragState,
    selectedItemId,
    ruleResults,
    weightMetrics,
    overrides,
    selectItem,
    selectForSwap,
  } = useAdjustmentStore();

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    itemId: string;
    position: { x: number; y: number };
  } | null>(null);

  // Supervisor override dialog state
  const [overrideViolations, setOverrideViolations] = useState<RuleResult[] | null>(null);

  // Previous rule results for detecting new hard constraint violations
  const prevHardViolationsRef = useRef<string[]>([]);

  // Drag and drop hook
  const { svgRef, isDragging, handlePointerDown, handlePointerMove, handlePointerUp, handleKeyDown } =
    useDragAndDrop({ enabled: mode === 'drag' });

  // Access trailer from the adjustment store
  const trailer = useManualAdjustmentTrailer();

  // ViewBox for zoom/pan in the top-down view
  const initialViewBox = useMemo(
    () => (trailer ? getTopViewBox(trailer) : { x: 0, y: 0, width: 1000, height: 200 }),
    [trailer]
  );
  const { viewBox, handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, reset } =
    useViewBox({ initial: initialViewBox });

  // Drawing options for the top-down view
  const drawingOptions: DrawingOptions = useMemo(
    () => ({
      ...DEFAULT_DRAWING_OPTIONS,
      highlightedItemId: selectedItemId ?? undefined,
      showWeightAnnotations: true,
      showDimensions: true,
    }),
    [selectedItemId]
  );

  // Detect new hard constraint violations after any recalculation
  useEffect(() => {
    const currentHardViolations = ruleResults
      .filter((r) => !r.passed && r.ruleType === 'hard_constraint')
      .filter((r) => !overrides.some((o) => o.ruleId === r.ruleId));

    const currentIds = currentHardViolations.map((v) => v.ruleId).sort();
    const prevIds = prevHardViolationsRef.current;

    // Check if there are new violations not previously shown
    const newViolations = currentHardViolations.filter(
      (v) => !prevIds.includes(v.ruleId)
    );

    if (newViolations.length > 0) {
      setOverrideViolations(newViolations);
    }

    prevHardViolationsRef.current = currentIds;
  }, [ruleResults, overrides]);

  // Notify parent of placement changes
  useEffect(() => {
    onPlacementChange?.(placedFreight, unassignedItems);
  }, [placedFreight, unassignedItems, onPlacementChange]);

  // Handle item click depending on current mode
  const handleItemClick = useCallback(
    (itemId: string) => {
      switch (mode) {
        case 'swap':
          selectForSwap(itemId);
          break;
        case 'select':
          selectItem(itemId);
          break;
        case 'drag':
          // In drag mode, clicks (non-drags) select the item for context menu
          selectItem(itemId);
          break;
      }
    },
    [mode, selectForSwap, selectItem]
  );

  // Right-click opens context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, itemId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ itemId, position: { x: e.clientX, y: e.clientY } });
    },
    []
  );

  // Close context menu on outside click
  const handleBackgroundClick = useCallback(() => {
    setContextMenu(null);
    if (mode !== 'swap') {
      selectItem(null);
    }
  }, [mode, selectItem]);

  // Build the visually adjusted freight list (applying current drag offset)
  const visualFreight: PlacedFreight[] = useMemo(() => {
    if (!dragState) return placedFreight;

    const dx = dragState.currentPosition.x - dragState.startPosition.x;
    const dy = dragState.currentPosition.y - dragState.startPosition.y;

    return placedFreight.map((p) => {
      if (p.item.orderNumber === dragState.itemId) {
        return {
          ...p,
          position: {
            ...p.position,
            x: dragState.originalItemPosition.x + dx,
            y: dragState.originalItemPosition.y + dy,
          },
        };
      }
      return p;
    });
  }, [placedFreight, dragState]);

  if (!trailer) {
    return (
      <div className={`p-4 text-sm text-gray-500 ${className ?? ''}`} data-testid="adjustment-no-trailer">
        No trailer configured. Initialize the adjustment store before using this view.
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-3 ${className ?? ''}`}
      data-testid="manual-adjustment-view"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Toolbar: mode selection */}
      <AdjustmentToolbar />

      {/* Main interactive top-down view */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <div
            className="rounded border border-gray-200 bg-white overflow-hidden relative"
            data-testid="adjustment-top-view-panel"
          >
            <div className="border-b border-gray-100 bg-gray-50 px-3 py-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">
                Top View — {mode === 'drag' ? 'Drag to reposition' : mode === 'swap' ? 'Click two items to swap' : 'Click to select'}
              </span>
              <button
                onClick={reset}
                className="text-xs px-2 py-1 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
                aria-label="Reset zoom and pan"
                title="Reset view"
              >
                ⟲
              </button>
            </div>
            <div
              className="relative h-80 md:h-[28rem]"
              onWheel={handleWheel as unknown as React.WheelEventHandler<HTMLDivElement>}
              onMouseDown={handleMouseDown as unknown as React.MouseEventHandler<HTMLDivElement>}
              onMouseMove={handleMouseMove as unknown as React.MouseEventHandler<HTMLDivElement>}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleBackgroundClick}
            >
              <InteractiveTopView
                svgRef={svgRef}
                trailer={trailer}
                placedFreight={visualFreight}
                options={drawingOptions}
                viewBox={viewBox}
                isDragging={isDragging}
                mode={mode}
                dragItemId={dragState?.itemId ?? null}
                selectedItemId={selectedItemId}
                onItemClick={handleItemClick}
                onItemPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onContextMenu={handleContextMenu}
              />
            </div>
          </div>

          {/* Context menu */}
          {contextMenu && (
            <ItemContextMenu
              itemId={contextMenu.itemId}
              position={contextMenu.position}
              onClose={() => setContextMenu(null)}
            />
          )}
        </div>

        {/* Side panel: warnings + unassigned items */}
        <div className="w-72 flex flex-col gap-3 shrink-0">
          {/* Weight summary (compact) */}
          {weightMetrics && (
            <div
              className="border border-gray-200 rounded-lg p-3 bg-white text-xs"
              data-testid="weight-summary-panel"
            >
              <h3 className="font-medium text-gray-700 mb-2">Weight Metrics</h3>
              <dl className="grid grid-cols-2 gap-1">
                <dt className="text-gray-500">Gross:</dt>
                <dd className="text-gray-900 font-medium">{weightMetrics.totalGross.toLocaleString()} lbs</dd>
                <dt className="text-gray-500">Steer:</dt>
                <dd className="text-gray-900">{weightMetrics.steerWeight.toLocaleString()} lbs</dd>
                <dt className="text-gray-500">Drive:</dt>
                <dd className="text-gray-900">{weightMetrics.driveWeight.toLocaleString()} lbs</dd>
                <dt className="text-gray-500">Trailer:</dt>
                <dd className="text-gray-900">{weightMetrics.trailerWeight.toLocaleString()} lbs</dd>
                <dt className="text-gray-500">CG Long.:</dt>
                <dd className="text-gray-900">{weightMetrics.cgLongitudinal.toFixed(1)}"</dd>
                <dt className="text-gray-500">CG Lat.:</dt>
                <dd className="text-gray-900">{weightMetrics.cgLateral.toFixed(1)}"</dd>
              </dl>
            </div>
          )}

          <WarningsSummary />
          <UnassignedItemsList />
        </div>
      </div>

      {/* Supervisor override dialog */}
      {overrideViolations && overrideViolations.length > 0 && (
        <SupervisorOverrideDialog
          violations={overrideViolations}
          onClose={() => setOverrideViolations(null)}
        />
      )}
    </div>
  );
}

// ─── Helper: Access trailer from store config ────────────────────────────────

/**
 * Extracts the trailer profile from the adjustment store state.
 * The trailer is set during initialization.
 */
function useManualAdjustmentTrailer(): TrailerProfile | null {
  return useAdjustmentStore((s) => s._trailer);
}

// ─── Interactive Top View (with pointer events for drag) ─────────────────────

interface InteractiveTopViewProps {
  svgRef: React.RefObject<SVGSVGElement | null>;
  trailer: TrailerProfile;
  placedFreight: PlacedFreight[];
  options: DrawingOptions;
  viewBox: { x: number; y: number; width: number; height: number };
  isDragging: boolean;
  mode: string;
  dragItemId: string | null;
  selectedItemId: string | null;
  onItemClick: (itemId: string) => void;
  onItemPointerDown: (e: React.PointerEvent, itemId: string) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent, itemId: string) => void;
}

function InteractiveTopView({
  svgRef,
  trailer,
  placedFreight,
  options,
  viewBox,
  isDragging,
  mode,
  dragItemId,
  selectedItemId,
  onItemClick,
  onItemPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
}: InteractiveTopViewProps) {
  // We render our own SVG with pointer event handlers wrapping the TopView content
  const deckLength = trailer.lengthFt * 12;
  const deckWidth = trailer.deckWidthIn;

  return (
    <svg
      ref={svgRef as RefObject<SVGSVGElement>}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      className={`w-full h-full ${isDragging ? 'cursor-grabbing' : mode === 'drag' ? 'cursor-grab' : 'cursor-pointer'}`}
      role="img"
      aria-label="Interactive top-down view for manual load adjustment"
      data-testid="adjustment-svg"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <title>Manual Adjustment — Top-Down View</title>

      {/* Deck outline */}
      <rect
        x={0}
        y={-deckWidth / 2}
        width={deckLength}
        height={deckWidth}
        fill="#f9fafb"
        stroke="#374151"
        strokeWidth={2}
        data-testid="deck-outline"
      />

      {/* Kingpin marker */}
      <circle cx={0} cy={0} r={6} fill="#1f2937" stroke="#000" strokeWidth={1} />
      <text x={0} y={-12} textAnchor="middle" fontSize={8} fill="#374151">
        Kingpin
      </text>

      {/* Axle positions */}
      {trailer.axlePositions.map((pos, idx) => (
        <g key={`axle-${idx}`}>
          <line
            x1={pos}
            y1={-deckWidth / 2 - 8}
            x2={pos}
            y2={deckWidth / 2 + 8}
            stroke="#6b7280"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* Freight items with interaction handlers */}
      {placedFreight.map((placed) => {
        const itemId = placed.item.orderNumber;
        const isSelected = selectedItemId === itemId;
        const isBeingDragged = dragItemId === itemId;
        const isHighlighted = options.highlightedItemId === itemId;

        // Calculate rect based on orientation
        const { boundingBox } = placed.geometry;
        const isTransverse = placed.orientation === 'transverse';
        const rectW = isTransverse ? boundingBox.width : boundingBox.length;
        const rectH = isTransverse ? boundingBox.length : boundingBox.width;
        const rx = placed.position.x;
        const ry = placed.position.y;

        const strokeColor = isSelected || isHighlighted ? '#2563eb' : isBeingDragged ? '#f59e0b' : '#374151';
        const strokeW = isSelected || isHighlighted || isBeingDragged ? 2.5 : 1;
        const fillOpacity = isBeingDragged ? 0.6 : 0.85;

        return (
          <g
            key={itemId}
            data-testid={`adjustment-item-${itemId}`}
            className={mode === 'drag' ? 'cursor-grab' : 'cursor-pointer'}
            onPointerDown={(e) => onItemPointerDown(e, itemId)}
            onClick={(e) => { e.stopPropagation(); onItemClick(itemId); }}
            onContextMenu={(e) => onContextMenu(e as unknown as React.MouseEvent, itemId)}
          >
            <rect
              x={rx}
              y={ry}
              width={rectW}
              height={rectH}
              fill={isSelected ? '#bfdbfe' : '#93c5fd'}
              fillOpacity={fillOpacity}
              stroke={strokeColor}
              strokeWidth={strokeW}
              strokeDasharray={isBeingDragged ? '4 2' : undefined}
            />
            {/* Item label */}
            <text
              x={rx + rectW / 2}
              y={ry + rectH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.min(10, rectW / 6)}
              fill="#1e293b"
              pointerEvents="none"
            >
              {itemId}
            </text>
            {/* Weight annotation */}
            {options.showWeightAnnotations && (
              <text
                x={rx + rectW / 2}
                y={ry + rectH / 2 + 10}
                textAnchor="middle"
                fontSize={7}
                fill="#475569"
                pointerEvents="none"
              >
                {placed.item.totalLineWeight.toLocaleString()} lbs
              </text>
            )}
            {/* Orientation indicator */}
            <text
              x={rx + 3}
              y={ry + 10}
              fontSize={7}
              fill="#64748b"
              pointerEvents="none"
            >
              {placed.orientation === 'longitudinal' ? '→' : '↓'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
