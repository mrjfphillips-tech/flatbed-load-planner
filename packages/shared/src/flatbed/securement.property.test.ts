// ─── Property-Based Tests for Securement Planner ─────────────────────────────
// Feature: flatbed-load-planner
// Property 12: Securement FMCSA compliance
// Validates: Requirements 9.1, 9.3, 9.4, 9.5

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  calculateMinTieDowns,
  calculateRequiredWLL,
  generateItemSecurementPlan,
  assignSecurement,
  isCoilProduct,
} from './securement';
import { arbitraryTrailerProfile } from './equipment.property.test';
import { arbitrarySteelOrderLineItem } from './geometry.property.test';
import { arbitraryPlacedFreight } from './weight.property.test';
import { assignGeometricType } from './geometry';
import type {
  PlacedFreight,
  TrailerProfile,
  FreightGeometry,
  Position2D,
  SteelProductType,
} from './types';

// ─── Custom Generators ───────────────────────────────────────────────────────

/** All coil product types for targeted testing */
const COIL_PRODUCT_TYPES: SteelProductType[] = [
  'coil_hot_rolled',
  'coil_cold_rolled',
  'coil_galvanized',
  'wire_rod_coil',
];

/**
 * Generates a TrailerProfile with a sufficient number of anchor points
 * to avoid overflow issues in property tests (tests anchor validity, not overflow).
 */
function arbitraryTrailerWithAnchorPoints(): fc.Arbitrary<TrailerProfile> {
  return arbitraryTrailerProfile().map((trailer) => {
    // Generate ample anchor points distributed along the trailer
    const deckLengthIn = trailer.lengthFt * 12;
    const anchorCount = 40; // enough for most loads
    const anchorPoints: Position2D[] = [];
    for (let i = 0; i < anchorCount; i++) {
      anchorPoints.push({
        x: (deckLengthIn / (anchorCount + 1)) * (i + 1),
        y: i % 2 === 0 ? -(trailer.deckWidthIn / 2 - 6) : (trailer.deckWidthIn / 2 - 6),
      });
    }
    return { ...trailer, anchorPoints };
  });
}

/**
 * Generates a PlacedFreight item specifically for a coil product type,
 * constrained to a valid trailer deck position.
 */
function arbitraryCoilPlacedFreight(trailer: TrailerProfile): fc.Arbitrary<PlacedFreight> {
  const deckLengthIn = trailer.lengthFt * 12;
  const deckWidthIn = trailer.deckWidthIn;

  return fc
    .record({
      productType: fc.constantFrom(...COIL_PRODUCT_TYPES),
      orderNumber: fc.stringMatching(/^ORD-[0-9]{4,8}$/),
      totalLineWeight: fc.integer({ min: 5000, max: 60000 }),
      diameter: fc.integer({ min: 24, max: 72 }), // coil outer diameter in inches
      width: fc.integer({ min: 12, max: 72 }),     // coil width (eye depth)
    })
    .map((params) => {
      const itemLength = params.diameter; // bounding box length = diameter for coils
      const itemWidth = params.width;
      const itemHeight = params.diameter;

      const maxX = Math.max(0, deckLengthIn - itemLength);
      const maxY = Math.max(0, deckWidthIn - itemWidth);

      const geometry: FreightGeometry = {
        type: 'horizontal_coil',
        boundingBox: { length: itemLength, width: itemWidth, height: itemHeight },
        contactFootprint: { area: itemLength * itemWidth * 0.3, shape: 'rectangle' },
        centerOfMass: { x: itemLength / 2, y: itemWidth / 2, z: itemHeight / 2 },
        cradleAngle: 45,
        chockDimensions: { width: params.diameter / 3, height: params.diameter / 4 },
      };

      return {
        item: {
          orderNumber: params.orderNumber,
          customerName: 'Test Customer',
          deliveryStop: 1,
          productType: params.productType,
          quantity: 1,
          pieceWeight: params.totalLineWeight,
          dimensions: { length: itemLength, width: itemWidth, height: itemHeight },
          totalLineWeight: params.totalLineWeight,
          handlingMethod: 'crane' as const,
          stackPermission: 'no' as const,
          maxStackHeight: 72,
          maxStackWeight: 0,
          orientationRequirement: 'longitudinal' as const,
          dunnageRequired: false,
          specialNotes: '',
        },
        geometry,
        position: { x: Math.min(maxX, 100), y: Math.min(maxY, 20), z: 0 },
        orientation: 'longitudinal' as const,
        supportMethod: 'direct_to_deck' as const,
        layer: 0,
      } satisfies PlacedFreight;
    });
}

// ─── Property 12: Securement FMCSA compliance ────────────────────────────────
// For any placed freight item with length L and weight W:
// - tieDowns ≥ max(2, ceil(L/120))
// - aggregate WLL ≥ 50% of W
// - each tie-down references a valid anchor point (when assigned via assignSecurement)
// - coil items have coil-specific securement

describe('Feature: flatbed-load-planner, Property 12: Securement FMCSA compliance', () => {
  /**
   * **Validates: Requirements 9.1**
   *
   * For any item with length L, the number of tie-downs SHALL be at least
   * max(2, ceil(L / 120)). This validates the FMCSA minimum tie-down count formula.
   */
  it('tie-down count ≥ max(2, ceil(L/120)) for any item length and weight', () => {
    fc.assert(
      fc.property(
        arbitraryTrailerWithAnchorPoints(),
        (trailer) => {
          return fc.assert(
            fc.property(
              arbitraryPlacedFreight(trailer),
              (freight) => {
                const plan = generateItemSecurementPlan(freight);
                const itemLength = freight.geometry.boundingBox.length;
                const expectedMinTieDowns = Math.max(2, Math.ceil(itemLength / 120));

                expect(plan.tieDowns.length).toBeGreaterThanOrEqual(expectedMinTieDowns);
              }
            ),
            { numRuns: 20 }
          );
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * **Validates: Requirements 9.3**
   *
   * For any item with weight W, the aggregate WLL of all tie-downs SHALL be
   * ≥ 50% of W. This validates the FMCSA aggregate working load limit rule.
   */
  it('aggregate WLL ≥ 50% of cargo weight for any item', () => {
    fc.assert(
      fc.property(
        arbitraryTrailerWithAnchorPoints(),
        (trailer) => {
          return fc.assert(
            fc.property(
              arbitraryPlacedFreight(trailer),
              (freight) => {
                const plan = generateItemSecurementPlan(freight);
                const itemWeight = freight.item.totalLineWeight;
                const requiredWLL = calculateRequiredWLL(itemWeight);

                expect(plan.aggregateWLL).toBeGreaterThanOrEqual(requiredWLL);
                expect(plan.meetsRequirements).toBe(true);
              }
            ),
            { numRuns: 20 }
          );
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * **Validates: Requirements 9.5**
   *
   * Each tie-down SHALL reference a valid anchor point on the trailer when
   * securement is assigned through the full assignSecurement pipeline.
   */
  it('each tie-down references a valid anchor point when assigned via full pipeline', () => {
    fc.assert(
      fc.property(
        arbitraryTrailerWithAnchorPoints(),
        (trailer) => {
          return fc.assert(
            fc.property(
              fc.array(arbitraryPlacedFreight(trailer), { minLength: 1, maxLength: 3 }),
              (placedFreight) => {
                const assignment = assignSecurement(placedFreight, trailer);

                // When not in overflow, every tie-down should have a valid anchor point
                if (!assignment.hasOverflow) {
                  for (const plan of assignment.plans) {
                    for (const tieDown of plan.tieDowns) {
                      expect(tieDown.anchorPointId).toBeDefined();
                      expect(tieDown.anchorPointId).toMatch(/^anchor-\d+$/);

                      // Verify the anchor index is within range of available anchor points
                      const anchorIndex = parseInt(tieDown.anchorPointId!.replace('anchor-', ''));
                      expect(anchorIndex).toBeGreaterThanOrEqual(0);
                      expect(anchorIndex).toBeLessThan(trailer.anchorPoints.length);
                    }
                  }
                }
              }
            ),
            { numRuns: 20 }
          );
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * **Validates: Requirements 9.4**
   *
   * Coil items SHALL have coil-specific securement: the plan must include
   * coil_rack, chock, and blocking in additionalSecurement, and notes must
   * reference chain through eye, blocking fore/aft, and chocking.
   */
  it('coil items have coil-specific securement (coil_rack, blocking, chocking)', () => {
    fc.assert(
      fc.property(
        arbitraryTrailerWithAnchorPoints(),
        (trailer) => {
          return fc.assert(
            fc.property(
              arbitraryCoilPlacedFreight(trailer),
              (coilFreight) => {
                const plan = generateItemSecurementPlan(coilFreight);

                // Coil-specific additional securement must be present
                expect(plan.additionalSecurement).toContain('coil_rack');
                expect(plan.additionalSecurement).toContain('chock');
                expect(plan.additionalSecurement).toContain('blocking');

                // Notes must include coil-specific instructions
                const allNotes = plan.notes.join(' ').toLowerCase();
                expect(allNotes).toContain('chain');
                expect(allNotes).toContain('blocking');
                expect(allNotes).toContain('chock');

                // Primary securement type must be chain for coils
                expect(plan.tieDowns.every((td) => td.type === 'chain')).toBe(true);
              }
            ),
            { numRuns: 20 }
          );
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * **Validates: Requirements 9.1, 9.3**
   *
   * Combined invariant: for any single item, the securement plan simultaneously
   * satisfies both the tie-down count requirement AND the aggregate WLL requirement.
   * This ensures the implementation correctly takes the max of both constraints.
   */
  it('securement plan satisfies both tie-down count AND WLL requirements simultaneously', () => {
    fc.assert(
      fc.property(
        arbitraryTrailerWithAnchorPoints(),
        (trailer) => {
          return fc.assert(
            fc.property(
              arbitraryPlacedFreight(trailer),
              (freight) => {
                const plan = generateItemSecurementPlan(freight);
                const itemLength = freight.geometry.boundingBox.length;
                const itemWeight = freight.item.totalLineWeight;

                // FMCSA tie-down count
                const minTieDowns = Math.max(2, Math.ceil(itemLength / 120));
                expect(plan.tieDowns.length).toBeGreaterThanOrEqual(minTieDowns);

                // FMCSA WLL rule
                const requiredWLL = itemWeight * 0.5;
                expect(plan.aggregateWLL).toBeGreaterThanOrEqual(requiredWLL);

                // The plan reports correct compliance status
                expect(plan.meetsRequirements).toBe(true);
              }
            ),
            { numRuns: 20 }
          );
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * **Validates: Requirements 9.1, 9.3, 9.4, 9.5**
   *
   * Full compliance check across multiple items via assignSecurement:
   * every item in the load meets all FMCSA requirements simultaneously.
   */
  it('full load securement assignment meets all FMCSA requirements for every item', () => {
    fc.assert(
      fc.property(
        arbitraryTrailerWithAnchorPoints(),
        (trailer) => {
          return fc.assert(
            fc.property(
              fc.array(arbitraryPlacedFreight(trailer), { minLength: 1, maxLength: 4 }),
              (placedFreight) => {
                const assignment = assignSecurement(placedFreight, trailer);

                for (let i = 0; i < assignment.plans.length; i++) {
                  const plan = assignment.plans[i];
                  const freight = placedFreight[i];
                  const itemLength = freight.geometry.boundingBox.length;
                  const itemWeight = freight.item.totalLineWeight;

                  // Req 9.1: Tie-down count
                  const minTieDowns = Math.max(2, Math.ceil(itemLength / 120));
                  expect(plan.tieDowns.length).toBeGreaterThanOrEqual(minTieDowns);

                  // Req 9.3: WLL requirement
                  expect(plan.aggregateWLL).toBeGreaterThanOrEqual(itemWeight * 0.5);
                  expect(plan.meetsRequirements).toBe(true);

                  // Req 9.5: Valid anchor point references (when not overflowing)
                  if (!assignment.hasOverflow) {
                    for (const tieDown of plan.tieDowns) {
                      expect(tieDown.anchorPointId).toBeDefined();
                      const idx = parseInt(tieDown.anchorPointId!.replace('anchor-', ''));
                      expect(idx).toBeGreaterThanOrEqual(0);
                      expect(idx).toBeLessThan(trailer.anchorPoints.length);
                    }
                  }

                  // Req 9.4: Coil-specific securement
                  if (isCoilProduct(freight.item.productType)) {
                    expect(plan.additionalSecurement).toContain('coil_rack');
                    expect(plan.additionalSecurement).toContain('chock');
                    expect(plan.additionalSecurement).toContain('blocking');
                  }
                }
              }
            ),
            { numRuns: 20 }
          );
        }
      ),
      { numRuns: 5 }
    );
  });
});
