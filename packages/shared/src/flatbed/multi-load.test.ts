// ─── Multi-Load Splitting — Unit Tests ────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  detectCapacityExceedance,
  groupItemsByStop,
  splitFreightAcrossTrailers,
  generateMultiLoadPlan,
} from './multi-load';
import type {
  SteelOrderLineItem,
  TrailerProfile,
  TractorProfile,
  EquipmentCombination,
} from './types';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeTrailer(overrides: Partial<TrailerProfile> = {}): TrailerProfile {
  return {
    id: 'trailer-1',
    name: 'Test 48ft Flatbed',
    lengthFt: 48,
    deckWidthIn: 96,
    deckHeightIn: 60,
    maxGrossWeight: 80000,
    tareWeight: 12000,
    axleCount: 2,
    axlePositions: [420, 468], // inches from kingpin
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
    ...overrides,
  };
}

function makeTractor(overrides: Partial<TractorProfile> = {}): TractorProfile {
  return {
    id: 'tractor-1',
    name: 'Test Tractor',
    steerAxleRating: 12000,
    driveAxleRating: 34000,
    fifthWheelPosition: 180,
    tareWeight: 18000,
    driveAxleCount: 2,
    ...overrides,
  };
}

function makeEquipment(trailer: TrailerProfile, tractor: TractorProfile): EquipmentCombination {
  return {
    tractorId: tractor.id,
    trailerId: trailer.id,
    availablePayload: trailer.maxGrossWeight - trailer.tareWeight - tractor.tareWeight,
    totalLegalGross: trailer.maxGrossWeight,
    perAxleLimits: {
      steer: tractor.steerAxleRating,
      drive: tractor.driveAxleRating,
      trailer: trailer.axleWeightRatings.reduce((a, b) => a + b, 0),
    },
  };
}

function makeItem(overrides: Partial<SteelOrderLineItem> = {}): SteelOrderLineItem {
  return {
    orderNumber: 'ORD-001',
    customerName: 'Test Customer',
    deliveryStop: 1,
    productType: 'plate',
    quantity: 1,
    pieceWeight: 5000,
    dimensions: { length: 120, width: 48, height: 6 },
    totalLineWeight: 5000,
    handlingMethod: 'crane',
    stackPermission: 'yes',
    maxStackHeight: 60,
    maxStackWeight: 20000,
    orientationRequirement: 'any',
    dunnageRequired: false,
    specialNotes: '',
    ...overrides,
  };
}

// ─── detectCapacityExceedance ────────────────────────────────────────────────

describe('detectCapacityExceedance', () => {
  const trailer = makeTrailer();
  const tractor = makeTractor();
  const equipment = makeEquipment(trailer, tractor);

  it('returns false when items fit within capacity', () => {
    const items = [makeItem({ pieceWeight: 10000, quantity: 1 })];
    const result = detectCapacityExceedance(items, equipment, trailer);
    expect(result.exceedsCapacity).toBe(false);
    expect(result.weightExceeded).toBe(false);
    expect(result.volumeExceeded).toBe(false);
  });

  it('detects weight exceedance', () => {
    // Available payload = 80000 - 12000 - 18000 = 50000
    const items = [
      makeItem({ pieceWeight: 30000, quantity: 1, orderNumber: 'A' }),
      makeItem({ pieceWeight: 25000, quantity: 1, orderNumber: 'B' }),
    ];
    const result = detectCapacityExceedance(items, equipment, trailer);
    expect(result.exceedsCapacity).toBe(true);
    expect(result.weightExceeded).toBe(true);
    expect(result.totalWeight).toBe(55000);
    expect(result.availablePayload).toBe(50000);
  });

  it('detects volume exceedance', () => {
    // Available area = 48*12 * 96 = 55296 sq in
    // Each item: 500 * 120 = 60000 sq in (exceeds)
    const items = [
      makeItem({ dimensions: { length: 500, width: 120, height: 6 }, pieceWeight: 1000 }),
    ];
    const result = detectCapacityExceedance(items, equipment, trailer);
    expect(result.exceedsCapacity).toBe(true);
    expect(result.volumeExceeded).toBe(true);
  });

  it('detects combined weight and volume exceedance', () => {
    const items = [
      makeItem({
        pieceWeight: 60000,
        quantity: 1,
        dimensions: { length: 500, width: 120, height: 6 },
      }),
    ];
    const result = detectCapacityExceedance(items, equipment, trailer);
    expect(result.exceedsCapacity).toBe(true);
    expect(result.weightExceeded).toBe(true);
    expect(result.volumeExceeded).toBe(true);
  });
});

// ─── groupItemsByStop ────────────────────────────────────────────────────────

describe('groupItemsByStop', () => {
  it('groups items by delivery stop number', () => {
    const items = [
      makeItem({ orderNumber: 'A', deliveryStop: 1 }),
      makeItem({ orderNumber: 'B', deliveryStop: 2 }),
      makeItem({ orderNumber: 'C', deliveryStop: 1 }),
      makeItem({ orderNumber: 'D', deliveryStop: 3 }),
    ];

    const groups = groupItemsByStop(items);
    expect(groups.size).toBe(3);
    expect(groups.get(1)!.length).toBe(2);
    expect(groups.get(2)!.length).toBe(1);
    expect(groups.get(3)!.length).toBe(1);
  });

  it('returns empty map for empty input', () => {
    const groups = groupItemsByStop([]);
    expect(groups.size).toBe(0);
  });

  it('preserves item references correctly', () => {
    const itemA = makeItem({ orderNumber: 'A', deliveryStop: 1 });
    const itemB = makeItem({ orderNumber: 'B', deliveryStop: 1 });
    const groups = groupItemsByStop([itemA, itemB]);
    expect(groups.get(1)).toContain(itemA);
    expect(groups.get(1)).toContain(itemB);
  });
});

// ─── splitFreightAcrossTrailers ──────────────────────────────────────────────

describe('splitFreightAcrossTrailers', () => {
  const trailer = makeTrailer();
  const tractor = makeTractor();
  const equipment = makeEquipment(trailer, tractor);

  it('keeps all items on one trailer when they fit', () => {
    const items = [
      makeItem({ orderNumber: 'A', pieceWeight: 10000, deliveryStop: 1 }),
      makeItem({ orderNumber: 'B', pieceWeight: 10000, deliveryStop: 2 }),
    ];
    const { trailerLoads, unplaceable } = splitFreightAcrossTrailers(items, equipment, trailer);
    expect(trailerLoads.length).toBe(1);
    expect(trailerLoads[0].length).toBe(2);
    expect(unplaceable.length).toBe(0);
  });

  it('splits items into multiple trailers when weight exceeds capacity', () => {
    // Effective payload = 50000 * 0.85 = 42500
    const items = [
      makeItem({ orderNumber: 'A', pieceWeight: 25000, quantity: 1, deliveryStop: 1 }),
      makeItem({ orderNumber: 'B', pieceWeight: 25000, quantity: 1, deliveryStop: 2 }),
    ];
    const { trailerLoads, unplaceable } = splitFreightAcrossTrailers(items, equipment, trailer);
    expect(trailerLoads.length).toBe(2);
    expect(unplaceable.length).toBe(0);
  });

  it('preserves stop integrity — items for same stop on same trailer', () => {
    // Effective payload = 42500
    const items = [
      makeItem({ orderNumber: 'A', pieceWeight: 15000, quantity: 1, deliveryStop: 1 }),
      makeItem({ orderNumber: 'B', pieceWeight: 10000, quantity: 1, deliveryStop: 1 }),
      makeItem({ orderNumber: 'C', pieceWeight: 20000, quantity: 1, deliveryStop: 2 }),
    ];
    const { trailerLoads, unplaceable, splitStops } = splitFreightAcrossTrailers(items, equipment, trailer);

    // Stop 1 items (25000 total) should be together
    const stop1Trailer = trailerLoads.find((load) =>
      load.some((i) => i.orderNumber === 'A')
    )!;
    expect(stop1Trailer.some((i) => i.orderNumber === 'B')).toBe(true);
    expect(unplaceable.length).toBe(0);
    expect(splitStops.length).toBe(0);
  });

  it('reports unplaceable items that individually exceed capacity', () => {
    const items = [
      makeItem({ orderNumber: 'A', pieceWeight: 60000, quantity: 1, deliveryStop: 1 }),
      makeItem({ orderNumber: 'B', pieceWeight: 10000, quantity: 1, deliveryStop: 2 }),
    ];
    const { trailerLoads, unplaceable } = splitFreightAcrossTrailers(items, equipment, trailer);
    expect(unplaceable.length).toBe(1);
    expect(unplaceable[0].item.orderNumber).toBe('A');
    expect(unplaceable[0].constraint).toBe('weight_exceeds_payload');
    expect(unplaceable[0].suggestions.length).toBeGreaterThan(0);
    // B should still be placed
    expect(trailerLoads.flat().some((i) => i.orderNumber === 'B')).toBe(true);
  });

  it('reports items too long for the trailer as unplaceable', () => {
    const items = [
      makeItem({
        orderNumber: 'LONG',
        dimensions: { length: 700, width: 48, height: 6 },
        pieceWeight: 5000,
        deliveryStop: 1,
      }),
    ];
    const { unplaceable } = splitFreightAcrossTrailers(items, equipment, trailer);
    expect(unplaceable.length).toBe(1);
    expect(unplaceable[0].constraint).toBe('length_exceeds_trailer');
  });

  it('splits stops across trailers when a single stop exceeds capacity', () => {
    // Effective payload = 42500; stop 1 has 50000 lbs total
    const items = [
      makeItem({ orderNumber: 'A', pieceWeight: 25000, quantity: 1, deliveryStop: 1 }),
      makeItem({ orderNumber: 'B', pieceWeight: 25000, quantity: 1, deliveryStop: 1 }),
    ];
    const { trailerLoads, splitStops } = splitFreightAcrossTrailers(items, equipment, trailer);
    expect(trailerLoads.length).toBe(2);
    expect(splitStops).toContain(1);
  });
});

// ─── generateMultiLoadPlan ───────────────────────────────────────────────────

describe('generateMultiLoadPlan', () => {
  const trailer = makeTrailer();
  const tractor = makeTractor();
  const equipment = makeEquipment(trailer, tractor);

  it('returns single load when all items fit', () => {
    const items = [
      makeItem({ orderNumber: 'A', pieceWeight: 5000, deliveryStop: 1 }),
      makeItem({ orderNumber: 'B', pieceWeight: 5000, deliveryStop: 2 }),
    ];
    const result = generateMultiLoadPlan({ items, trailer, tractor, equipment });
    expect(result.wasSplit).toBe(false);
    expect(result.loads.length).toBe(1);
    expect(result.success).toBe(true);
    expect(result.summary.trailerCount).toBe(1);
    expect(result.summary.stopIntegrityPreserved).toBe(true);
  });

  it('splits into multiple loads when weight exceeds capacity', () => {
    const items = [
      makeItem({ orderNumber: 'A', pieceWeight: 30000, quantity: 1, deliveryStop: 1 }),
      makeItem({ orderNumber: 'B', pieceWeight: 30000, quantity: 1, deliveryStop: 2 }),
    ];
    const result = generateMultiLoadPlan({ items, trailer, tractor, equipment });
    expect(result.wasSplit).toBe(true);
    expect(result.loads.length).toBe(2);
    expect(result.success).toBe(true);
    expect(result.summary.trailerCount).toBe(2);
  });

  it('produces a master summary with item-to-trailer assignments', () => {
    const items = [
      makeItem({ orderNumber: 'A', pieceWeight: 30000, quantity: 1, deliveryStop: 1 }),
      makeItem({ orderNumber: 'B', pieceWeight: 30000, quantity: 1, deliveryStop: 2 }),
    ];
    const result = generateMultiLoadPlan({ items, trailer, tractor, equipment });
    const { summary } = result;

    expect(summary.assignments.length).toBe(2);
    // Each assignment should have items
    for (const assignment of summary.assignments) {
      expect(assignment.items.length).toBeGreaterThan(0);
      expect(assignment.totalWeight).toBeGreaterThan(0);
      expect(assignment.trailerIndex).toBeGreaterThanOrEqual(0);
    }

    // Total freight weight should match input
    expect(summary.totalFreightWeight).toBe(60000);
  });

  it('reports unplaceable items with constraint details and suggestions', () => {
    const items = [
      makeItem({ orderNumber: 'HEAVY', pieceWeight: 60000, quantity: 1, deliveryStop: 1 }),
      makeItem({ orderNumber: 'NORMAL', pieceWeight: 5000, quantity: 1, deliveryStop: 2 }),
    ];
    const result = generateMultiLoadPlan({ items, trailer, tractor, equipment });
    const unplaceable = result.summary.unplaceableItems;

    expect(unplaceable.length).toBeGreaterThanOrEqual(1);
    const heavy = unplaceable.find((u) => u.item.orderNumber === 'HEAVY');
    expect(heavy).toBeDefined();
    expect(heavy!.constraint).toBeTruthy();
    expect(heavy!.explanation).toBeTruthy();
    expect(heavy!.suggestions.length).toBeGreaterThan(0);
  });

  it('preserves stop integrity in multi-load results', () => {
    // Two stops, each fitting on a trailer but not both together
    // Effective payload = 42500
    const items = [
      makeItem({ orderNumber: 'A1', pieceWeight: 20000, quantity: 1, deliveryStop: 1 }),
      makeItem({ orderNumber: 'A2', pieceWeight: 15000, quantity: 1, deliveryStop: 1 }),
      makeItem({ orderNumber: 'B1', pieceWeight: 20000, quantity: 1, deliveryStop: 2 }),
    ];
    const result = generateMultiLoadPlan({ items, trailer, tractor, equipment });

    // Check that stop 1 items are on the same trailer
    const { assignments } = result.summary;
    const trailerWithA1 = assignments.find((a) =>
      a.items.some((i) => i.orderNumber === 'A1')
    );
    expect(trailerWithA1).toBeDefined();
    expect(trailerWithA1!.items.some((i) => i.orderNumber === 'A2')).toBe(true);
    expect(result.summary.stopIntegrityPreserved).toBe(true);
  });

  it('handles empty input', () => {
    const result = generateMultiLoadPlan({ items: [], trailer, tractor, equipment });
    expect(result.success).toBe(true);
    expect(result.loads.length).toBe(1);
    expect(result.wasSplit).toBe(false);
  });

  it('correctly reports splitStops when a stop must be broken up', () => {
    // Available payload = 50000; stop 1 totals 60000 lbs (exceeds capacity)
    const items = [
      makeItem({ orderNumber: 'A', pieceWeight: 30000, quantity: 1, deliveryStop: 1 }),
      makeItem({ orderNumber: 'B', pieceWeight: 30000, quantity: 1, deliveryStop: 1 }),
    ];
    const result = generateMultiLoadPlan({ items, trailer, tractor, equipment });
    expect(result.summary.splitStops).toContain(1);
    expect(result.summary.stopIntegrityPreserved).toBe(false);
  });

  it('no items lost or duplicated in multi-load split', () => {
    const items = [
      makeItem({ orderNumber: 'A', pieceWeight: 20000, quantity: 1, deliveryStop: 1 }),
      makeItem({ orderNumber: 'B', pieceWeight: 20000, quantity: 1, deliveryStop: 2 }),
      makeItem({ orderNumber: 'C', pieceWeight: 20000, quantity: 1, deliveryStop: 3 }),
    ];
    const result = generateMultiLoadPlan({ items, trailer, tractor, equipment });

    // All items should appear exactly once across all assignments + unplaceable
    const allAssignedOrders = result.summary.assignments.flatMap((a) =>
      a.items.map((i) => i.orderNumber)
    );
    const unplaceableOrders = result.summary.unplaceableItems.map((u) => u.item.orderNumber);
    const allOrders = [...allAssignedOrders, ...unplaceableOrders];

    const inputOrders = items.map((i) => i.orderNumber);
    expect(allOrders.sort()).toEqual(inputOrders.sort());
  });
});
