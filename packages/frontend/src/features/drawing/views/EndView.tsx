// ─── End (Front/Rear) View ───────────────────────────────────────────────────
// Renders front view (looking from cab toward rear) or rear view (looking from rear toward cab).
// Shows lateral freight placement, stacking height, and deck width.

import type { PlacedFreight } from '@ptv-discovery-coach/shared';
import type { ViewProps } from '../types';
import { getItemColor } from '../utils/colors';
import { getEndViewRect, getItemId, getMaxFreightWeight, VIEW_PADDING } from '../utils/geometry';
import { FreightLabel } from '../components/FreightLabel';
import { SecurementOverlay } from '../components/SecurementOverlay';
import { DunnageOverlay } from '../components/DunnageOverlay';

interface EndViewProps extends ViewProps {
  /** View direction: front (cab toward rear) or rear (rear toward cab) */
  direction: 'front' | 'rear';
}

export function EndView({ trailer, placedFreight, options, viewBox, direction, onItemClick, onItemHover, securementPlans, dunnageInsertions }: EndViewProps) {
  const deckWidth = trailer.deckWidthIn;
  const maxWeight = getMaxFreightWeight(placedFreight);
  const maxHeight = 162; // legal max above deck

  return (
    <svg
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      className="w-full h-full"
      role="img"
      aria-label={`${direction === 'front' ? 'Front' : 'Rear'} view of trailer load plan`}
      data-testid={`drawing-${direction}-view`}
    >
      <title>{direction === 'front' ? 'Front' : 'Rear'} View</title>

      {/* Deck surface line (cross-section) */}
      <line
        x1={-deckWidth / 2}
        y1={0}
        x2={deckWidth / 2}
        y2={0}
        stroke="#374151"
        strokeWidth={3}
        data-testid="deck-cross-section"
      />

      {/* Deck edges (vertical side walls representation) */}
      <line
        x1={-deckWidth / 2}
        y1={0}
        x2={-deckWidth / 2}
        y2={10}
        stroke="#374151"
        strokeWidth={2}
      />
      <line
        x1={deckWidth / 2}
        y1={0}
        x2={deckWidth / 2}
        y2={10}
        stroke="#374151"
        strokeWidth={2}
      />

      {/* Centerline */}
      <line
        x1={0}
        y1={VIEW_PADDING}
        x2={0}
        y2={-(maxHeight + VIEW_PADDING)}
        stroke="#d1d5db"
        strokeWidth={0.5}
        strokeDasharray="3 3"
      />
      <text x={2} y={VIEW_PADDING - 4} fontSize={6} fill="#9ca3af">
        CL
      </text>

      {/* Ground line */}
      <line
        x1={-(deckWidth / 2 + VIEW_PADDING)}
        y1={trailer.deckHeightIn}
        x2={deckWidth / 2 + VIEW_PADDING}
        y2={trailer.deckHeightIn}
        stroke="#9ca3af"
        strokeWidth={1}
        strokeDasharray="4 4"
      />

      {/* Legal height limit */}
      <line
        x1={-deckWidth / 2}
        y1={-maxHeight}
        x2={deckWidth / 2}
        y2={-maxHeight}
        stroke="#ef4444"
        strokeWidth={0.5}
        strokeDasharray="6 3"
      />
      <text x={deckWidth / 2 + 4} y={-maxHeight + 3} fontSize={6} fill="#ef4444">
        Max
      </text>

      {/* Placed freight items */}
      {placedFreight.map((placed) => {
        const rect = getEndViewRect(placed);
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

        // In end view: y is lateral, z is height (negate for SVG y-down)
        // For rear view, mirror the lateral axis
        const lateralPos = direction === 'rear' ? -rect.y : rect.y;
        const svgX = lateralPos - rect.width / 2;
        const svgY = -(rect.z + rect.height);

        return (
          <g
            key={itemId}
            data-testid={`freight-end-${placed.item.orderNumber}`}
            className="cursor-pointer"
            onClick={() => onItemClick?.(placed.item.orderNumber)}
            onMouseEnter={() => onItemHover?.(placed.item.orderNumber)}
            onMouseLeave={() => onItemHover?.(null)}
          >
            {renderEndShape(placed, svgX, svgY, rect.width, rect.height, fillColor, isHighlighted)}

            <FreightLabel
              x={svgX + rect.width / 2}
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
          viewType="end"
        />
      )}

      {/* Securement overlay */}
      {options.showSecurement && securementPlans && securementPlans.length > 0 && (
        <SecurementOverlay
          securementPlans={securementPlans}
          trailer={trailer}
          placedFreight={placedFreight}
          highlightedItemId={options.highlightedItemId}
          viewType="end"
        />
      )}
    </svg>
  );
}

/** Render shape in end view based on geometric type */
function renderEndShape(
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

  // Coils appear as circles from the end
  if (placed.geometry.type === 'horizontal_coil' || placed.geometry.type === 'vertical_coil') {
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

  // Cylindrical bundles
  if (placed.geometry.type === 'cylindrical_bundle') {
    return (
      <ellipse
        cx={x + width / 2}
        cy={y + height / 2}
        rx={width / 2}
        ry={height / 2}
        fill={fill}
        fillOpacity={opacity}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }

  // Default rectangular cross-section
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

/** Calculate the initial viewBox for an end (front/rear) view */
export function getEndViewBox(trailer: { deckWidthIn: number; deckHeightIn: number }) {
  const deckWidth = trailer.deckWidthIn;
  const totalHeight = trailer.deckHeightIn + 180;
  return {
    x: -(deckWidth / 2 + VIEW_PADDING),
    y: -(180 + VIEW_PADDING),
    width: deckWidth + VIEW_PADDING * 2,
    height: totalHeight + VIEW_PADDING * 2,
  };
}
