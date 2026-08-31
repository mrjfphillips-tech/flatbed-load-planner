// ─── Color Utilities for Drawing Renderer ────────────────────────────────────
// Provides consistent color mapping for stops, product types, and weight ranges.

import type { SteelProductType } from '@ptv-discovery-coach/shared';

/** Stop color palette — distinct colors for delivery stop identification */
const STOP_COLORS: string[] = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

/** Get fill color for a delivery stop number (1-indexed) */
export function getStopColor(stop: number): string {
  return STOP_COLORS[(stop - 1) % STOP_COLORS.length];
}

/** Product type color mapping by category */
const PRODUCT_TYPE_COLORS: Record<string, string> = {
  coil: '#dc2626',       // red family for coils
  sheet: '#2563eb',      // blue for sheets
  plate: '#0891b2',      // cyan for plate
  beam: '#7c3aed',       // purple for structural beams
  bar: '#ca8a04',        // yellow for bars
  pipe: '#16a34a',       // green for pipe/tube
  bundle: '#ea580c',     // orange for bundles
  panel: '#0d9488',      // teal for panels
  other: '#6b7280',      // gray for other
};

/** Get fill color for a steel product type */
export function getProductTypeColor(productType: SteelProductType): string {
  if (productType.startsWith('coil_') || productType === 'wire_rod_coil') {
    return PRODUCT_TYPE_COLORS.coil;
  }
  if (productType === 'sheet_bundle' || productType === 'roofing_sheet_bundle') {
    return PRODUCT_TYPE_COLORS.sheet;
  }
  if (productType === 'plate') {
    return PRODUCT_TYPE_COLORS.plate;
  }
  if (productType.startsWith('beam_') || productType === 'channel' || productType === 'angle') {
    return PRODUCT_TYPE_COLORS.beam;
  }
  if (productType === 'flat_bar' || productType === 'round_bar') {
    return PRODUCT_TYPE_COLORS.bar;
  }
  if (productType === 'pipe' || productType === 'tube' || productType === 'hollow_structural_section') {
    return PRODUCT_TYPE_COLORS.pipe;
  }
  if (productType === 'rebar_bundle' || productType === 'mixed_bundle') {
    return PRODUCT_TYPE_COLORS.bundle;
  }
  if (productType === 'wire_mesh_panel') {
    return PRODUCT_TYPE_COLORS.panel;
  }
  return PRODUCT_TYPE_COLORS.other;
}

/** Get fill color based on item weight (gradient from green to red) */
export function getWeightColor(weight: number, maxWeight: number): string {
  if (maxWeight <= 0) return '#6b7280';
  const ratio = Math.min(weight / maxWeight, 1);
  // Green → Yellow → Red gradient
  if (ratio < 0.5) {
    const g = Math.round(180 + (ratio * 2) * 75);
    const r = Math.round(ratio * 2 * 255);
    return `rgb(${r}, ${g}, 80)`;
  }
  const r = 255;
  const g = Math.round(255 - (ratio - 0.5) * 2 * 200);
  return `rgb(${r}, ${g}, 60)`;
}

/** Get the fill color for a freight item based on the current colorBy option */
export function getItemColor(
  item: { deliveryStop: number; productType: SteelProductType; totalLineWeight: number },
  colorBy: 'stop' | 'product_type' | 'weight',
  maxWeight: number
): string {
  switch (colorBy) {
    case 'stop':
      return getStopColor(item.deliveryStop);
    case 'product_type':
      return getProductTypeColor(item.productType);
    case 'weight':
      return getWeightColor(item.totalLineWeight, maxWeight);
  }
}
