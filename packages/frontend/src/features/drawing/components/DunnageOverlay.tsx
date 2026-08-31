// ─── Dunnage Overlay ─────────────────────────────────────────────────────────
// Renders dunnage material positions, dimensions, and types as an SVG overlay
// on top of existing drawing views. Shows where dunnage is placed between items
// or between items and the deck.

import type { DunnageInsertion, PlacedFreight } from '@ptv-discovery-coach/shared';

/** Visual styling for dunnage material types */
const DUNNAGE_STYLES: Record<string, { color: string; pattern: string; label: string }> = {
  wood: { color: '#92400e', pattern: 'crosshatch', label: 'Wood' },
  rubber: { color: '#1f2937', pattern: 'dots', label: 'Rubber' },
  plastic: { color: '#0369a1', pattern: 'diagonal', label: 'Plastic' },
};

export interface DunnageOverlayProps {
  /** Dunnage insertion records from stacking rule evaluation */
  dunnageInsertions: DunnageInsertion[];
  /** Placed freight (for resolving item positions) */
  placedFreight: PlacedFreight[];
  /** Currently highlighted item (filter dunnage display) */
  highlightedItemId?: string;
  /** The view type to adapt rendering */
  viewType: 'top' | 'side' | 'end';
}

/**
 * Renders the dunnage overlay showing material positions, dimensions, and types.
 * Dunnage is shown as hatched rectangles between the upper and lower items.
 */
export function DunnageOverlay({
  dunnageInsertions,
  placedFreight,
  highlightedItemId,
  viewType,
}: DunnageOverlayProps) {
  // Filter dunnage based on highlighted item (show all if none highlighted)
  const visibleDunnage = highlightedItemId
    ? dunnageInsertions.filter(
        (d) => d.upperItemOrder === highlightedItemId || d.lowerItemOrder === highlightedItemId
      )
    : dunnageInsertions;

  if (visibleDunnage.length === 0) return null;

  return (
    <g
      className="dunnage-overlay pointer-events-none"
      data-testid="dunnage-overlay"
      aria-label="Dunnage overlay showing material positions and types"
    >
      {/* SVG pattern definitions for dunnage materials */}
      <defs>
        <pattern
          id="dunnage-pattern-wood"
          patternUnits="userSpaceOnUse"
          width={6}
          height={6}
        >
          <line x1={0} y1={0} x2={6} y2={6} stroke="#92400e" strokeWidth={0.5} />
          <line x1={6} y1={0} x2={0} y2={6} stroke="#92400e" strokeWidth={0.5} />
        </pattern>
        <pattern
          id="dunnage-pattern-rubber"
          patternUnits="userSpaceOnUse"
          width={4}
          height={4}
        >
          <circle cx={2} cy={2} r={0.8} fill="#1f2937" />
        </pattern>
        <pattern
          id="dunnage-pattern-plastic"
          patternUnits="userSpaceOnUse"
          width={5}
          height={5}
        >
          <line x1={0} y1={5} x2={5} y2={0} stroke="#0369a1" strokeWidth={0.5} />
        </pattern>
      </defs>

      {/* Render each dunnage insertion */}
      {visibleDunnage.map((insertion, idx) => (
        <DunnageMarker
          key={`dunnage-${idx}`}
          insertion={insertion}
          placedFreight={placedFreight}
          viewType={viewType}
          index={idx}
        />
      ))}
    </g>
  );
}

/** Renders a single dunnage insertion between two items */
function DunnageMarker({
  insertion,
  placedFreight,
  viewType,
  index,
}: {
  insertion: DunnageInsertion;
  placedFreight: PlacedFreight[];
  viewType: 'top' | 'side' | 'end';
  index: number;
}) {
  const lowerItem = placedFreight.find((f) => f.item.orderNumber === insertion.lowerItemOrder);
  const upperItem = placedFreight.find((f) => f.item.orderNumber === insertion.upperItemOrder);

  if (!lowerItem || !upperItem) return null;

  const style = DUNNAGE_STYLES[insertion.dunnageMaterial] ?? DUNNAGE_STYLES.wood;
  const patternId = `dunnage-pattern-${insertion.dunnageMaterial}`;
  const thickness = insertion.dunnageThicknessIn;

  if (viewType === 'top') {
    return renderTopDunnage(lowerItem, upperItem, thickness, style, patternId, index);
  }

  if (viewType === 'side') {
    return renderSideDunnage(lowerItem, upperItem, thickness, style, patternId, index);
  }

  // End view
  return renderEndDunnage(lowerItem, upperItem, thickness, style, patternId, index);
}

/** Render dunnage in top-down view — shown as a hatched rectangle at the overlap area */
function renderTopDunnage(
  lowerItem: PlacedFreight,
  upperItem: PlacedFreight,
  thickness: number,
  style: { color: string; label: string },
  patternId: string,
  index: number
) {
  // Calculate the overlap rectangle in top view
  const lowerBB = lowerItem.geometry.boundingBox;
  const upperBB = upperItem.geometry.boundingBox;

  const lowerIsTransverse = lowerItem.orientation === 'transverse';
  const upperIsTransverse = upperItem.orientation === 'transverse';

  const lowerWidth = lowerIsTransverse ? lowerBB.width : lowerBB.length;
  const lowerHeight = lowerIsTransverse ? lowerBB.length : lowerBB.width;
  const upperWidth = upperIsTransverse ? upperBB.width : upperBB.length;
  const upperHeight = upperIsTransverse ? upperBB.length : upperBB.width;

  // Overlap area between upper and lower item footprints
  const overlapX = Math.max(lowerItem.position.x, upperItem.position.x);
  const overlapY = Math.max(lowerItem.position.y, upperItem.position.y);
  const overlapRight = Math.min(
    lowerItem.position.x + lowerWidth,
    upperItem.position.x + upperWidth
  );
  const overlapBottom = Math.min(
    lowerItem.position.y + lowerHeight,
    upperItem.position.y + upperHeight
  );

  const width = Math.max(overlapRight - overlapX, upperWidth * 0.8);
  const height = Math.max(overlapBottom - overlapY, upperHeight * 0.8);

  // Position dunnage at the upper item's footprint if overlap is degenerate
  const x = width > 0 ? overlapX : upperItem.position.x;
  const y = height > 0 ? overlapY : upperItem.position.y;
  const finalWidth = width > 0 ? width : upperWidth;
  const finalHeight = height > 0 ? height : upperHeight;

  return (
    <g data-testid={`dunnage-item-${index}`}>
      {/* Dunnage rectangle with pattern fill */}
      <rect
        x={x}
        y={y}
        width={finalWidth}
        height={finalHeight}
        fill={`url(#${patternId})`}
        stroke={style.color}
        strokeWidth={1}
        strokeDasharray="3 2"
        opacity={0.6}
      />
      {/* Dimension annotation */}
      <text
        x={x + finalWidth / 2}
        y={y + finalHeight + 10}
        textAnchor="middle"
        fontSize={5}
        fill={style.color}
        fontWeight="bold"
      >
        {style.label} {thickness}"
      </text>
    </g>
  );
}

/** Render dunnage in side elevation view — shown as a thin bar between items */
function renderSideDunnage(
  lowerItem: PlacedFreight,
  _upperItem: PlacedFreight,
  thickness: number,
  style: { color: string; label: string },
  patternId: string,
  index: number
) {
  const lowerBB = lowerItem.geometry.boundingBox;
  const lowerIsTransverse = lowerItem.orientation === 'transverse';
  const lowerLength = lowerIsTransverse ? lowerBB.width : lowerBB.length;

  // Dunnage sits on top of lower item
  const x = lowerItem.position.x;
  const z = lowerItem.position.z + lowerBB.height; // top of lower item
  const width = lowerLength;

  // SVG y-axis is inverted (positive down)
  const svgY = -(z + thickness);

  return (
    <g data-testid={`dunnage-side-${index}`}>
      <rect
        x={x}
        y={svgY}
        width={width}
        height={thickness}
        fill={`url(#${patternId})`}
        stroke={style.color}
        strokeWidth={1}
        opacity={0.7}
      />
      {/* Label */}
      <text
        x={x + width + 4}
        y={svgY + thickness / 2}
        dominantBaseline="central"
        fontSize={5}
        fill={style.color}
      >
        {style.label} {thickness}"
      </text>
    </g>
  );
}

/** Render dunnage in end (front/rear) view — shown as a thin horizontal bar */
function renderEndDunnage(
  lowerItem: PlacedFreight,
  _upperItem: PlacedFreight,
  thickness: number,
  style: { color: string; label: string },
  patternId: string,
  index: number
) {
  const lowerBB = lowerItem.geometry.boundingBox;
  const lowerIsTransverse = lowerItem.orientation === 'transverse';
  const lowerWidth = lowerIsTransverse ? lowerBB.length : lowerBB.width;

  // Dunnage sits on top of lower item, spanning its width
  const lateralPos = lowerItem.position.y;
  const z = lowerItem.position.z + lowerBB.height;
  const width = lowerWidth;

  // SVG coordinates
  const svgX = lateralPos - width / 2;
  const svgY = -(z + thickness);

  return (
    <g data-testid={`dunnage-end-${index}`}>
      <rect
        x={svgX}
        y={svgY}
        width={width}
        height={thickness}
        fill={`url(#${patternId})`}
        stroke={style.color}
        strokeWidth={1}
        opacity={0.7}
      />
      <text
        x={svgX + width / 2}
        y={svgY - 3}
        textAnchor="middle"
        fontSize={5}
        fill={style.color}
      >
        {style.label} {thickness}"
      </text>
    </g>
  );
}
