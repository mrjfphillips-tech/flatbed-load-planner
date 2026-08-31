// ─── Geometry Utilities for Drawing Renderer ─────────────────────────────────
// Helpers for projecting 3D freight positions onto 2D SVG coordinates.

import type { PlacedFreight, TrailerProfile } from '@ptv-discovery-coach/shared';

/** Padding (in inches) around the trailer outline in SVG views */
export const VIEW_PADDING = 24;

/**
 * Calculate the deck length in inches from the trailer profile.
 * Deck starts at kingpin and extends rearward.
 */
export function getDeckLengthIn(trailer: TrailerProfile): number {
  return trailer.lengthFt * 12;
}

/**
 * Get the bounding dimensions of a placed freight item in the top-down view.
 * Accounts for orientation (longitudinal vs transverse swaps length/width).
 */
export function getTopViewRect(placed: PlacedFreight) {
  const { boundingBox } = placed.geometry;
  const isTransverse = placed.orientation === 'transverse';
  return {
    x: placed.position.x,
    y: placed.position.y,
    width: isTransverse ? boundingBox.width : boundingBox.length,
    height: isTransverse ? boundingBox.length : boundingBox.width,
  };
}

/**
 * Get the bounding dimensions of a placed freight item in a side elevation view.
 * Returns x (longitudinal) and z (height) positioning.
 */
export function getSideViewRect(placed: PlacedFreight) {
  const { boundingBox } = placed.geometry;
  const isTransverse = placed.orientation === 'transverse';
  return {
    x: placed.position.x,
    z: placed.position.z,
    width: isTransverse ? boundingBox.width : boundingBox.length,
    height: boundingBox.height,
  };
}

/**
 * Get the bounding dimensions of a placed freight item in a front/rear (end) view.
 * Returns y (lateral) and z (height) positioning.
 */
export function getEndViewRect(placed: PlacedFreight) {
  const { boundingBox } = placed.geometry;
  const isTransverse = placed.orientation === 'transverse';
  return {
    y: placed.position.y,
    z: placed.position.z,
    width: isTransverse ? boundingBox.length : boundingBox.width,
    height: boundingBox.height,
  };
}

/**
 * Determine max freight weight across all placed items (for weight-based coloring).
 */
export function getMaxFreightWeight(placedFreight: PlacedFreight[]): number {
  if (placedFreight.length === 0) return 1;
  return Math.max(...placedFreight.map((p) => p.item.totalLineWeight));
}

/**
 * Generate an item ID string suitable for SVG element identification.
 */
export function getItemId(placed: PlacedFreight): string {
  return `${placed.item.orderNumber}-${placed.item.productType}-${placed.layer}`;
}
