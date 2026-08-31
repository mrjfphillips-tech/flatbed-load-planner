// ─── Property-Based Tests for Weight Calculator ─────────────────────────────
// Feature: flatbed-load-planner
// Property 6: Weight metrics conservation invariant
// Validates: Requirements 6.1, 6.2, 6.6, 11.5

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateWeightMetrics } from './weight';
import { calculateEquipmentCombination } from './equipment';
import { assignGeometricType, calculateContactFootprint } from './geometry';
import { arbitraryTrailerProfile, arbitraryTractorProfile } from './equipment.property.test';
import { arbitrarySteelOrderLineItem } from './geometry.property.test';
import type {
  PlacedFreight,
  TrailerProfile,
  TractorProfile,
  EquipmentCombination,
  FreightGeometry,
  Orientation,
  SupportMethod,
  SteelOrderLineItem,
} from './types';

// ─── Custom Generators ───────────────────────────────────────────────────────

/**
 * Generates an arbitrary PlacedFreight item positioned within valid deck bounds
 * of the given trailer. The position is constrained so the item fits on the deck.
 *
 * @param trailer - The trailer profile defining deck boundaries
 */
export function arbitraryPlacedFreight(trailer: TrailerProfile): fc.Arbitrary<PlacedFreight> {
  const deckLengthIn = trailer.lengthFt * 12;
  const deckWidthIn = trailer.deckWidthIn;

  return arbitrarySteelOrderLineItem().chain((item) => {
    const geometricType = assignGeometricType(item.productType);

    // Get bounding box dimensions based on orientation
    const itemLength = item.dimensions.length;
    const itemWidth = item.dimensions.width;
    const itemHeight = item.dimensions.height;

    // Constrain position so item fits within deck bounds
    const maxX = Math.max(0, deckLengthIn - itemLength);
    const maxY = Math.max(0, deckWidthIn - itemWidth);

    return fc
      .record({
        posX: fc.integer({ min: 0, max: Math.max(1, maxX) }),
        posY: fc.integer({ min: 0, max: Math.max(1, maxY) }),
        orientation: fc.constantFrom('longitudinal' as Orientation, 'transverse' as Orientation),
        supportMethod: fc.constantFrom(
          'direct_to_deck' as SupportMethod,
          'on_dunnage' as SupportMethod
        ),
      })
      .map((placement) => {
        const geometry: FreightGeometry = {
          type: geometricType,
          boundingBox: { length: itemLength, width: itemWidth, height: itemHeight },
          contactFootprint: {
            area: itemLength * itemWidth, // simplified rectangular footprint
            shape: 'rectangle',
          },
          centerOfMass: {
            x: itemLength / 2,
            y: itemWidth / 2,
            z: itemHeight / 2,
          },
        };

        return {
          item,
          geometry,
          position: { x: placement.posX, y: placement.posY, z: 0 },
          orientation: placement.orientation,
          supportMethod: placement.supportMethod,
          layer: 0,
        } satisfies PlacedFreight;
      });
  });
}

/**
 * Generates a list of 1–5 placed freight items within valid deck bounds of a trailer.
 */
function arbitraryPlacedFreightList(trailer: TrailerProfile): fc.Arbitrary<PlacedFreight[]> {
  return fc.array(arbitraryPlacedFreight(trailer), { minLength: 1, maxLength: 5 });
}

// ─── Property 6: Weight metrics conservation invariant ───────────────────────
// For any set of placed freight items on a valid equipment combination:
// sum(axle weights) = totalGross = tractorTare + trailerTare + sum(freightWeights)
// This invariant holds after initial generation and after any manual adjustment.

describe('Feature: flatbed-load-planner, Property 6: Weight metrics conservation invariant', () => {
  /**
   * **Validates: Requirements 6.1, 6.2**
   *
   * The sum of all axle group weights (steer + drive + trailer) SHALL equal the
   * total gross vehicle weight for any set of placed freight.
   */
  it('sum(steerWeight + driveWeight + trailerWeight) = totalGross for any freight configuration', () => {
    fc.assert(
      fc.property(
        arbitraryTractorProfile(),
        arbitraryTrailerProfile(),
        (tractor, trailer) => {
          const equipment = calculateEquipmentCombination(tractor, trailer);

          // Generate placed freight within this specific trailer's bounds
          return fc.assert(
            fc.property(
              fc.array(arbitraryPlacedFreight(trailer), { minLength: 0, maxLength: 5 }),
              (placedFreight) => {
                const metrics = calculateWeightMetrics(placedFreight, equipment, trailer, tractor);

                const axleSum = metrics.steerWeight + metrics.driveWeight + metrics.trailerWeight;

                // Conservation: axle sum = totalGross
                expect(axleSum).toBeCloseTo(metrics.totalGross, 5);
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
   * **Validates: Requirements 6.1, 6.6**
   *
   * totalGross SHALL equal tractorTare + trailerTare + sum(freight weights)
   * for any valid equipment and freight configuration.
   */
  it('totalGross = tractorTare + trailerTare + sum(freightWeights) for any configuration', () => {
    fc.assert(
      fc.property(
        arbitraryTractorProfile(),
        arbitraryTrailerProfile(),
        (tractor, trailer) => {
          const equipment = calculateEquipmentCombination(tractor, trailer);

          return fc.assert(
            fc.property(
              fc.array(arbitraryPlacedFreight(trailer), { minLength: 0, maxLength: 5 }),
              (placedFreight) => {
                const metrics = calculateWeightMetrics(placedFreight, equipment, trailer, tractor);

                const totalFreightWeight = placedFreight.reduce(
                  (sum, f) => sum + f.item.pieceWeight * f.item.quantity,
                  0
                );

                const expectedGross = tractor.tareWeight + trailer.tareWeight + totalFreightWeight;

                // Conservation: totalGross = tractor tare + trailer tare + freight
                expect(metrics.totalGross).toBeCloseTo(expectedGross, -1);
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
   * **Validates: Requirements 6.1, 6.2, 6.6**
   *
   * The full conservation chain:
   * sum(axle weights) = totalGross = tractorTare + trailerTare + sum(freightWeights)
   * This is the complete invariant stated in Property 6.
   */
  it('full conservation: sum(axleWeights) = totalGross = tractorTare + trailerTare + sum(freightWeights)', () => {
    fc.assert(
      fc.property(
        arbitraryTractorProfile(),
        arbitraryTrailerProfile(),
        (tractor, trailer) => {
          const equipment = calculateEquipmentCombination(tractor, trailer);

          return fc.assert(
            fc.property(
              fc.array(arbitraryPlacedFreight(trailer), { minLength: 1, maxLength: 5 }),
              (placedFreight) => {
                const metrics = calculateWeightMetrics(placedFreight, equipment, trailer, tractor);

                // Left side of chain: sum of axle weights
                const axleSum = metrics.steerWeight + metrics.driveWeight + metrics.trailerWeight;

                // Right side of chain: tare weights + freight
                const totalFreightWeight = placedFreight.reduce(
                  (sum, f) => sum + f.item.pieceWeight * f.item.quantity,
                  0
                );
                const expectedGross = tractor.tareWeight + trailer.tareWeight + totalFreightWeight;

                // Full conservation chain
                expect(axleSum).toBeCloseTo(metrics.totalGross, 5);
                expect(metrics.totalGross).toBeCloseTo(expectedGross, -1);
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
   * **Validates: Requirements 11.5**
   *
   * The conservation invariant holds after any placement change (simulated by
   * generating different freight configurations from the same equipment).
   * After removing an item, the invariant still holds.
   */
  it('invariant holds after removing an item (simulating manual adjustment)', () => {
    fc.assert(
      fc.property(
        arbitraryTractorProfile(),
        arbitraryTrailerProfile(),
        (tractor, trailer) => {
          const equipment = calculateEquipmentCombination(tractor, trailer);

          return fc.assert(
            fc.property(
              fc.array(arbitraryPlacedFreight(trailer), { minLength: 2, maxLength: 5 }),
              fc.nat(),
              (placedFreight, removeIndexSeed) => {
                // Calculate metrics with all items
                const metricsBefore = calculateWeightMetrics(placedFreight, equipment, trailer, tractor);
                const axleSumBefore = metricsBefore.steerWeight + metricsBefore.driveWeight + metricsBefore.trailerWeight;
                expect(axleSumBefore).toBeCloseTo(metricsBefore.totalGross, 5);

                // Remove one item (simulating manual removal)
                const removeIndex = removeIndexSeed % placedFreight.length;
                const reducedFreight = placedFreight.filter((_, i) => i !== removeIndex);

                // Calculate metrics after removal
                const metricsAfter = calculateWeightMetrics(reducedFreight, equipment, trailer, tractor);
                const axleSumAfter = metricsAfter.steerWeight + metricsAfter.driveWeight + metricsAfter.trailerWeight;

                // Conservation still holds after removal
                expect(axleSumAfter).toBeCloseTo(metricsAfter.totalGross, 5);

                const remainingFreightWeight = reducedFreight.reduce(
                  (sum, f) => sum + f.item.pieceWeight * f.item.quantity,
                  0
                );
                const expectedGross = tractor.tareWeight + trailer.tareWeight + remainingFreightWeight;
                expect(metricsAfter.totalGross).toBeCloseTo(expectedGross, -1);
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
   * **Validates: Requirements 11.5**
   *
   * The conservation invariant holds after repositioning an item on the deck
   * (simulating drag-and-drop adjustment). Total weight doesn't change, only distribution.
   */
  it('invariant holds after repositioning an item (simulating position swap)', () => {
    fc.assert(
      fc.property(
        arbitraryTractorProfile(),
        arbitraryTrailerProfile(),
        (tractor, trailer) => {
          const equipment = calculateEquipmentCombination(tractor, trailer);
          const deckLengthIn = trailer.lengthFt * 12;

          return fc.assert(
            fc.property(
              fc.array(arbitraryPlacedFreight(trailer), { minLength: 1, maxLength: 4 }),
              fc.integer({ min: 0, max: Math.max(1, deckLengthIn - 10) }),
              fc.integer({ min: 0, max: Math.max(1, trailer.deckWidthIn - 10) }),
              (placedFreight, newX, newY) => {
                // Calculate metrics before repositioning
                const metricsBefore = calculateWeightMetrics(placedFreight, equipment, trailer, tractor);

                // Reposition first item (simulating manual drag)
                const movedFreight = placedFreight.map((f, i) =>
                  i === 0 ? { ...f, position: { ...f.position, x: newX, y: newY } } : f
                );

                // Calculate metrics after repositioning
                const metricsAfter = calculateWeightMetrics(movedFreight, equipment, trailer, tractor);

                // totalGross remains the same (only distribution changes)
                const totalFreightWeight = placedFreight.reduce(
                  (sum, f) => sum + f.item.pieceWeight * f.item.quantity,
                  0
                );
                const expectedGross = tractor.tareWeight + trailer.tareWeight + totalFreightWeight;

                // Conservation holds before and after
                expect(metricsBefore.totalGross).toBeCloseTo(expectedGross, -1);
                expect(metricsAfter.totalGross).toBeCloseTo(expectedGross, -1);

                // Axle sum still equals totalGross after move
                const axleSumAfter = metricsAfter.steerWeight + metricsAfter.driveWeight + metricsAfter.trailerWeight;
                expect(axleSumAfter).toBeCloseTo(metricsAfter.totalGross, 5);
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
