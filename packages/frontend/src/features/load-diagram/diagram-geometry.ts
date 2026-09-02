// ─── Diagram Geometry Helpers ────────────────────────────────────────────────
// Feature: load-diagram-generator
//
// Pure geometry helpers shared by the 2D canvas viewer and the 3D viewer. All
// inputs are canonical mm; these functions do no unit conversion (that happens
// only when formatting labels for display).

import type { loadDiagram } from '@ptv-discovery-coach/shared';

type PlacedItem = loadDiagram.PlacedItem;
type ItemOrientation = loadDiagram.ItemOrientation;

const ORIENTATION_MAP: Record<
  ItemOrientation,
  ['length' | 'width' | 'height', 'length' | 'width' | 'height', 'length' | 'width' | 'height']
> = {
  LWH: ['length', 'width', 'height'],
  WLH: ['width', 'length', 'height'],
  LHW: ['length', 'height', 'width'],
  WHL: ['width', 'height', 'length'],
  HLW: ['height', 'length', 'width'],
  HWL: ['height', 'width', 'length'],
};

/** Canonical extents (mm) of an item along the X/Y/Z axes as placed. */
export function extents(it: PlacedItem): { dx: number; dy: number; dz: number } {
  const [a, b, c] = ORIENTATION_MAP[it.placedOrientation];
  return { dx: it[a], dy: it[b], dz: it[c] };
}

/** Qualitative color palette cycled by delivery stop. */
export const STOP_PALETTE = [
  '#3182ce', '#38a169', '#dd6b20', '#805ad5',
  '#d53f8c', '#319795', '#e53e3e', '#718096',
];

/** Deterministic color for a delivery stop. */
export function stopColor(stop: number | undefined): string {
  return STOP_PALETTE[(stop ?? 0) % STOP_PALETTE.length];
}

/** Distinct delivery stops present in a set of placed items, ascending. */
export function distinctStops(items: PlacedItem[]): number[] {
  const set = new Set<number>();
  for (const it of items) if (it.deliveryStop != null) set.add(it.deliveryStop);
  return [...set].sort((a, b) => a - b);
}
