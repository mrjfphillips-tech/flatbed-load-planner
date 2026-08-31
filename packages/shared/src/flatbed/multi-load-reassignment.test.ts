// ─── Multi-Load Manual Reassignment — Unit Tests ─────────────────────────────
// Validates: Requirements 16.5, 16.6
// Tests for the multi-load reassignment logic including:
// - Single item reassignment between trailers
// - Batch reassignment of multiple items
// - Weight metrics recalculation for all affected trailers
// - Unassigned pool (move items to/from unassigned)
// - Error handling for invalid operations
// - Summary generation after reassignment

import { describe, it, expect } from 'vitest';
import {
  findItemTrailer,
  reassignItem,
  batchReassignItems,
  buildMultiLoadSummaryFromState,
} from './multi-load-reassignment';
import type {
  TrailerLoadState,
  MultiLoadSetState,
  ReassignmentAction,
} from './multi-load-reassignment';
import type {
  PlacedFreight,
  TrailerProfile,
  TractorProfile,
  EquipmentCombination,
} from './types';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeTrailer(): TrailerProfile {
  return {
    id: 'trailer-1',
    name: 'Standard 48ft Flatbed',
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
    stakePockets: [{ x: 48, y: -48 }, { x: 48, y: 48 }],
    anchorPoints: [{ x: 96, y: -48 }, { x: 96, y: 48 }],
    maxConcentratedLoadPSF: 500,
  };
}

function makeTractor(): TractorProfile {
  return {
    id: 'tractor-1',
    name: 'Day Cab',
    steerAxleRating: 12000,
    driveAxleRating: 34000,
    fifthWheelPosition: 180,
    tareWeight: 18000,
    driveAxleCount: 2,
  };
}

function makeEquipment(): EquipmentCombination {
  return {
    tractorId: 'tractor-1',
    trailerId: 'trailer-1',
    availablePayload: 50000,
    totalLegalGross: 80000,
    perAxleLimits: { steer: 12000, drive: 34000, trailer: 68000 },
  };
}

function makePlacedFreight(
  orderNumber: string,
  weight: number = 10000,
  stop: number = 1
): PlacedFreight {
  return {
    item: {
      orderNumber,
      customerName: 'Test Customer',
      deliveryStop: stop,
      productType: 'plate',
      quantity: 1,
      pieceWeight: weight,
      dimensions: { length: 120, width: 48, height: 12 },
      totalLineWeight: weight,
      handlingMethod: 'crane',
      stackPermission: 'yes',
      maxStackHeight: 60,
      maxStackWeight: 40000,
      orientationRequirement: 'any',
      dunnageRequired: false,
      specialNotes: '',
    },
    geometry: {
      type: 'rectangular',
      boundingBox: { length: 120, width: 48, height: 12 },
      contactFootprint: { area: 5760, shape: 'rectangle' },
      centerOfMass: { x: 60, y: 0, z: 6 },
    },
    position: { x: 100, y: 0, z: 0 },
    orientation: 'longitudinal',
    supportMethod: 'direct_to_deck',
    layer: 0,
  };
}

function makeMultiLoadState(options?: {
  trailerCount?: number;
  itemsPerTrailer?: number[];
  unassignedCount?: number;
}): MultiLoadSetState {
  const { trailerCount = 2, itemsPerTrailer = [2, 2], unassignedCount = 0 } = options ?? {};
  const trailer = makeTrailer();
  const tractor = makeTractor();
  const equipment = makeEquipment();

  let orderIdx = 1;
  const trailers: TrailerLoadState[] = [];

  for (let t = 0; t < trailerCount; t++) {
    const freight: PlacedFreight[] = [];
    for (let i = 0; i < (itemsPerTrailer[t] ?? 0); i++) {
      freight.push(makePlacedFreight(`ORD-${String(orderIdx).padStart(3, '0')}`, 10000, t + 1));
      orderIdx++;
    }
    trailers.push({
      trailerIndex: t,
      placedFreight: freight,
      weightMetrics: {
        totalGross: 30000 + freight.reduce((s, f) => s + f.item.pieceWeight, 0),
        steerWeight: 8000,
        driveWeight: 18000,
        trailerWeight: freight.reduce((s, f) => s + f.item.pieceWeight, 0) + 4000,
        cgLongitudinal: 280,
        cgLateral: 0,
        lateralImbalancePercent: 0,
        maxConcentratedLoadPSF: 200,
        axleUtilization: { steer: 67, drive: 53, trailer: 60 },
      },
    });
  }

  const unassignedItems: PlacedFreight[] = [];
  for (let i = 0; i < unassignedCount; i++) {
    unassignedItems.push(makePlacedFreight(`ORD-UNAS-${i + 1}`, 5000, 1));
  }

  return { trailers, unassignedItems, trailer, tractor, equipment };
}

// ─── findItemTrailer ─────────────────────────────────────────────────────────

describe('findItemTrailer', () => {
  it('returns the trailer index when item is on a trailer', () => {
    const state = makeMultiLoadState();
    expect(findItemTrailer('ORD-001', state)).toBe(0);
    expect(findItemTrailer('ORD-003', state)).toBe(1);
  });

  it('returns -1 for items in the unassigned pool', () => {
    const state = makeMultiLoadState({ unassignedCount: 1 });
    expect(findItemTrailer('ORD-UNAS-1', state)).toBe(-1);
  });

  it('returns -1 for items not found anywhere', () => {
    const state = makeMultiLoadState();
    expect(findItemTrailer('NON-EXISTENT', state)).toBe(-1);
  });
});

// ─── reassignItem ────────────────────────────────────────────────────────────

describe('reassignItem', () => {
  it('moves an item from one trailer to another', () => {
    const state = makeMultiLoadState();
    const action: ReassignmentAction = {
      itemId: 'ORD-001',
      sourceTrailerIndex: 0,
      destinationTrailerIndex: 1,
    };

    const result = reassignItem(action, state);

    expect(result.success).toBe(true);
    // Source trailer should lose the item
    const sourceTrailer = result.trailers.find((t) => t.trailerIndex === 0)!;
    expect(sourceTrailer.placedFreight.some((pf) => pf.item.orderNumber === 'ORD-001')).toBe(false);
    // Destination trailer should gain the item
    const destTrailer = result.trailers.find((t) => t.trailerIndex === 1)!;
    expect(destTrailer.placedFreight.some((pf) => pf.item.orderNumber === 'ORD-001')).toBe(true);
  });

  it('recalculates weight metrics for both affected trailers', () => {
    const state = makeMultiLoadState();
    const originalSourceMetrics = state.trailers[0].weightMetrics;
    const originalDestMetrics = state.trailers[1].weightMetrics;

    const action: ReassignmentAction = {
      itemId: 'ORD-001',
      sourceTrailerIndex: 0,
      destinationTrailerIndex: 1,
    };

    const result = reassignItem(action, state);

    expect(result.success).toBe(true);
    expect(result.affectedTrailerIndices).toContain(0);
    expect(result.affectedTrailerIndices).toContain(1);

    // Metrics should be recalculated (total gross changes because freight weight changes)
    const newSourceTrailer = result.trailers.find((t) => t.trailerIndex === 0)!;
    const newDestTrailer = result.trailers.find((t) => t.trailerIndex === 1)!;
    // Source lost an item so totalGross should decrease
    expect(newSourceTrailer.weightMetrics.totalGross).toBeLessThan(originalSourceMetrics.totalGross);
    // Destination gained an item so totalGross should increase
    expect(newDestTrailer.weightMetrics.totalGross).toBeGreaterThan(originalDestMetrics.totalGross);
  });

  it('moves an item from a trailer to the unassigned pool', () => {
    const state = makeMultiLoadState();
    const action: ReassignmentAction = {
      itemId: 'ORD-001',
      sourceTrailerIndex: 0,
      destinationTrailerIndex: -1,
    };

    const result = reassignItem(action, state);

    expect(result.success).toBe(true);
    expect(result.unassignedItems.some((pf) => pf.item.orderNumber === 'ORD-001')).toBe(true);
    const sourceTrailer = result.trailers.find((t) => t.trailerIndex === 0)!;
    expect(sourceTrailer.placedFreight.some((pf) => pf.item.orderNumber === 'ORD-001')).toBe(false);
    expect(result.affectedTrailerIndices).toContain(0);
    expect(result.affectedTrailerIndices).not.toContain(-1);
  });

  it('moves an item from the unassigned pool to a trailer', () => {
    const state = makeMultiLoadState({ unassignedCount: 1 });
    const action: ReassignmentAction = {
      itemId: 'ORD-UNAS-1',
      sourceTrailerIndex: -1,
      destinationTrailerIndex: 0,
    };

    const result = reassignItem(action, state);

    expect(result.success).toBe(true);
    expect(result.unassignedItems.some((pf) => pf.item.orderNumber === 'ORD-UNAS-1')).toBe(false);
    const destTrailer = result.trailers.find((t) => t.trailerIndex === 0)!;
    expect(destTrailer.placedFreight.some((pf) => pf.item.orderNumber === 'ORD-UNAS-1')).toBe(true);
    expect(result.affectedTrailerIndices).toContain(0);
  });

  it('fails when source and destination are the same', () => {
    const state = makeMultiLoadState();
    const action: ReassignmentAction = {
      itemId: 'ORD-001',
      sourceTrailerIndex: 0,
      destinationTrailerIndex: 0,
    };

    const result = reassignItem(action, state);

    expect(result.success).toBe(false);
    expect(result.error).toContain('same');
    expect(result.affectedTrailerIndices).toHaveLength(0);
  });

  it('fails when item not found on source trailer', () => {
    const state = makeMultiLoadState();
    const action: ReassignmentAction = {
      itemId: 'NON-EXISTENT',
      sourceTrailerIndex: 0,
      destinationTrailerIndex: 1,
    };

    const result = reassignItem(action, state);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(result.affectedTrailerIndices).toHaveLength(0);
  });

  it('fails when source trailer index is invalid', () => {
    const state = makeMultiLoadState();
    const action: ReassignmentAction = {
      itemId: 'ORD-001',
      sourceTrailerIndex: 99,
      destinationTrailerIndex: 1,
    };

    const result = reassignItem(action, state);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('fails when destination trailer index is invalid', () => {
    const state = makeMultiLoadState();
    const action: ReassignmentAction = {
      itemId: 'ORD-001',
      sourceTrailerIndex: 0,
      destinationTrailerIndex: 99,
    };

    const result = reassignItem(action, state);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('does not mutate the original state', () => {
    const state = makeMultiLoadState();
    const originalTrailer0Length = state.trailers[0].placedFreight.length;
    const originalTrailer1Length = state.trailers[1].placedFreight.length;

    reassignItem(
      { itemId: 'ORD-001', sourceTrailerIndex: 0, destinationTrailerIndex: 1 },
      state
    );

    // Original state should be unchanged
    expect(state.trailers[0].placedFreight.length).toBe(originalTrailer0Length);
    expect(state.trailers[1].placedFreight.length).toBe(originalTrailer1Length);
  });
});

// ─── batchReassignItems ──────────────────────────────────────────────────────

describe('batchReassignItems', () => {
  it('performs multiple reassignments in a single batch', () => {
    const state = makeMultiLoadState();
    const actions: ReassignmentAction[] = [
      { itemId: 'ORD-001', sourceTrailerIndex: 0, destinationTrailerIndex: 1 },
      { itemId: 'ORD-003', sourceTrailerIndex: 1, destinationTrailerIndex: 0 },
    ];

    const result = batchReassignItems(actions, state);

    expect(result.success).toBe(true);
    const trailer0 = result.trailers.find((t) => t.trailerIndex === 0)!;
    const trailer1 = result.trailers.find((t) => t.trailerIndex === 1)!;
    expect(trailer0.placedFreight.some((pf) => pf.item.orderNumber === 'ORD-003')).toBe(true);
    expect(trailer1.placedFreight.some((pf) => pf.item.orderNumber === 'ORD-001')).toBe(true);
  });

  it('recalculates metrics for all affected trailers', () => {
    const state = makeMultiLoadState();
    const actions: ReassignmentAction[] = [
      { itemId: 'ORD-001', sourceTrailerIndex: 0, destinationTrailerIndex: 1 },
    ];

    const result = batchReassignItems(actions, state);

    expect(result.affectedTrailerIndices).toContain(0);
    expect(result.affectedTrailerIndices).toContain(1);
  });

  it('returns success for empty action array', () => {
    const state = makeMultiLoadState();
    const result = batchReassignItems([], state);

    expect(result.success).toBe(true);
    expect(result.affectedTrailerIndices).toHaveLength(0);
  });

  it('skips invalid actions and reports errors', () => {
    const state = makeMultiLoadState();
    const actions: ReassignmentAction[] = [
      { itemId: 'ORD-001', sourceTrailerIndex: 0, destinationTrailerIndex: 0 }, // invalid: same src/dest
      { itemId: 'ORD-003', sourceTrailerIndex: 1, destinationTrailerIndex: 0 }, // valid
    ];

    const result = batchReassignItems(actions, state);

    // Not fully successful due to first action error
    expect(result.success).toBe(false);
    expect(result.error).toContain('ORD-001');
    // But the valid action should still be applied
    const trailer0 = result.trailers.find((t) => t.trailerIndex === 0)!;
    expect(trailer0.placedFreight.some((pf) => pf.item.orderNumber === 'ORD-003')).toBe(true);
  });

  it('applies actions sequentially (second action sees result of first)', () => {
    const state = makeMultiLoadState({ trailerCount: 3, itemsPerTrailer: [2, 1, 0] });
    // Move ORD-001 from trailer 0 to trailer 2, then from trailer 2 to trailer 1
    // This tests that the second action operates on the updated state
    const actions: ReassignmentAction[] = [
      { itemId: 'ORD-001', sourceTrailerIndex: 0, destinationTrailerIndex: 2 },
      { itemId: 'ORD-001', sourceTrailerIndex: 2, destinationTrailerIndex: 1 },
    ];

    const result = batchReassignItems(actions, state);

    expect(result.success).toBe(true);
    const trailer1 = result.trailers.find((t) => t.trailerIndex === 1)!;
    expect(trailer1.placedFreight.some((pf) => pf.item.orderNumber === 'ORD-001')).toBe(true);
  });
});

// ─── buildMultiLoadSummaryFromState ──────────────────────────────────────────

describe('buildMultiLoadSummaryFromState', () => {
  it('builds summary with correct trailer count and assignments', () => {
    const state = makeMultiLoadState();
    const summary = buildMultiLoadSummaryFromState(state);

    expect(summary.trailerCount).toBe(2);
    expect(summary.assignments).toHaveLength(2);
    expect(summary.assignments[0].trailerIndex).toBe(0);
    expect(summary.assignments[1].trailerIndex).toBe(1);
  });

  it('calculates total freight weight across all trailers and unassigned', () => {
    const state = makeMultiLoadState({ unassignedCount: 1 });
    const summary = buildMultiLoadSummaryFromState(state);

    // 4 items at 10000 each on trailers + 1 item at 5000 unassigned
    expect(summary.totalFreightWeight).toBe(45000);
  });

  it('reports stop integrity as preserved when no stop is split', () => {
    // Each trailer has items for a distinct stop
    const state = makeMultiLoadState();
    const summary = buildMultiLoadSummaryFromState(state);

    expect(summary.stopIntegrityPreserved).toBe(true);
    expect(summary.splitStops).toHaveLength(0);
  });

  it('detects stop integrity violation when items for one stop are on multiple trailers', () => {
    const state = makeMultiLoadState();
    // Force stop 1 items onto both trailers
    state.trailers[1].placedFreight[0] = {
      ...state.trailers[1].placedFreight[0],
      item: { ...state.trailers[1].placedFreight[0].item, deliveryStop: 1 },
    };

    const summary = buildMultiLoadSummaryFromState(state);

    expect(summary.stopIntegrityPreserved).toBe(false);
    expect(summary.splitStops).toContain(1);
  });

  it('reports correct per-trailer total weight and deck area', () => {
    const state = makeMultiLoadState();
    const summary = buildMultiLoadSummaryFromState(state);

    // Each trailer has 2 items at 10000 lbs each
    expect(summary.assignments[0].totalWeight).toBe(20000);
    expect(summary.assignments[1].totalWeight).toBe(20000);
    // Each item: 120 * 48 = 5760 sq in
    expect(summary.assignments[0].estimatedDeckArea).toBe(11520);
  });
});
