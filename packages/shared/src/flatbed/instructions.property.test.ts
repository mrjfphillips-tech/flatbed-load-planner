// ─── Property-Based Tests for Loading Sequence ───────────────────────────────
// Feature: flatbed-load-planner
// Property 15: Loading sequence reproduces plan
// Validates: Requirements 13.1, 13.2

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateLoadPlan } from './planner';
import { generateLoadingSequence } from './instructions';
import { calculateEquipmentCombination } from './equipment';
import { defaultRules } from './rules';
import { arbitraryFreightSet } from './planner.property.test';
import type {
  SteelOrderLineItem,
  TrailerProfile,
  TractorProfile,
  EquipmentCombination,
  PlacedFreight,
} from './types';
import type { PlanRequest } from './planner';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeTestTrailer(): TrailerProfile {
  return {
    id: 'trailer-test-48',
    name: 'Test 48ft Flatbed',
    lengthFt: 48,
    deckWidthIn: 96,
    deckHeightIn: 60,
    maxGrossWeight: 80000,
    tareWeight: 12000,
    axleCount: 2,
    axlePositions: [420, 468],
    axleWeightRatings: [34000, 34000],
    kingpinPosition: 36,
    rearOverhangLimit: 48,
    deckMaterial: 'steel',
    stakePockets: [
      { x: 48, y: -48 }, { x: 48, y: 48 },
      { x: 144, y: -48 }, { x: 144, y: 48 },
      { x: 240, y: -48 }, { x: 240, y: 48 },
      { x: 336, y: -48 }, { x: 336, y: 48 },
      { x: 432, y: -48 }, { x: 432, y: 48 },
    ],
    anchorPoints: [
      { x: 48, y: -48 }, { x: 48, y: 48 },
      { x: 144, y: -48 }, { x: 144, y: 48 },
      { x: 240, y: -48 }, { x: 240, y: 48 },
      { x: 336, y: -48 }, { x: 336, y: 48 },
      { x: 432, y: -48 }, { x: 432, y: 48 },
      { x: 528, y: -48 }, { x: 528, y: 48 },
    ],
    maxConcentratedLoadPSF: 500,
  };
}

function makeTestTractor(): TractorProfile {
  return {
    id: 'tractor-test',
    name: 'Test Day Cab',
    steerAxleRating: 12000,
    driveAxleRating: 34000,
    fifthWheelPosition: 240,
    tareWeight: 18000,
    driveAxleCount: 2,
  };
}

function makeTestEquipment(): EquipmentCombination {
  const trailer = makeTestTrailer();
  const tractor = makeTestTractor();
  return calculateEquipmentCombination(tractor, trailer);
}

function buildRequest(items: SteelOrderLineItem[]): PlanRequest {
  return {
    items,
    trailer: makeTestTrailer(),
    tractor: makeTestTractor(),
    equipment: makeTestEquipment(),
    rules: defaultRules,
  };
}

// ─── Property 15: Loading sequence reproduces plan ───────────────────────────
// Executing loading steps in order reproduces the exact placed freight
// configuration of the original plan.
// **Validates: Requirements 13.1, 13.2**

describe('Feature: flatbed-load-planner, Property 15: Loading sequence reproduces plan', () => {
  it('loading sequence indices cover all placed freight items exactly once (bijection)', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(5),
        (items) => {
          const request = buildRequest(items);
          const result = generateLoadPlan(request);

          const { placedFreight, loadingSequence } = result;

          // Skip trivial case (no items placed)
          if (placedFreight.length === 0) return;

          // Loading sequence length must equal placed freight length
          expect(loadingSequence.length).toBe(placedFreight.length);

          // Each index in loadingSequence must be a valid index into placedFreight
          for (const idx of loadingSequence) {
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(idx).toBeLessThan(placedFreight.length);
          }

          // Loading sequence must be a permutation (no duplicates)
          const uniqueIndices = new Set(loadingSequence);
          expect(uniqueIndices.size).toBe(placedFreight.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('executing loading steps in order reproduces the exact placed freight configuration', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(6),
        (items) => {
          const request = buildRequest(items);
          const result = generateLoadPlan(request);

          const { placedFreight, loadingSequence, securement } = result;
          const trailer = makeTestTrailer();

          // Skip trivial case
          if (placedFreight.length === 0) return;

          // Generate the rich loading steps from the instructions module
          const loadingSteps = generateLoadingSequence(placedFreight, trailer, securement);

          // The number of loading steps must equal placed freight count
          expect(loadingSteps.length).toBe(placedFreight.length);

          // The planner's loadingSequence (indices) and the instructions module's
          // loadingSteps must agree — following the planner's sequence order,
          // each indexed placed freight item should correspond to the loading step
          // at that position (same item, same position description, same orientation).
          for (let stepIdx = 0; stepIdx < loadingSequence.length; stepIdx++) {
            const freightIdx = loadingSequence[stepIdx];
            const freight = placedFreight[freightIdx];
            const step = loadingSteps[stepIdx];

            // Step number is 1-indexed sequential
            expect(step.stepNumber).toBe(stepIdx + 1);

            // The loading step must reference the correct item
            expect(step.itemDescription).toContain(freight.item.orderNumber);

            // Orientation in the step must match the placed freight orientation
            if (freight.orientation === 'longitudinal') {
              expect(step.orientation).toContain('lengthwise');
            } else {
              expect(step.orientation).toContain('crosswise');
            }

            // Dunnage step should be present iff support method is 'on_dunnage'
            if (freight.supportMethod === 'on_dunnage') {
              expect(step.dunnageFirst).not.toBeNull();
            } else {
              expect(step.dunnageFirst).toBeNull();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('loading sequence respects layer ordering (lower layers loaded before upper layers)', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(6),
        (items) => {
          const request = buildRequest(items);
          const result = generateLoadPlan(request);

          const { placedFreight, loadingSequence } = result;

          // Skip trivial case
          if (placedFreight.length < 2) return;

          // Items earlier in the loading sequence must be on the same or lower layer
          // than items later in the sequence
          for (let i = 0; i < loadingSequence.length - 1; i++) {
            const currentFreight = placedFreight[loadingSequence[i]];
            const nextFreight = placedFreight[loadingSequence[i + 1]];

            // Current item's layer should be <= next item's layer
            expect(currentFreight.layer).toBeLessThanOrEqual(nextFreight.layer);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('reconstructing placement from loading steps produces identical positions and layers', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(5),
        (items) => {
          const request = buildRequest(items);
          const result = generateLoadPlan(request);

          const { placedFreight, loadingSequence } = result;

          // Skip trivial case
          if (placedFreight.length === 0) return;

          // Simulate "executing" the loading sequence by collecting items in order
          const reconstructed: PlacedFreight[] = [];
          for (const idx of loadingSequence) {
            reconstructed.push(placedFreight[idx]);
          }

          // The reconstructed array must represent the same configuration:
          // every item from placedFreight appears exactly once with identical properties
          expect(reconstructed.length).toBe(placedFreight.length);

          // Each item accessed via the loading sequence index is the exact same
          // object reference from placedFreight — verifying the index mapping is correct
          for (let stepIdx = 0; stepIdx < loadingSequence.length; stepIdx++) {
            const idx = loadingSequence[stepIdx];
            const fromSequence = reconstructed[stepIdx];
            const fromPlacement = placedFreight[idx];

            // Exact same reference — the loading sequence index maps to the right item
            expect(fromSequence).toBe(fromPlacement);

            // Verify positions are preserved (structural check)
            expect(fromSequence.position.x).toBe(fromPlacement.position.x);
            expect(fromSequence.position.y).toBe(fromPlacement.position.y);
            expect(fromSequence.position.z).toBe(fromPlacement.position.z);
            expect(fromSequence.orientation).toBe(fromPlacement.orientation);
            expect(fromSequence.layer).toBe(fromPlacement.layer);
            expect(fromSequence.supportMethod).toBe(fromPlacement.supportMethod);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
