// ─── Top-Down (Plan) View ────────────────────────────────────────────────────
// Renders the trailer deck from above showing freight placement, axle positions,
// kingpin, stake pockets, and anchor points.

import type { PlacedFreight } from '@ptv-discovery-coach/shared';
import type { ViewProps } from '../types';
import { getItemColor } from '../utils/colors';
import { getDeckLengthIn, getItemId, getMaxFreightWeight, getTopViewRect, VIEW_PADDING } from '../utils/geometry';
import { FreightLabel } from '../components/FreightLabel';
import { SecurementOverlay } from '../components/SecurementOverlay';
import { DunnageOverlay } from '../components/DunnageOverlay';

export function TopView({ trailer, placedFreight, options, viewBox, onItemClick, onItemHover, securementPlans, dunnageInsertions }: ViewProps) {
  const deckLength = getDeckLengthIn(trailer);
  const deckWidth = trailer.deckWidthIn;
  const maxWeight = getMaxFreightWeight(placedFreight);

  return (
    <svg
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      className="w-full h-full"
      role="img"
      aria-label="Top-down view of trailer load plan"
      data-testid="drawing-top-view"
    >
      <title>Top-Down (Plan) View</title>

      {/* Deck outline */}
      <rect
        x={0}
        y={-deckWidth / 2}
        width={deckLength}
        height={deckWidth}
        fill="none"
        stroke="#374151"
        strokeWidth={2}
        data-testid="deck-outline"
      />

      {/* Kingpin marker */}
      <circle
        cx={0}
        cy={0}
        r={6}
        fill="#1f2937"
        stroke="#000"
        strokeWidth={1}
        data-testid="kingpin"
      />
      <text x={0} y={-12} textAnchor="middle" fontSize={8} fill="#374151">
        Kingpin
      </text>

      {/* Axle positions */}
      {trailer.axlePositions.map((pos, idx) => (
        <g key={`axle-${idx}`} data-testid={`axle-${idx}`}>
          <line
            x1={pos}
            y1={-deckWidth / 2 - 8}
            x2={pos}
            y2={deckWidth / 2 + 8}
            stroke="#6b7280"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <text x={pos} y={deckWidth / 2 + 18} textAnchor="middle" fontSize={7} fill="#6b7280">
            Axle {idx + 1}
          </text>
        </g>
      ))}

      {/* Stake pockets */}
      {trailer.stakePockets.map((sp, idx) => (
        <rect
          key={`stake-${idx}`}
          x={sp.x - 2}
          y={sp.y - 2}
          width={4}
          height={4}
          fill="#9ca3af"
          stroke="#6b7280"
          strokeWidth={0.5}
          data-testid={`stake-pocket-${idx}`}
        />
      ))}

      {/* Anchor points */}
      {trailer.anchorPoints.map((ap, idx) => (
        <circle
          key={`anchor-${idx}`}
          cx={ap.x}
          cy={ap.y}
          r={3}
          fill="none"
          stroke="#059669"
          strokeWidth={1.5}
          data-testid={`anchor-point-${idx}`}
        />
      ))}

      {/* Placed freight items */}
      {placedFreight.map((placed) => {
        const rect = getTopViewRect(placed);
        const itemId = getItemId(placed);
        const isHighlighted = options.highlightedItemId === placed.item.orderNumber;
        const fillColor = getItemColor(
          {
            deliveryStop: placed.item.deliveryStop,
            productType: placed.item.productType,
            totalLineWeight: placed.item.totalLineWeight,
          },
          options.colorBy,
          maxWeight
        );

        return (
          <g
            key={itemId}
            data-testid={`freight-item-${placed.item.orderNumber}`}
            className="cursor-pointer"
            onClick={() => onItemClick?.(placed.item.orderNumber)}
            onMouseEnter={() => onItemHover?.(placed.item.orderNumber)}
            onMouseLeave={() => onItemHover?.(null)}
          >
            {/* Item shape */}
            {renderTopShape(placed, rect, fillColor, isHighlighted)}

            {/* Labels and annotations */}
            <FreightLabel
              x={rect.x + rect.width / 2}
              y={rect.y + rect.height / 2}
              orderNumber={placed.item.orderNumber}
              weight={options.showWeightAnnotations ? placed.item.totalLineWeight : undefined}
              width={options.showDimensions ? rect.width : undefined}
              height={options.showDimensions ? rect.height : undefined}
            />
          </g>
        );
      })}

      {/* Dunnage overlay (rendered below securement for visual layering) */}
      {options.showDunnage && dunnageInsertions && dunnageInsertions.length > 0 && (
        <DunnageOverlay
          dunnageInsertions={dunnageInsertions}
          placedFreight={placedFreight}
          highlightedItemId={options.highlightedItemId}
          viewType="top"
        />
      )}

      {/* Securement overlay */}
      {options.showSecurement && securementPlans && securementPlans.length > 0 && (
        <SecurementOverlay
          securementPlans={securementPlans}
          trailer={trailer}
          placedFreight={placedFreight}
          highlightedItemId={options.highlightedItemId}
          viewType="top"
        />
      )}
    </svg>
  );
}

/** Render the appropriate shape for top-down view based on geometric type */
function renderTopShape(
  placed: PlacedFreight,
  rect: { x: number; y: number; width: number; height: number },
  fill: string,
  highlighted: boolean
) {
  const stroke = highlighted ? '#000' : '#374151';
  const strokeWidth = highlighted ? 2.5 : 1;
  const opacity = highlighted ? 1 : 0.85;

  // Coils render as circles/ellipses in top view
  if (placed.geometry.type === 'horizontal_coil' || placed.geometry.type === 'vertical_coil') {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const rx = rect.width / 2;
    const ry = rect.height / 2;
    return (
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        fill={fill}
        fillOpacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }

  // Cylindrical bundles render with rounded ends
  if (placed.geometry.type === 'cylindrical_bundle') {
    const radius = Math.min(rect.width, rect.height) / 4;
    return (
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx={radius}
        ry={radius}
        fill={fill}
        fillOpacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }

  // Default: rectangular shape
  return (
    <rect
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      fill={fill}
      fillOpacity={opacity}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}

/** Calculate the initial viewBox for the top-down view */
export function getTopViewBox(trailer: { lengthFt: number; deckWidthIn: number }) {
  const deckLength = trailer.lengthFt * 12;
  const deckWidth = trailer.deckWidthIn;
  return {
    x: -VIEW_PADDING,
    y: -(deckWidth / 2 + VIEW_PADDING),
    width: deckLength + VIEW_PADDING * 2,
    height: deckWidth + VIEW_PADDING * 2,
  };
}
