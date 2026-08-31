// ─── Side Elevation View ─────────────────────────────────────────────────────
// Renders left-side or right-side elevation showing freight stacking height,
// deck level, axle positions, and kingpin.

import type { PlacedFreight } from '@ptv-discovery-coach/shared';
import type { ViewProps } from '../types';
import { getItemColor } from '../utils/colors';
import { getDeckLengthIn, getItemId, getMaxFreightWeight, getSideViewRect, VIEW_PADDING } from '../utils/geometry';
import { FreightLabel } from '../components/FreightLabel';
import { SecurementOverlay } from '../components/SecurementOverlay';
import { DunnageOverlay } from '../components/DunnageOverlay';

interface SideViewProps extends ViewProps {
  /** Which side: left or right */
  side: 'left' | 'right';
}

export function SideView({ trailer, placedFreight, options, viewBox, side, onItemClick, onItemHover, securementPlans, dunnageInsertions }: SideViewProps) {
  const deckLength = getDeckLengthIn(trailer);
  const maxWeight = getMaxFreightWeight(placedFreight);
  const maxHeight = 162; // ~13.5 ft legal max height above deck (conservative)

  // For left side view, items at negative y (left of centerline) are "front";
  // for right side, items at positive y are "front". We show all items as projected.
  // Side views are projections — all items visible regardless of lateral position.

  return (
    <svg
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      className="w-full h-full"
      role="img"
      aria-label={`${side === 'left' ? 'Left' : 'Right'}-side elevation view of trailer load plan`}
      data-testid={`drawing-${side}-side-view`}
    >
      <title>{side === 'left' ? 'Left' : 'Right'}-Side Elevation View</title>

      {/* Deck surface line */}
      <line
        x1={0}
        y1={0}
        x2={deckLength}
        y2={0}
        stroke="#374151"
        strokeWidth={3}
        data-testid="deck-line"
      />

      {/* Ground line (below deck) */}
      <line
        x1={-VIEW_PADDING}
        y1={trailer.deckHeightIn}
        x2={deckLength + VIEW_PADDING}
        y2={trailer.deckHeightIn}
        stroke="#9ca3af"
        strokeWidth={1}
        strokeDasharray="4 4"
      />

      {/* Kingpin marker */}
      <g data-testid="kingpin-side">
        <line x1={0} y1={0} x2={0} y2={20} stroke="#1f2937" strokeWidth={2} />
        <circle cx={0} cy={20} r={4} fill="#1f2937" />
        <text x={0} y={32} textAnchor="middle" fontSize={7} fill="#374151">
          KP
        </text>
      </g>

      {/* Axle positions (shown as wheels below deck) */}
      {trailer.axlePositions.map((pos, idx) => (
        <g key={`axle-side-${idx}`} data-testid={`axle-side-${idx}`}>
          <circle
            cx={pos}
            cy={trailer.deckHeightIn - 10}
            r={10}
            fill="none"
            stroke="#6b7280"
            strokeWidth={2}
          />
          <line
            x1={pos}
            y1={0}
            x2={pos}
            y2={trailer.deckHeightIn - 20}
            stroke="#9ca3af"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        </g>
      ))}

      {/* Legal height limit indicator */}
      <line
        x1={0}
        y1={-maxHeight}
        x2={deckLength}
        y2={-maxHeight}
        stroke="#ef4444"
        strokeWidth={0.5}
        strokeDasharray="6 3"
      />
      <text x={deckLength + 4} y={-maxHeight + 3} fontSize={6} fill="#ef4444">
        Max Height
      </text>

      {/* Placed freight items (projected onto the side plane) */}
      {placedFreight.map((placed) => {
        const rect = getSideViewRect(placed);
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

        // In side view, z goes upward so we negate it for SVG coordinates (y-down)
        const svgY = -(rect.z + rect.height);

        return (
          <g
            key={itemId}
            data-testid={`freight-side-${placed.item.orderNumber}`}
            className="cursor-pointer"
            onClick={() => onItemClick?.(placed.item.orderNumber)}
            onMouseEnter={() => onItemHover?.(placed.item.orderNumber)}
            onMouseLeave={() => onItemHover?.(null)}
          >
            {renderSideShape(placed, rect.x, svgY, rect.width, rect.height, fillColor, isHighlighted)}

            <FreightLabel
              x={rect.x + rect.width / 2}
              y={svgY + rect.height / 2}
              orderNumber={placed.item.orderNumber}
              weight={options.showWeightAnnotations ? placed.item.totalLineWeight : undefined}
            />
          </g>
        );
      })}

      {/* Dunnage overlay */}
      {options.showDunnage && dunnageInsertions && dunnageInsertions.length > 0 && (
        <DunnageOverlay
          dunnageInsertions={dunnageInsertions}
          placedFreight={placedFreight}
          highlightedItemId={options.highlightedItemId}
          viewType="side"
        />
      )}

      {/* Securement overlay */}
      {options.showSecurement && securementPlans && securementPlans.length > 0 && (
        <SecurementOverlay
          securementPlans={securementPlans}
          trailer={trailer}
          placedFreight={placedFreight}
          highlightedItemId={options.highlightedItemId}
          viewType="side"
        />
      )}
    </svg>
  );
}

/** Render shape in side elevation based on geometric type */
function renderSideShape(
  placed: PlacedFreight,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  highlighted: boolean
) {
  const stroke = highlighted ? '#000' : '#374151';
  const strokeWidth = highlighted ? 2.5 : 1;
  const opacity = highlighted ? 1 : 0.85;

  // Horizontal coils appear as circles from the side
  if (placed.geometry.type === 'horizontal_coil') {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = Math.min(width, height) / 2;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        fillOpacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }

  // Cylindrical bundles appear as ovals from the side
  if (placed.geometry.type === 'cylindrical_bundle') {
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={height / 4}
        ry={height / 4}
        fill={fill}
        fillOpacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }

  // Default rectangular
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={fill}
      fillOpacity={opacity}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}

/** Calculate the initial viewBox for a side elevation view */
export function getSideViewBox(trailer: { lengthFt: number; deckHeightIn: number }) {
  const deckLength = trailer.lengthFt * 12;
  const totalHeight = trailer.deckHeightIn + 180; // deck height + max cargo height
  return {
    x: -VIEW_PADDING,
    y: -(180 + VIEW_PADDING), // cargo above deck
    width: deckLength + VIEW_PADDING * 2,
    height: totalHeight + VIEW_PADDING * 2,
  };
}
