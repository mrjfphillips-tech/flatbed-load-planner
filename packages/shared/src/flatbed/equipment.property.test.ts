// ─── Property-Based Tests for Equipment Validation ───────────────────────────
// Feature: flatbed-load-planner
// Validates: Requirements 1.4, 1.5, 1.6

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateTrailerProfile,
  validateTractorProfile,
  calculateEquipmentCombination,
  isPayloadValid,
} from './equipment';
import type { TractorProfile, TrailerProfile, Position2D } from './types';

// ─── Custom Generators ───────────────────────────────────────────────────────

/**
 * Generates an arbitrary valid TrailerProfile with realistic physical constraints.
 * Axle count is between 1 and 4, and axle positions/ratings arrays match the count.
 */
export function arbitraryTrailerProfile(): fc.Arbitrary<TrailerProfile> {
  return fc
    .record({
      lengthFt: fc.constantFrom(48, 53),
      deckWidthIn: fc.integer({ min: 96, max: 108 }),
      deckHeightIn: fc.integer({ min: 48, max: 72 }),
      maxGrossWeight: fc.integer({ min: 40000, max: 120000 }),
      tareWeight: fc.integer({ min: 8000, max: 25000 }),
      axleCount: fc.integer({ min: 1, max: 4 }),
      kingpinPosition: fc.integer({ min: 24, max: 48 }),
      rearOverhangLimit: fc.integer({ min: 24, max: 72 }),
      deckMaterial: fc.constantFrom('steel' as const, 'aluminum' as const, 'wood' as const),
      maxConcentratedLoadPSF: fc.integer({ min: 200, max: 1000 }),
    })
    .chain((base) => {
      // Generate axle positions and ratings that match the axle count
      const axlePositions = fc.array(fc.integer({ min: 360, max: 636 }), {
        minLength: base.axleCount,
        maxLength: base.axleCount,
      });
      const axleWeightRatings = fc.array(fc.integer({ min: 10000, max: 50000 }), {
        minLength: base.axleCount,
        maxLength: base.axleCount,
      });

      return fc.record({
        axlePositions,
        axleWeightRatings,
      }).map((arrays) => ({
        id: `trailer-${base.lengthFt}`,
        name: `Test ${base.lengthFt}ft Flatbed`,
        lengthFt: base.lengthFt,
        deckWidthIn: base.deckWidthIn,
        deckHeightIn: base.deckHeightIn,
        maxGrossWeight: base.maxGrossWeight,
        tareWeight: base.tareWeight,
        axleCount: base.axleCount,
        axlePositions: arrays.axlePositions.sort((a, b) => a - b),
        axleWeightRatings: arrays.axleWeightRatings,
        kingpinPosition: base.kingpinPosition,
        rearOverhangLimit: base.rearOverhangLimit,
        deckMaterial: base.deckMaterial,
        stakePockets: [] as Position2D[],
        anchorPoints: [] as Position2D[],
        maxConcentratedLoadPSF: base.maxConcentratedLoadPSF,
      }));
    });
}

/**
 * Generates an arbitrary valid TractorProfile with positive weight ratings.
 */
export function arbitraryTractorProfile(): fc.Arbitrary<TractorProfile> {
  return fc.record({
    steerAxleRating: fc.integer({ min: 8000, max: 20000 }),
    driveAxleRating: fc.integer({ min: 20000, max: 50000 }),
    fifthWheelPosition: fc.integer({ min: 180, max: 300 }),
    tareWeight: fc.integer({ min: 12000, max: 30000 }),
    driveAxleCount: fc.constantFrom(1, 2),
  }).map((base) => ({
    id: `tractor-test`,
    name: `Test Day Cab`,
    ...base,
  }));
}

// ─── Property 1: Equipment Payload Calculation Consistency ───────────────────
// For any valid tractor-trailer combination, available payload =
// totalLegalGross − tractorTare − trailerTare; negative payload rejects combination.

describe('Feature: flatbed-load-planner, Property 1: Equipment payload calculation consistency', () => {
  it('availablePayload = totalLegalGross − tractorTare − trailerTare for any combination', () => {
    fc.assert(
      fc.property(
        arbitraryTractorProfile(),
        arbitraryTrailerProfile(),
        (tractor, trailer) => {
          const combo = calculateEquipmentCombination(tractor, trailer);

          // Core invariant: payload = totalLegalGross - tractorTare - trailerTare
          const expectedPayload = combo.totalLegalGross - tractor.tareWeight - trailer.tareWeight;
          expect(combo.availablePayload).toBe(expectedPayload);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 1.5
   */
  it('totalLegalGross is consistent regardless of selection order', () => {
    fc.assert(
      fc.property(
        arbitraryTractorProfile(),
        arbitraryTrailerProfile(),
        (tractor, trailer) => {
          const combo1 = calculateEquipmentCombination(tractor, trailer);
          const combo2 = calculateEquipmentCombination(tractor, trailer);

          expect(combo1.availablePayload).toBe(combo2.availablePayload);
          expect(combo1.totalLegalGross).toBe(combo2.totalLegalGross);
          expect(combo1.perAxleLimits).toEqual(combo2.perAxleLimits);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 1.6
   */
  it('negative payload rejects combination (isPayloadValid returns false)', () => {
    fc.assert(
      fc.property(
        arbitraryTractorProfile(),
        arbitraryTrailerProfile(),
        (tractor, trailer) => {
          const combo = calculateEquipmentCombination(tractor, trailer);

          if (combo.availablePayload < 0) {
            expect(isPayloadValid(combo)).toBe(false);
          } else {
            expect(isPayloadValid(combo)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 1.5
   * totalLegalGross is limited by min(trailer.maxGrossWeight, sum of all axle ratings)
   */
  it('totalLegalGross ≤ trailer.maxGrossWeight and ≤ sum of all axle ratings', () => {
    fc.assert(
      fc.property(
        arbitraryTractorProfile(),
        arbitraryTrailerProfile(),
        (tractor, trailer) => {
          const combo = calculateEquipmentCombination(tractor, trailer);

          const trailerAxleSum = trailer.axleWeightRatings.reduce((s, r) => s + r, 0);
          const axleBasedGross = tractor.steerAxleRating + tractor.driveAxleRating + trailerAxleSum;

          expect(combo.totalLegalGross).toBeLessThanOrEqual(trailer.maxGrossWeight);
          expect(combo.totalLegalGross).toBeLessThanOrEqual(axleBasedGross);
          expect(combo.totalLegalGross).toBe(Math.min(trailer.maxGrossWeight, axleBasedGross));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 2: Trailer Profile Axle Rating Validation ──────────────────────
// Profile accepted iff sum(axleRatings) ≥ (maxGross − tare)

describe('Feature: flatbed-load-planner, Property 2: Trailer profile axle rating validation', () => {
  /**
   * Validates: Requirements 1.4
   */
  it('profile is valid iff sum(axleRatings) ≥ (maxGrossWeight − tareWeight)', () => {
    fc.assert(
      fc.property(
        arbitraryTrailerProfile(),
        (trailer) => {
          const result = validateTrailerProfile(trailer);
          const axleSum = trailer.axleWeightRatings.reduce((s, r) => s + r, 0);
          const requiredCapacity = trailer.maxGrossWeight - trailer.tareWeight;

          if (axleSum >= requiredCapacity) {
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
          } else {
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 1.4
   * Boundary case: when sum exactly equals required capacity, profile is accepted.
   */
  it('profile is accepted when axle ratings sum exactly equals required capacity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 40000, max: 120000 }),
        fc.integer({ min: 8000, max: 25000 }),
        fc.integer({ min: 1, max: 4 }),
        (maxGross, tare, axleCount) => {
          // Construct a trailer where sum(axleRatings) = maxGross - tare exactly
          const requiredCapacity = maxGross - tare;
          if (requiredCapacity <= 0) return; // skip degenerate case

          // Distribute capacity evenly across axles
          const baseRating = Math.floor(requiredCapacity / axleCount);
          const remainder = requiredCapacity - baseRating * axleCount;
          const axleWeightRatings = Array(axleCount).fill(baseRating);
          axleWeightRatings[0] += remainder; // put remainder on first axle

          const trailer: TrailerProfile = {
            id: 'test-boundary',
            name: 'Boundary Test',
            lengthFt: 53,
            deckWidthIn: 102,
            deckHeightIn: 60,
            maxGrossWeight: maxGross,
            tareWeight: tare,
            axleCount,
            axlePositions: Array(axleCount).fill(0).map((_, i) => 400 + i * 48),
            axleWeightRatings,
            kingpinPosition: 36,
            rearOverhangLimit: 48,
            deckMaterial: 'steel',
            stakePockets: [],
            anchorPoints: [],
            maxConcentratedLoadPSF: 500,
          };

          const result = validateTrailerProfile(trailer);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 1.4
   * When axle ratings are insufficient, validation provides an error.
   */
  it('profile is rejected when axle ratings sum is below required capacity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 40000, max: 120000 }),
        fc.integer({ min: 8000, max: 25000 }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 10000 }),
        (maxGross, tare, axleCount, deficit) => {
          // Construct a trailer where sum(axleRatings) = requiredCapacity - deficit
          const requiredCapacity = maxGross - tare;
          if (requiredCapacity <= deficit) return; // skip if deficit would make ratings negative

          const insufficientCapacity = requiredCapacity - deficit;
          const baseRating = Math.floor(insufficientCapacity / axleCount);
          const remainder = insufficientCapacity - baseRating * axleCount;
          const axleWeightRatings = Array(axleCount).fill(baseRating);
          axleWeightRatings[0] += remainder;

          const trailer: TrailerProfile = {
            id: 'test-deficit',
            name: 'Deficit Test',
            lengthFt: 48,
            deckWidthIn: 102,
            deckHeightIn: 60,
            maxGrossWeight: maxGross,
            tareWeight: tare,
            axleCount,
            axlePositions: Array(axleCount).fill(0).map((_, i) => 400 + i * 48),
            axleWeightRatings,
            kingpinPosition: 36,
            rearOverhangLimit: 48,
            deckMaterial: 'steel',
            stakePockets: [],
            anchorPoints: [],
            maxConcentratedLoadPSF: 500,
          };

          const result = validateTrailerProfile(trailer);
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
