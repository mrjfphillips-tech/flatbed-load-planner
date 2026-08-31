// ─── Securement Overlay ──────────────────────────────────────────────────────
// Renders tie-down positions, chain/strap routing lines, and anchor point
// assignments as an SVG overlay on top of existing drawing views.

import type { SecurementPlan, TieDown, TrailerProfile, PlacedFreight } from '@ptv-discovery-coach/shared';

/** Securement type visual styling */
const SECUREMENT_STYLES: Record<string, { color: string; dashArray?: string; label: string }> = {
  chain: { color: '#b45309', label: 'Chain' },
  strap: { color: '#0369a1', dashArray: '4 2', label: 'Strap' },
  binder: { color: '#7c2d12', label: 'Binder' },
  edge_protector: { color: '#6d28d9', dashArray: '2 2', label: 'EP' },
  coil_rack: { color: '#065f46', label: 'Rack' },
  chock: { color: '#92400e', label: 'Chock' },
  blocking: { color: '#1e3a5f', label: 'Block' },
};

export interface SecurementOverlayProps {
  /** Securement plans for all placed items */
  securementPlans: SecurementPlan[];
  /** Trailer profile (for anchor point positions) */
  trailer: TrailerProfile;
  /** Placed freight (for item positions to draw routing lines) */
  placedFreight: PlacedFreight[];
  /** Currently highlighted item (only show securement for highlighted, or all if none) */
  highlightedItemId?: string;
  /** The view type to adapt rendering */
  viewType: 'top' | 'side' | 'end';
}

/**
 * Renders the securement overlay showing tie-down positions, routing lines
 * from tie-down to anchor point, and anchor point assignments.
 */
export function SecurementOverlay({
  securementPlans,
  trailer,
  placedFreight,
  highlightedItemId,
  viewType,
}: SecurementOverlayProps) {
  // Filter plans based on highlighted item (show all if none highlighted)
  const visiblePlans = highlightedItemId
    ? securementPlans.filter((p) => p.itemOrderNumber === highlightedItemId)
    : securementPlans;

  return (
    <g
      className="securement-overlay pointer-events-none"
      data-testid="securement-overlay"
      aria-label="Securement overlay showing tie-down positions and routing"
    >
      {/* Highlight assigned anchor points */}
      {viewType === 'top' && (
        <g data-testid="anchor-highlights">
          {getUsedAnchorPoints(visiblePlans, trailer).map((ap, idx) => (
            <g key={`anchor-used-${idx}`}>
              <circle
                cx={ap.x}
                cy={ap.y}
                r={5}
                fill="#059669"
                fillOpacity={0.3}
                stroke="#059669"
                strokeWidth={2}
              />
              <circle
                cx={ap.x}
                cy={ap.y}
                r={2}
                fill="#059669"
              />
            </g>
          ))}
        </g>
      )}

      {/* Render tie-downs and routing for each visible plan */}
      {visiblePlans.map((plan) => (
        <SecurementPlanGroup
          key={plan.itemOrderNumber}
          plan={plan}
          trailer={trailer}
          placedFreight={placedFreight}
          viewType={viewType}
        />
      ))}
    </g>
  );
}

/** Renders securement elements for a single item's plan */
function SecurementPlanGroup({
  plan,
  trailer,
  placedFreight,
  viewType,
}: {
  plan: SecurementPlan;
  trailer: TrailerProfile;
  placedFreight: PlacedFreight[];
  viewType: 'top' | 'side' | 'end';
}) {
  const item = placedFreight.find((f) => f.item.orderNumber === plan.itemOrderNumber);
  if (!item) return null;

  return (
    <g data-testid={`securement-plan-${plan.itemOrderNumber}`}>
      {/* Tie-down markers and routing lines */}
      {plan.tieDowns.map((tieDown, idx) => (
        <TieDownMarker
          key={`td-${plan.itemOrderNumber}-${idx}`}
          tieDown={tieDown}
          trailer={trailer}
          itemPosition={item.position}
          viewType={viewType}
          index={idx}
        />
      ))}

      {/* Additional securement indicators */}
      {plan.additionalSecurement.map((type, idx) => (
        <AdditionalSecurementMarker
          key={`addl-${plan.itemOrderNumber}-${idx}`}
          type={type}
          itemPosition={item.position}
          itemGeometry={item.geometry.boundingBox}
          viewType={viewType}
          index={idx}
        />
      ))}
    </g>
  );
}

/** Renders a single tie-down marker with routing line to its anchor point */
function TieDownMarker({
  tieDown,
  trailer,
  itemPosition,
  viewType,
  index,
}: {
  tieDown: TieDown;
  trailer: TrailerProfile;
  itemPosition: { x: number; y: number; z: number };
  viewType: 'top' | 'side' | 'end';
  index: number;
}) {
  const style = SECUREMENT_STYLES[tieDown.type] ?? SECUREMENT_STYLES.strap;

  // Tie-down position on the item
  const tdX = tieDown.position.x;
  const tdY = tieDown.position.y;

  // Find the anchor point this tie-down is assigned to
  const anchorPoint = getAnchorPointById(tieDown.anchorPointId, trailer);

  if (viewType === 'top') {
    return (
      <g data-testid={`tiedown-${index}`}>
        {/* Routing line from tie-down position to anchor point */}
        {anchorPoint && (
          <line
            x1={tdX}
            y1={tdY}
            x2={anchorPoint.x}
            y2={anchorPoint.y}
            stroke={style.color}
            strokeWidth={1.5}
            strokeDasharray={style.dashArray}
            strokeOpacity={0.7}
          />
        )}

        {/* Tie-down position marker */}
        <g>
          <rect
            x={tdX - 4}
            y={tdY - 4}
            width={8}
            height={8}
            fill={style.color}
            fillOpacity={0.6}
            stroke={style.color}
            strokeWidth={1}
            rx={1}
          />
          <text
            x={tdX}
            y={tdY + 12}
            textAnchor="middle"
            fontSize={5}
            fill={style.color}
            fontWeight="bold"
          >
            {style.label}
          </text>
        </g>
      </g>
    );
  }

  if (viewType === 'side') {
    // In side view, show tie-down at x position, z (height) of item top
    const svgY = -(itemPosition.z + 4); // slightly above item
    return (
      <g data-testid={`tiedown-side-${index}`}>
        {/* Vertical line from item to deck */}
        <line
          x1={tdX}
          y1={svgY}
          x2={tdX}
          y2={0}
          stroke={style.color}
          strokeWidth={1.2}
          strokeDasharray={style.dashArray}
          strokeOpacity={0.6}
        />
        {/* Tie-down marker */}
        <polygon
          points={`${tdX},${svgY} ${tdX - 3},${svgY - 6} ${tdX + 3},${svgY - 6}`}
          fill={style.color}
          fillOpacity={0.7}
        />
      </g>
    );
  }

  // End view: show tie-down at lateral position
  const lateralPos = tdY;
  const svgY = -(itemPosition.z + 4);
  return (
    <g data-testid={`tiedown-end-${index}`}>
      <line
        x1={lateralPos}
        y1={svgY}
        x2={lateralPos}
        y2={0}
        stroke={style.color}
        strokeWidth={1.2}
        strokeDasharray={style.dashArray}
        strokeOpacity={0.6}
      />
      <circle
        cx={lateralPos}
        cy={svgY}
        r={3}
        fill={style.color}
        fillOpacity={0.7}
      />
    </g>
  );
}

/** Renders additional securement indicators (edge protectors, chocks, etc.) */
function AdditionalSecurementMarker({
  type,
  itemPosition,
  itemGeometry,
  viewType,
  index,
}: {
  type: string;
  itemPosition: { x: number; y: number; z: number };
  itemGeometry: { length: number; width: number; height: number };
  viewType: 'top' | 'side' | 'end';
  index: number;
}) {
  const style = SECUREMENT_STYLES[type] ?? SECUREMENT_STYLES.blocking;

  if (viewType === 'top') {
    // Show small icon at item corners for edge protectors, or center for blocking/chocks
    const cx = itemPosition.x + itemGeometry.length / 2;
    const cy = itemPosition.y + itemGeometry.width / 2;

    if (type === 'edge_protector') {
      // Show at four corners
      return (
        <g data-testid={`additional-securement-${index}`}>
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy], cornerIdx) => (
            <rect
              key={cornerIdx}
              x={itemPosition.x + (dx > 0 ? itemGeometry.length - 6 : 0)}
              y={itemPosition.y + (dy > 0 ? itemGeometry.width - 3 : 0)}
              width={6}
              height={3}
              fill={style.color}
              fillOpacity={0.5}
              rx={1}
            />
          ))}
        </g>
      );
    }

    // Chocks and blocking: single marker at center
    return (
      <g data-testid={`additional-securement-${index}`}>
        <rect
          x={cx - 5}
          y={cy - 5}
          width={10}
          height={10}
          fill="none"
          stroke={style.color}
          strokeWidth={1.5}
          strokeDasharray="2 1"
        />
        <text
          x={cx}
          y={cy + 15}
          textAnchor="middle"
          fontSize={5}
          fill={style.color}
        >
          {style.label}
        </text>
      </g>
    );
  }

  // Side/end views: simplified indicator
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve an anchor point ID (e.g. "anchor-3") to its Position2D */
function getAnchorPointById(
  anchorPointId: string | undefined,
  trailer: TrailerProfile
): { x: number; y: number } | null {
  if (!anchorPointId) return null;
  const match = anchorPointId.match(/anchor-(\d+)/);
  if (!match) return null;
  const idx = parseInt(match[1], 10);
  return trailer.anchorPoints[idx] ?? null;
}

/** Get all anchor points that are actually used by visible plans */
function getUsedAnchorPoints(
  plans: SecurementPlan[],
  trailer: TrailerProfile
): { x: number; y: number }[] {
  const usedPoints: { x: number; y: number }[] = [];
  const seen = new Set<string>();

  for (const plan of plans) {
    for (const tieDown of plan.tieDowns) {
      if (tieDown.anchorPointId && !seen.has(tieDown.anchorPointId)) {
        seen.add(tieDown.anchorPointId);
        const point = getAnchorPointById(tieDown.anchorPointId, trailer);
        if (point) usedPoints.push(point);
      }
    }
  }

  return usedPoints;
}
