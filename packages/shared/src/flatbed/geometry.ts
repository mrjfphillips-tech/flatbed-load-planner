// ─── OptiFlow Flatbed Steel Load Planner — Geometric Modeler ─────────────────
// Pure functions for geometric type assignment, footprint calculations,
// deck pressure, cradle angles, and chock dimensions.

import type { FreightGeometry, GeometricType, SteelProductType } from './types';

// ─── Geometric Type Assignment ───────────────────────────────────────────────

/**
 * Deterministic mapping from steel product type to geometric type.
 * Each of the 22 steel product types maps to exactly one geometric type.
 *
 * @param productType - The steel product type to classify
 * @returns The corresponding geometric type
 */
export function assignGeometricType(productType: SteelProductType): GeometricType {
  switch (productType) {
    // Coils — modeled as horizontal coils (eye horizontal by default)
    case 'coil_hot_rolled':
    case 'coil_cold_rolled':
    case 'coil_galvanized':
      return 'horizontal_coil';

    // Wire rod coils — also cylindrical, modeled as horizontal coil
    case 'wire_rod_coil':
      return 'horizontal_coil';

    // Sheet bundles — flat rectangular bundles
    case 'sheet_bundle':
    case 'roofing_sheet_bundle':
      return 'long_rectangular_bundle';

    // Plate — stacked flat plates
    case 'plate':
      return 'plate_stack';

    // Rebar bundles — cylindrical bundles
    case 'rebar_bundle':
      return 'cylindrical_bundle';

    // Structural beams — long rectangular profiles
    case 'beam_i':
    case 'beam_h':
    case 'beam_wide_flange':
    case 'channel':
    case 'angle':
      return 'long_rectangular_bundle';

    // Bar stock — long rectangular bundles
    case 'flat_bar':
    case 'round_bar':
      return 'long_rectangular_bundle';

    // Pipe and tube — cylindrical bundles
    case 'pipe':
    case 'tube':
    case 'hollow_structural_section':
      return 'cylindrical_bundle';

    // Wire mesh panels — flat rectangular
    case 'wire_mesh_panel':
      return 'rectangular';

    // Fabricated assemblies — irregular shapes requiring bounding box
    case 'fabricated_assembly':
      return 'irregular';

    // Palletized steel — standard rectangular package
    case 'palletized':
      return 'rectangular';

    // Mixed bundles — irregular (heterogeneous contents)
    case 'mixed_bundle':
      return 'irregular';

    default: {
      // Exhaustiveness check — TypeScript will error if a case is missed
      const _exhaustive: never = productType;
      return _exhaustive;
    }
  }
}

// ─── Contact Footprint Calculation ───────────────────────────────────────────

/**
 * Calculates the contact footprint area (in square inches) for a freight item
 * based on its geometric type and bounding box dimensions.
 *
 * Different geometric types have different contact patterns:
 * - rectangular, plate_stack: full bottom face (length × width)
 * - long_rectangular_bundle: full bottom face (length × width)
 * - cylindrical_bundle: line contact approximated as length × (10% of width)
 * - horizontal_coil: two line contacts from cradle/chocks, approximated as length × (width × 0.1)
 * - vertical_coil: circular footprint (π × (width/2)²) where width = outer diameter
 * - irregular: conservative full bounding box footprint (length × width)
 *
 * @param geometry - The freight geometry with type and bounding box
 * @returns Contact footprint area in square inches
 */
export function calculateContactFootprint(geometry: FreightGeometry): number {
  const { length, width } = geometry.boundingBox;

  switch (geometry.type) {
    case 'rectangular':
    case 'plate_stack':
    case 'irregular':
      // Full bottom face contact
      return length * width;

    case 'long_rectangular_bundle':
      // Full bottom face contact (bundles are banded flat)
      return length * width;

    case 'cylindrical_bundle':
      // Line contact — approximated as length × 10% of bundle width
      // Cylindrical bundles rest on their curved surfaces
      return length * (width * 0.1);

    case 'horizontal_coil':
      // Horizontal coil rests in a cradle — contact through cradle/chocks
      // Approximated as coil width (length of bounding box = coil width) × 10% of diameter
      return length * (width * 0.1);

    case 'vertical_coil':
      // Circular footprint — coil stands on its flat face
      // width represents the outer diameter
      const radius = width / 2;
      return Math.PI * radius * radius;

    default: {
      const _exhaustive: never = geometry.type;
      return _exhaustive;
    }
  }
}

// ─── Deck Pressure Calculation ───────────────────────────────────────────────

/**
 * Calculates the deck pressure (concentrated load) in pounds per square foot (PSF).
 *
 * Formula: PSF = weight / (footprint in sq ft)
 * where footprint in sq ft = footprint in sq inches / 144
 *
 * @param weight - Item weight in pounds
 * @param footprintSqIn - Contact footprint area in square inches
 * @returns Deck pressure in PSF (pounds per square foot)
 */
export function calculateDeckPressure(weight: number, footprintSqIn: number): number {
  if (footprintSqIn <= 0) {
    return Infinity;
  }
  const footprintSqFt = footprintSqIn / 144;
  return weight / footprintSqFt;
}

// ─── Cradle Angle Calculation ────────────────────────────────────────────────

/**
 * Calculates the cradle angle for a horizontal cylindrical item resting in a cradle.
 *
 * For a horizontal cylinder of diameter D resting in a V-cradle of width W,
 * the cradle angle = arcsin(W / D), returned in degrees.
 *
 * Constraints:
 * - W must be less than D (cradle width cannot exceed cylinder diameter)
 * - Both values must be positive
 *
 * @param diameter - Cylinder outer diameter in inches
 * @param cradleWidth - Cradle opening width in inches
 * @returns Cradle angle in degrees (0° < angle < 90°), or NaN if inputs are invalid
 */
export function calculateCradleAngle(diameter: number, cradleWidth: number): number {
  if (diameter <= 0 || cradleWidth <= 0) {
    return NaN;
  }
  if (cradleWidth >= diameter) {
    return NaN;
  }

  const ratio = cradleWidth / diameter;
  const angleRad = Math.asin(ratio);
  const angleDeg = angleRad * (180 / Math.PI);

  return angleDeg;
}

// ─── Chock Dimensions Calculation ────────────────────────────────────────────

/**
 * Calculates recommended chock dimensions for a horizontal coil.
 *
 * Chocks are wedge-shaped blocks placed on both sides of a horizontal coil
 * to prevent rolling. Sizing is based on the coil diameter:
 * - Chock width: 1/3 of the coil diameter (adequate contact surface)
 * - Chock height: 1/4 of the coil diameter (sufficient to prevent roll-over)
 *
 * @param diameter - Coil outer diameter in inches
 * @returns Chock dimensions { width, height } in inches, or { width: 0, height: 0 } if diameter is invalid
 */
export function calculateChockDimensions(diameter: number): { width: number; height: number } {
  if (diameter <= 0) {
    return { width: 0, height: 0 };
  }

  return {
    width: diameter / 3,
    height: diameter / 4,
  };
}
