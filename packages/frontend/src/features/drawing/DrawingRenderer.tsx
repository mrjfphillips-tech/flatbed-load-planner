// ─── Drawing Renderer ────────────────────────────────────────────────────────
// Main component that renders all five views of a load plan (top, left side,
// right side, front, rear) with shared interaction state.

import { useMemo } from 'react';
import type { DunnageInsertion, PlacedFreight, SecurementPlan, TrailerProfile } from '@ptv-discovery-coach/shared';
import type { DrawingOptions, DrawingViewType } from './types';
import { DEFAULT_DRAWING_OPTIONS } from './types';
import { TopView, getTopViewBox } from './views/TopView';
import { SideView, getSideViewBox } from './views/SideView';
import { EndView, getEndViewBox } from './views/EndView';
import { useViewBox } from './hooks/useViewBox';
import { useItemHighlight } from './hooks/useItemHighlight';

interface DrawingRendererProps {
  trailer: TrailerProfile;
  placedFreight: PlacedFreight[];
  options?: Partial<DrawingOptions>;
  /** Which views to display (default: all five) */
  visibleViews?: DrawingViewType[];
  /** Securement plans to render when showSecurement is true */
  securementPlans?: SecurementPlan[];
  /** Dunnage insertions to render when showDunnage is true */
  dunnageInsertions?: DunnageInsertion[];
  /** Called when a freight item is clicked in any view */
  onItemSelect?: (itemId: string) => void;
  /** Called when highlighted item changes (hover) */
  onItemHighlight?: (itemId: string | null) => void;
  /** CSS class applied to root container */
  className?: string;
}

const ALL_VIEWS: DrawingViewType[] = ['top', 'left_side', 'right_side', 'front', 'rear'];

const VIEW_LABELS: Record<DrawingViewType, string> = {
  top: 'Top (Plan)',
  left_side: 'Left Side',
  right_side: 'Right Side',
  front: 'Front',
  rear: 'Rear',
};

export function DrawingRenderer({
  trailer,
  placedFreight,
  options: optionOverrides,
  visibleViews = ALL_VIEWS,
  securementPlans,
  dunnageInsertions,
  onItemSelect,
  onItemHighlight,
  className,
}: DrawingRendererProps) {
  const options: DrawingOptions = useMemo(
    () => ({ ...DEFAULT_DRAWING_OPTIONS, ...optionOverrides }),
    [optionOverrides]
  );

  // Cross-view highlighting: hover/select in one view highlights in all views simultaneously
  const {
    effectiveHighlightId,
    onItemHover: handleItemHover,
    onItemSelect: handleItemSelect,
  } = useItemHighlight({
    onHighlightChange: onItemHighlight,
    onSelectionChange: (itemId) => { if (itemId) onItemSelect?.(itemId); },
  });

  const effectiveOptions: DrawingOptions = useMemo(
    () => ({
      ...options,
      highlightedItemId: effectiveHighlightId ?? options.highlightedItemId,
    }),
    [options, effectiveHighlightId]
  );

  const handleItemClick = (itemId: string) => {
    handleItemSelect(itemId);
  };

  // Compute initial viewBoxes for each view type
  const topVB = useMemo(() => getTopViewBox(trailer), [trailer]);
  const sideVB = useMemo(() => getSideViewBox(trailer), [trailer]);
  const endVB = useMemo(() => getEndViewBox(trailer), [trailer]);

  return (
    <div
      className={`flex flex-col gap-4 ${className ?? ''}`}
      data-testid="drawing-renderer"
      role="region"
      aria-label="Load plan drawing views"
    >
      {visibleViews.includes('top') && (
        <ViewPanel label={VIEW_LABELS.top} testId="panel-top">
          <InteractiveView initialViewBox={topVB}>
            {(viewBox) => (
              <TopView
                trailer={trailer}
                placedFreight={placedFreight}
                options={effectiveOptions}
                viewBox={viewBox}
                onItemClick={handleItemClick}
                onItemHover={handleItemHover}
                securementPlans={securementPlans}
                dunnageInsertions={dunnageInsertions}
              />
            )}
          </InteractiveView>
        </ViewPanel>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleViews.includes('left_side') && (
          <ViewPanel label={VIEW_LABELS.left_side} testId="panel-left-side">
            <InteractiveView initialViewBox={sideVB}>
              {(viewBox) => (
                <SideView
                  trailer={trailer}
                  placedFreight={placedFreight}
                  options={effectiveOptions}
                  viewBox={viewBox}
                  side="left"
                  onItemClick={handleItemClick}
                  onItemHover={handleItemHover}
                  securementPlans={securementPlans}
                  dunnageInsertions={dunnageInsertions}
                />
              )}
            </InteractiveView>
          </ViewPanel>
        )}

        {visibleViews.includes('right_side') && (
          <ViewPanel label={VIEW_LABELS.right_side} testId="panel-right-side">
            <InteractiveView initialViewBox={sideVB}>
              {(viewBox) => (
                <SideView
                  trailer={trailer}
                  placedFreight={placedFreight}
                  options={effectiveOptions}
                  viewBox={viewBox}
                  side="right"
                  onItemClick={handleItemClick}
                  onItemHover={handleItemHover}
                  securementPlans={securementPlans}
                  dunnageInsertions={dunnageInsertions}
                />
              )}
            </InteractiveView>
          </ViewPanel>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleViews.includes('front') && (
          <ViewPanel label={VIEW_LABELS.front} testId="panel-front">
            <InteractiveView initialViewBox={endVB}>
              {(viewBox) => (
                <EndView
                  trailer={trailer}
                  placedFreight={placedFreight}
                  options={effectiveOptions}
                  viewBox={viewBox}
                  direction="front"
                  onItemClick={handleItemClick}
                  onItemHover={handleItemHover}
                  securementPlans={securementPlans}
                  dunnageInsertions={dunnageInsertions}
                />
              )}
            </InteractiveView>
          </ViewPanel>
        )}

        {visibleViews.includes('rear') && (
          <ViewPanel label={VIEW_LABELS.rear} testId="panel-rear">
            <InteractiveView initialViewBox={endVB}>
              {(viewBox) => (
                <EndView
                  trailer={trailer}
                  placedFreight={placedFreight}
                  options={effectiveOptions}
                  viewBox={viewBox}
                  direction="rear"
                  onItemClick={handleItemClick}
                  onItemHover={handleItemHover}
                  securementPlans={securementPlans}
                  dunnageInsertions={dunnageInsertions}
                />
              )}
            </InteractiveView>
          </ViewPanel>
        )}
      </div>
    </div>
  );
}

// ─── Internal Components ─────────────────────────────────────────────────────

/** Panel wrapper with label header */
function ViewPanel({ label, testId, children }: { label: string; testId: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded border border-gray-200 bg-white overflow-hidden"
      data-testid={testId}
    >
      <div className="border-b border-gray-100 bg-gray-50 px-3 py-1.5">
        <span className="text-xs font-medium text-gray-600">{label}</span>
      </div>
      <div className="relative h-64 md:h-80">{children}</div>
    </div>
  );
}

/** Wrapper providing zoom/pan interactivity for a view */
function InteractiveView({
  initialViewBox,
  children,
}: {
  initialViewBox: { x: number; y: number; width: number; height: number };
  children: (viewBox: { x: number; y: number; width: number; height: number }) => React.ReactNode;
}) {
  const { viewBox, handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, reset } =
    useViewBox({ initial: initialViewBox });

  return (
    <div
      className="absolute inset-0"
      onWheel={handleWheel as unknown as React.WheelEventHandler<HTMLDivElement>}
      onMouseDown={handleMouseDown as unknown as React.MouseEventHandler<HTMLDivElement>}
      onMouseMove={handleMouseMove as unknown as React.MouseEventHandler<HTMLDivElement>}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {children(viewBox)}
      <button
        onClick={reset}
        className="absolute top-2 right-2 text-xs px-2 py-1 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50"
        aria-label="Reset zoom and pan"
        title="Reset view"
      >
        ⟲
      </button>
    </div>
  );
}
