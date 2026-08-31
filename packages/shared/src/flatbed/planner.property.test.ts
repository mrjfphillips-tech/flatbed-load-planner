// ─── Property-Based Tests for Planning Engine ────────────────────────────────
// Feature: flatbed-load-planner
// Properties 7, 9, 10, 11, 13
// Validates: Requirements 5.2, 7.1-7.7, 8.2, 8.4, 8.5, 16.1-16.3

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateLoadPlan } from './planner';
import { generateMultiLoadPlan } from './multi-load';
import { calculateEquipmentCombination } from './equipment';
import { defaultRules } from './rules';
import { arbitraryTrailerProfile, arbitraryTractorProfile } from './equipment.property.test';
import { arbitrarySteelOrderLineItem } from './geometry.property.test';
import type {
  SteelOrderLineItem,
  TrailerProfile,
  TractorProfile,
  EquipmentCombination,
  PlacedFreight,
} from './types';
import type { PlanRequest, PlanResult } from './planner';

// ─── Constants ───────────────────────────────────────────────────────────────

const ALL_STEEL_PRODUCT_TYPES = [
  'coil_hot_rolled', 'coil_cold_rolled', 'coil_galvanized',
  'sheet_bundle', 'plate', 'rebar_bundle', 'wire_rod_coil',
  'beam_i', 'beam_h', 'beam_wide_flange', 'channel', 'angle',
  'flat_bar', 'round_bar', 'pipe', 'tube', 'hollow_structural_section',
  'roofing_sheet_bundle', 'wire_mesh_panel', 'fabricated_assembly',
  'palletized', 'mixed_bundle',
] as const;

const HORIZONTAL_COIL_TYPES = new Set([
  'coil_hot_rolled', 'coil_cold_rolled', 'coil_galvanized', 'wire_rod_coil',
]);

const LONG_PRODUCT_TYPES = new Set([
  'beam_i', 'beam_h', 'beam_wide_flange', 'channel', 'angle',
  'flat_bar', 'round_bar', 'pipe', 'tube', 'hollow_structural_section',
  'rebar_bundle',
]);

const PLATE_SHEET_TYPES = new Set(['plate', 'sheet_bundle', 'roofing_sheet_bundle']);

// ─── Custom Generators ───────────────────────────────────────────────────────

/**
 * Generates a set of n random steel order line items suitable for plan generation.
 * Items have constrained dimensions to fit on a standard flatbed trailer,
 * and delivery stops are distributed across 1–4 stops.
 */
export function arbitraryFreightSet(n: number): fc.Arbitrary<SteelOrderLineItem[]> {
  return fc.array(
    fc.record({
      orderNumber: fc.integer({ min: 1000, max: 99999 }).map(n => `ORD-${n}`),
      customerName: fc.constantFrom('Acme Steel', 'Atlas Metals', 'Forge Corp', 'Iron Works'),
      deliveryStop: fc.integer({ min: 1, max: 4 }),
      productType: fc.constantFrom(...ALL_STEEL_PRODUCT_TYPES),
      quantity: fc.integer({ min: 1, max: 5 }),
      pieceWeight: fc.integer({ min: 500, max: 15000 }),
      dimensions: fc.record({
        length: fc.integer({ min: 24, max: 240 }),
        width: fc.integer({ min: 12, max: 84 }),
        height: fc.integer({ min: 4, max: 60 }),
      }),
      totalLineWeight: fc.integer({ min: 500, max: 75000 }),
      handlingMethod: fc.constantFrom('crane' as const, 'forklift' as const, 'magnet' as const, 'manual' as const),
      stackPermission: fc.constantFrom('yes' as const, 'no' as const, 'conditional' as const),
      maxStackHeight: fc.integer({ min: 48, max: 102 }),
      maxStackWeight: fc.integer({ min: 5000, max: 60000 }),
      orientationRequirement: fc.constantFrom('longitudinal' as const, 'transverse' as const, 'any' as const),
      dunnageRequired: fc.boolean(),
      specialNotes: fc.constant(''),
    }),
    { minLength: n, maxLength: n }
  );
}

/**
 * Creates a standard test trailer profile that accommodates most freight sets.
 */
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

/**
 * Helper: builds a PlanRequest from generated items using fixed equipment.
 */
function buildRequest(items: SteelOrderLineItem[]): PlanRequest {
  return {
    items,
    trailer: makeTestTrailer(),
    tractor: makeTestTractor(),
    equipment: makeTestEquipment(),
    rules: defaultRules,
  };
}

// ─── Property 7: Placement determinism ───────────────────────────────────────
// Identical inputs produce bit-for-bit identical placements.
// **Validates: Requirements 5.2**

describe('Feature: flatbed-load-planner, Property 7: Placement determinism', () => {
  it('identical inputs produce identical outputs for any freight set', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(5),
        (items) => {
          const request = buildRequest(items);
          const result1 = generateLoadPlan(request);
          const result2 = generateLoadPlan(request);

          // Same number of placed items
          expect(result1.placedFreight.length).toBe(result2.placedFreight.length);
          expect(result1.unplacedItems.length).toBe(result2.unplacedItems.length);
          expect(result1.detectedPattern).toBe(result2.detectedPattern);
          expect(result1.canApprove).toBe(result2.canApprove);

          // Bit-for-bit identical positions, orientations, layers
          for (let i = 0; i < result1.placedFreight.length; i++) {
            const pf1 = result1.placedFreight[i];
            const pf2 = result2.placedFreight[i];
            expect(pf1.position.x).toBe(pf2.position.x);
            expect(pf1.position.y).toBe(pf2.position.y);
            expect(pf1.position.z).toBe(pf2.position.z);
            expect(pf1.orientation).toBe(pf2.orientation);
            expect(pf1.layer).toBe(pf2.layer);
            expect(pf1.supportMethod).toBe(pf2.supportMethod);
            expect(pf1.item.orderNumber).toBe(pf2.item.orderNumber);
          }

          // Loading sequence is identical
          expect(result1.loadingSequence).toEqual(result2.loadingSequence);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 9: Stop-order accessibility invariant ──────────────────────────
// No later-stop item blocks access to earlier-stop items.
// **Validates: Requirements 8.2, 8.4, 8.5**

describe('Feature: flatbed-load-planner, Property 9: Stop-order accessibility invariant', () => {
  it('no later-stop item is stacked above an earlier-stop item in successful plans', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(6),
        (items) => {
          const request = buildRequest(items);
          const result = generateLoadPlan(request);

          // Only check placed freight (unplaced items don't violate this)
          const placed = result.placedFreight;
          if (placed.length < 2) return; // trivially satisfied

          for (const item of placed) {
            const itemStop = item.item.deliveryStop;

            for (const other of placed) {
              if (other === item) continue;
              // Later-stop item should not be above an earlier-stop item
              if (other.item.deliveryStop > itemStop && other.layer > item.layer) {
                // Check XY overlap — if they overlap, it's a violation
                const overlaps = doItemsOverlapXY(item, other);
                if (overlaps) {
                  // This would be a stop-order accessibility violation
                  expect(overlaps).toBe(false);
                }
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 10: Stacking safety invariant ──────────────────────────────────
// No-stack respected, max stack weight/height enforced.
// **Validates: Requirements 7.1, 7.2, 7.3**

describe('Feature: flatbed-load-planner, Property 10: Stacking safety invariant', () => {
  it('no item marked "no stack" has another item placed above it', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(6),
        (items) => {
          const request = buildRequest(items);
          const result = generateLoadPlan(request);
          const placed = result.placedFreight;

          const noStackItems = placed.filter(f => f.item.stackPermission === 'no');

          for (const noStack of noStackItems) {
            for (const other of placed) {
              if (other === noStack) continue;
              if (other.layer <= noStack.layer) continue;
              // If overlapping XY and above, that violates no-stack
              if (doItemsOverlapXY(noStack, other)) {
                expect(false).toBe(true); // fail: no-stack violated
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('cumulative weight above any item does not exceed its maxStackWeight', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(6),
        (items) => {
          const request = buildRequest(items);
          const result = generateLoadPlan(request);
          const placed = result.placedFreight;

          for (const item of placed) {
            const itemsAbove = placed.filter(other => {
              if (other === item) return false;
              if (other.layer <= item.layer) return false;
              return doItemsOverlapXY(item, other);
            });

            if (itemsAbove.length === 0) continue;

            const totalWeightAbove = itemsAbove.reduce(
              (sum, above) => sum + above.item.pieceWeight * above.item.quantity,
              0
            );

            expect(totalWeightAbove).toBeLessThanOrEqual(item.item.maxStackWeight);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('total stack height does not exceed legal limit (102 inches)', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(6),
        (items) => {
          const request = buildRequest(items);
          const result = generateLoadPlan(request);
          const placed = result.placedFreight;
          const legalMaxHeight = 102;

          for (const item of placed) {
            const topOfItem = item.position.z + item.geometry.boundingBox.height;
            expect(topOfItem).toBeLessThanOrEqual(legalMaxHeight);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 11: Steel-specific support and protection requirements ─────────
// Coils have anti-roll, dissimilar items have dunnage, long products have ≥ 2
// supports, plates have edge protection.
// **Validates: Requirements 7.4, 7.5, 7.6, 7.7**

describe('Feature: flatbed-load-planner, Property 11: Steel-specific support and protection requirements', () => {
  it('horizontal coils have anti-roll securement (cradle angle or chock dimensions)', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(5),
        (items) => {
          const request = buildRequest(items);
          const result = generateLoadPlan(request);
          const placed = result.placedFreight;

          const horizontalCoils = placed.filter(f =>
            HORIZONTAL_COIL_TYPES.has(f.item.productType) &&
            (f.geometry.type === 'horizontal_coil' || f.geometry.type === 'cylindrical_bundle')
          );

          for (const coil of horizontalCoils) {
            const hasCradle = coil.geometry.cradleAngle !== undefined && coil.geometry.cradleAngle > 0;
            const hasChocks = coil.geometry.chockDimensions !== undefined &&
              coil.geometry.chockDimensions.width > 0 &&
              coil.geometry.chockDimensions.height > 0;
            expect(hasCradle || hasChocks).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('dissimilar-hardness stacked items have dunnage support method', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(6),
        (items) => {
          const request = buildRequest(items);
          const result = generateLoadPlan(request);
          const placed = result.placedFreight;

          for (const upper of placed) {
            if (upper.layer === 0) continue;
            if (upper.supportMethod === 'on_dunnage') continue; // already has dunnage

            // Find items directly below (adjacent layer, overlapping XY)
            const itemsBelow = placed.filter(lower => {
              if (lower === upper) return false;
              if (lower.layer !== upper.layer - 1) return false;
              return doItemsOverlapXY(lower, upper);
            });

            for (const lower of itemsBelow) {
              if (areDissimilarHardness(upper.item.productType, lower.item.productType)) {
                // Dissimilar hardness stacked without dunnage is a violation
                // The planner should set supportMethod to 'on_dunnage'
                expect(upper.supportMethod).toBe('on_dunnage');
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('long products have at least 2 support points (geometry.boundingBox.length determines need)', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(5),
        (items) => {
          const request = buildRequest(items);
          const result = generateLoadPlan(request);

          // Check stacking evaluation for long product supports
          const longProductSupports = result.stackingEvaluation.longProductSupports;

          for (const support of longProductSupports) {
            // Each long product must have at least 2 support points
            expect(support.supportPoints.length).toBeGreaterThanOrEqual(2);
            // Max unsupported span must not exceed the limit
            expect(support.actualMaxSpan).toBeLessThanOrEqual(support.maxUnsupportedSpan);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('plate/sheet items have edge protection requirements calculated', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(5),
        (items) => {
          const request = buildRequest(items);
          const result = generateLoadPlan(request);

          const edgeProtections = result.stackingEvaluation.edgeProtections;
          const placedPlateItems = result.placedFreight.filter(
            f => PLATE_SHEET_TYPES.has(f.item.productType)
          );

          // Every placed plate/sheet item should have an edge protection record
          for (const plateItem of placedPlateItems) {
            const protection = edgeProtections.find(
              ep => ep.itemOrderNumber === plateItem.item.orderNumber
            );
            expect(protection).toBeDefined();
            if (protection) {
              expect(protection.requiresEdgeProtection).toBe(true);
              expect(protection.requiresBanding).toBe(true);
              expect(protection.bandCount).toBeGreaterThanOrEqual(2);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 13: Multi-load split item conservation ─────────────────────────
// Union of items across loads = original input set, stop integrity preserved.
// **Validates: Requirements 16.1, 16.2, 16.3**

describe('Feature: flatbed-load-planner, Property 13: Multi-load split item conservation', () => {
  it('union of placed items across all loads equals original input set (no items lost or duplicated)', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(8).map(items =>
          // Ensure unique order numbers for tracking
          items.map((item, idx) => ({ ...item, orderNumber: `ORD-${10000 + idx}` }))
        ),
        (items) => {
          const request = buildRequest(items);
          const multiResult = generateMultiLoadPlan(request);

          // Collect all placed item order numbers across all loads
          const placedOrders = new Set<string>();
          for (const load of multiResult.loads) {
            for (const pf of load.placedFreight) {
              placedOrders.add(pf.item.orderNumber);
            }
          }

          // Collect unplaceable item order numbers from summary
          const unplaceableOrders = new Set(
            multiResult.summary.unplaceableItems.map(u => u.item.orderNumber)
          );

          // Also collect unplaced items from individual loads
          for (const load of multiResult.loads) {
            for (const item of load.unplacedItems) {
              unplaceableOrders.add(item.orderNumber);
            }
          }

          // Every input item must be in either placed or unplaceable
          const inputOrders = new Set(items.map(i => i.orderNumber));

          for (const order of inputOrders) {
            const isPlaced = placedOrders.has(order);
            const isUnplaceable = unplaceableOrders.has(order);
            expect(isPlaced || isUnplaceable).toBe(true);
          }

          // No item should appear in both placed AND unplaceable
          for (const order of placedOrders) {
            expect(unplaceableOrders.has(order)).toBe(false);
          }

          // Total count: placed + unplaceable = input
          expect(placedOrders.size + unplaceableOrders.size).toBe(inputOrders.size);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all items for a single delivery stop are on the same trailer (stop integrity)', () => {
    fc.assert(
      fc.property(
        arbitraryFreightSet(6),
        (items) => {
          const request = buildRequest(items);
          const multiResult = generateMultiLoadPlan(request);

          // Skip if stops were explicitly split (physically impossible to keep together)
          if (multiResult.summary.splitStops.length > 0) return;

          // For each stop, verify all its items are assigned to the same trailer
          const stopToTrailer = new Map<number, number>();

          for (let loadIdx = 0; loadIdx < multiResult.summary.assignments.length; loadIdx++) {
            const assignment = multiResult.summary.assignments[loadIdx];
            for (const item of assignment.items) {
              const existingTrailer = stopToTrailer.get(item.deliveryStop);
              if (existingTrailer !== undefined) {
                expect(existingTrailer).toBe(loadIdx);
              } else {
                stopToTrailer.set(item.deliveryStop, loadIdx);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Helper Functions ────────────────────────────────────────────────────────

/** Checks whether two placed freight items overlap in the X-Y plane */
function doItemsOverlapXY(a: PlacedFreight, b: PlacedFreight): boolean {
  const aLeft = a.position.x;
  const aRight = a.position.x + a.geometry.boundingBox.length;
  const aBottom = a.position.y;
  const aTop = a.position.y + a.geometry.boundingBox.width;

  const bLeft = b.position.x;
  const bRight = b.position.x + b.geometry.boundingBox.length;
  const bBottom = b.position.y;
  const bTop = b.position.y + b.geometry.boundingBox.width;

  return aLeft < bRight && aRight > bLeft && aBottom < bTop && aTop > bBottom;
}

type HardnessCategory = 'hard' | 'medium' | 'soft' | 'coated';

/** Returns the hardness category of a steel product type */
function getHardnessCategory(productType: string): HardnessCategory {
  switch (productType) {
    case 'coil_hot_rolled':
    case 'plate':
    case 'beam_i':
    case 'beam_h':
    case 'beam_wide_flange':
    case 'channel':
    case 'angle':
    case 'flat_bar':
    case 'round_bar':
    case 'pipe':
    case 'tube':
    case 'hollow_structural_section':
    case 'rebar_bundle':
      return 'hard';
    case 'coil_cold_rolled':
    case 'sheet_bundle':
    case 'wire_rod_coil':
    case 'wire_mesh_panel':
      return 'medium';
    case 'coil_galvanized':
    case 'roofing_sheet_bundle':
      return 'coated';
    default:
      return 'soft';
  }
}

/** Determines if two product types have dissimilar hardness */
function areDissimilarHardness(typeA: string, typeB: string): boolean {
  return getHardnessCategory(typeA) !== getHardnessCategory(typeB);
}
