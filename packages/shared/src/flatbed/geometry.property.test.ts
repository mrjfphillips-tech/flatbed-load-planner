// ─── Property-Based Tests for Geometric Modeler ─────────────────────────────
// Feature: flatbed-load-planner
// Property 5: Geometric type assignment and footprint calculation
// Validates: Requirements 3.1, 3.2, 3.3, 3.4

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  assignGeometricType,
  calculateContactFootprint,
  calculateCradleAngle,
  calculateChockDimensions,
} from './geometry';
import type {
  SteelProductType,
  SteelOrderLineItem,
  FreightGeometry,
  GeometricType,
  FreightDimensions,
} from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

/** All 22 recognized steel product types */
const ALL_STEEL_PRODUCT_TYPES: SteelProductType[] = [
  'coil_hot_rolled', 'coil_cold_rolled', 'coil_galvanized',
  'sheet_bundle', 'plate', 'rebar_bundle', 'wire_rod_coil',
  'beam_i', 'beam_h', 'beam_wide_flange', 'channel', 'angle',
  'flat_bar', 'round_bar', 'pipe', 'tube', 'hollow_structural_section',
  'roofing_sheet_bundle', 'wire_mesh_panel', 'fabricated_assembly',
  'palletized', 'mixed_bundle',
];

/** Product types that map to horizontal_coil */
const HORIZONTAL_COIL_TYPES: SteelProductType[] = [
  'coil_hot_rolled', 'coil_cold_rolled', 'coil_galvanized', 'wire_rod_coil',
];

// ─── Custom Generators ───────────────────────────────────────────────────────

/**
 * Generates an arbitrary SteelProductType from all 22 valid types.
 */
function arbitrarySteelProductType(): fc.Arbitrary<SteelProductType> {
  return fc.constantFrom(...ALL_STEEL_PRODUCT_TYPES);
}

/**
 * Generates valid freight dimensions with positive finite values
 * representing realistic steel product sizes (in inches).
 */
function arbitraryFreightDimensions(): fc.Arbitrary<FreightDimensions> {
  return fc.record({
    length: fc.integer({ min: 6, max: 720 }),   // 0.5ft to 60ft
    width: fc.integer({ min: 2, max: 120 }),    // 2in to 10ft
    height: fc.integer({ min: 1, max: 120 }),   // 1in to 10ft
  });
}

/**
 * Generates an arbitrary SteelOrderLineItem with valid field values.
 * This is the primary generator required by the task specification.
 */
export function arbitrarySteelOrderLineItem(): fc.Arbitrary<SteelOrderLineItem> {
  return fc.record({
    orderNumber: fc.stringMatching(/^ORD-[0-9]{4,8}$/),
    customerName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    deliveryStop: fc.integer({ min: 1, max: 10 }),
    productType: arbitrarySteelProductType(),
    quantity: fc.integer({ min: 1, max: 100 }),
    pieceWeight: fc.integer({ min: 50, max: 80000 }),
    dimensions: arbitraryFreightDimensions(),
    totalLineWeight: fc.integer({ min: 50, max: 200000 }),
    handlingMethod: fc.constantFrom('crane' as const, 'forklift' as const, 'magnet' as const, 'manual' as const),
    stackPermission: fc.constantFrom('yes' as const, 'no' as const, 'conditional' as const),
    maxStackHeight: fc.integer({ min: 12, max: 144 }),
    maxStackWeight: fc.integer({ min: 1000, max: 100000 }),
    orientationRequirement: fc.constantFrom('longitudinal' as const, 'transverse' as const, 'any' as const),
    dunnageRequired: fc.boolean(),
    specialNotes: fc.string({ maxLength: 200 }),
  });
}

/**
 * Generates a FreightGeometry object with a given type and valid bounding box.
 */
function arbitraryFreightGeometry(geometricType: GeometricType): fc.Arbitrary<FreightGeometry> {
  return arbitraryFreightDimensions().map((dims) => ({
    type: geometricType,
    boundingBox: { length: dims.length, width: dims.width, height: dims.height },
    contactFootprint: { area: 0, shape: 'rectangle' as const },
    centerOfMass: { x: dims.length / 2, y: dims.width / 2, z: dims.height / 2 },
  }));
}

// ─── Property 5: Geometric type assignment and footprint calculation ─────────
// For any product type and valid dimensions:
// - Geometric type is deterministic (same type always returns same geometry)
// - Footprint is positive finite
// - Horizontal cylinders produce valid cradle angle (0° < angle < 90°)

describe('Feature: flatbed-load-planner, Property 5: Geometric type assignment and footprint calculation', () => {
  /**
   * Validates: Requirements 3.1, 3.2
   * Geometric type assignment is deterministic — same product type always maps
   * to the same geometric type regardless of how many times it is called.
   */
  it('geometric type assignment is deterministic for any product type', () => {
    fc.assert(
      fc.property(
        arbitrarySteelProductType(),
        (productType) => {
          const result1 = assignGeometricType(productType);
          const result2 = assignGeometricType(productType);

          // Same input always produces same output
          expect(result1).toBe(result2);

          // Result is always one of the valid geometric types
          expect([
            'rectangular', 'long_rectangular_bundle', 'cylindrical_bundle',
            'horizontal_coil', 'vertical_coil', 'plate_stack', 'irregular',
          ]).toContain(result1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.3
   * Contact footprint area is a positive finite number for any geometric type
   * and valid dimensions.
   */
  it('contact footprint is positive and finite for any product type with valid dimensions', () => {
    fc.assert(
      fc.property(
        arbitrarySteelOrderLineItem(),
        (item) => {
          const geometricType = assignGeometricType(item.productType);
          const geometry: FreightGeometry = {
            type: geometricType,
            boundingBox: {
              length: item.dimensions.length,
              width: item.dimensions.width,
              height: item.dimensions.height,
            },
            contactFootprint: { area: 0, shape: 'rectangle' },
            centerOfMass: {
              x: item.dimensions.length / 2,
              y: item.dimensions.width / 2,
              z: item.dimensions.height / 2,
            },
          };

          const footprint = calculateContactFootprint(geometry);

          // Footprint must be positive and finite
          expect(footprint).toBeGreaterThan(0);
          expect(Number.isFinite(footprint)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.4
   * For horizontal cylindrical items (coils), the cradle angle is computed
   * as a valid value between 0° and 90° when cradleWidth < diameter.
   */
  it('horizontal cylinders produce valid cradle angle (0° < angle < 90°)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...HORIZONTAL_COIL_TYPES),
        fc.integer({ min: 12, max: 120 }), // diameter (height field for coils)
        (productType, diameter) => {
          // Cradle width must be less than diameter for valid angle
          // Use a cradle width between 10% and 90% of diameter
          const cradleWidth = Math.max(1, Math.floor(diameter * 0.5));

          const geometricType = assignGeometricType(productType);
          expect(geometricType).toBe('horizontal_coil');

          const angle = calculateCradleAngle(diameter, cradleWidth);

          // Angle must be between 0 and 90 degrees (exclusive)
          expect(angle).toBeGreaterThan(0);
          expect(angle).toBeLessThan(90);
          expect(Number.isFinite(angle)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.4
   * Cradle angle varies correctly with cradle width: wider cradle → larger angle.
   */
  it('cradle angle increases monotonically with cradle width for fixed diameter', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 20, max: 120 }), // diameter
        (diameter) => {
          // Pick two cradle widths where w1 < w2 < diameter
          const w1 = Math.max(1, Math.floor(diameter * 0.25));
          const w2 = Math.max(w1 + 1, Math.floor(diameter * 0.75));

          if (w2 >= diameter) return; // skip edge case

          const angle1 = calculateCradleAngle(diameter, w1);
          const angle2 = calculateCradleAngle(diameter, w2);

          // Wider cradle produces larger angle
          expect(angle2).toBeGreaterThan(angle1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.4
   * Chock dimensions for horizontal coils are positive and proportional to diameter.
   */
  it('horizontal coils produce valid chock dimensions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...HORIZONTAL_COIL_TYPES),
        fc.integer({ min: 6, max: 120 }), // diameter
        (productType, diameter) => {
          const geometricType = assignGeometricType(productType);
          expect(geometricType).toBe('horizontal_coil');

          const chock = calculateChockDimensions(diameter);

          // Chock dimensions must be positive
          expect(chock.width).toBeGreaterThan(0);
          expect(chock.height).toBeGreaterThan(0);

          // Chock width = diameter / 3, height = diameter / 4
          expect(chock.width).toBeCloseTo(diameter / 3);
          expect(chock.height).toBeCloseTo(diameter / 4);

          // Chock dimensions are finite
          expect(Number.isFinite(chock.width)).toBe(true);
          expect(Number.isFinite(chock.height)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 3.1, 3.2
   * The complete pipeline (productType → geometricType → footprint) produces
   * consistent deterministic results for any order line item.
   */
  it('full pipeline (type → geometry → footprint) is deterministic', () => {
    fc.assert(
      fc.property(
        arbitrarySteelOrderLineItem(),
        (item) => {
          // Run pipeline twice
          const type1 = assignGeometricType(item.productType);
          const type2 = assignGeometricType(item.productType);

          const geom1: FreightGeometry = {
            type: type1,
            boundingBox: item.dimensions,
            contactFootprint: { area: 0, shape: 'rectangle' },
            centerOfMass: { x: 0, y: 0, z: 0 },
          };
          const geom2: FreightGeometry = {
            type: type2,
            boundingBox: item.dimensions,
            contactFootprint: { area: 0, shape: 'rectangle' },
            centerOfMass: { x: 0, y: 0, z: 0 },
          };

          const footprint1 = calculateContactFootprint(geom1);
          const footprint2 = calculateContactFootprint(geom2);

          // Both runs produce identical results
          expect(type1).toBe(type2);
          expect(footprint1).toBe(footprint2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
