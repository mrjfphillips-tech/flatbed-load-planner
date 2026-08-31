// ─── Freight Label Component ─────────────────────────────────────────────────
// Renders text annotations on freight items: order number, weight, dimensions.

interface FreightLabelProps {
  x: number;
  y: number;
  orderNumber: string;
  weight?: number;
  width?: number;
  height?: number;
}

export function FreightLabel({ x, y, orderNumber, weight, width, height }: FreightLabelProps) {
  const lineHeight = 9;
  const lines: string[] = [orderNumber];

  if (weight !== undefined) {
    lines.push(`${formatWeight(weight)} lbs`);
  }

  if (width !== undefined && height !== undefined) {
    lines.push(`${formatDim(width)}×${formatDim(height)}"`);
  }

  const startY = y - ((lines.length - 1) * lineHeight) / 2;

  return (
    <g className="pointer-events-none" aria-hidden="true">
      {lines.map((line, idx) => (
        <text
          key={idx}
          x={x}
          y={startY + idx * lineHeight}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={idx === 0 ? 8 : 6.5}
          fontWeight={idx === 0 ? 'bold' : 'normal'}
          fill="#1f2937"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function formatWeight(lbs: number): string {
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(1)}k`;
  return lbs.toFixed(0);
}

function formatDim(inches: number): string {
  if (inches >= 12) return `${(inches / 12).toFixed(1)}'`;
  return inches.toFixed(0);
}
