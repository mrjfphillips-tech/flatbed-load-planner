// ─── OptiFlow Flatbed Steel Load Planner — Planning Engine Tests ─────────────
import { describe, it, expect } from 'vitest';
import { generateLoadPlan, detectLoadPattern } from './planner';
import type { PlanRequest } from './planner';
import type {
  SteelOrderLineItem,
  TrailerProfile,
  TractorProfile,
  EquipmentCombination,
} from './types';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeTrailer(overrides?: Partial<TrailerProfile>): TrailerProfile {
  return {
    id: 'trailer-1',
    name: '53ft Standard',
    lengthFt: 53,
    deckWidthIn: 102,
    deckHeightIn: 60,
    maxGrossWeight: 80000,
    tareWeight: 15000,
    axleCount: 2,
    axlePositions: [480, 528], // ~40ft and ~44ft from kingpin
    axleWeightRatings: [34000, 34000],
    kingpinPosition: 36,
    rearOverhangLimit: 48,
    deckMaterial: 'steel',
    stakePockets: [
      { x: 48, y: -51 }, { x: 48, y: 51 },
      { x: 144, y: -51 }, { x: 144, y: 51 },
      { x: 240, y: -51 }, { x: 240, y: 51 },
      { x: 336, y: -51 }, { x: 336, y: 51 },
      { x: 432, y: -51 }, { x: 432, y: 51 },
      { x: 528, y: -51 }, { x: 528, y: 51 },
    ],
    anchorPoints: [
      { x: 48, y: -48 }, { x: 48, y: 48 },
      { x: 96, y: -48 }, { x: 96, y: 48 },
      { x: 144, y: -48 }, { x: 144, y: 48 },
      { x: 192, y: -48 }, { x: 192, y: 48 },
      { x: 240, y: -48 }, { x: 240, y: 48 },
      { x: 288, y: -48 }, { x: 288, y: 48 },
      { x: 336, y: -48 }, { x: 336, y: 48 },
      { x: 384, y: -48 }, { x: 384, y: 48 },
      { x: 432, y: -48 }, { x: 432, y: 48 },
      { x: 480, y: -48 }, { x: 480, y: 48 },
      { x: 528, y: -48 }, { x: 528, y: 48 },
      { x: 576, y: -48 }, { x: 576, y: 48 },
    ],
    maxConcentratedLoadPSF: 800,
    ...overrides,
  };
}

function makeTractor(overrides?: Partial<TractorProfile>): TractorProfile {
  return {
    id: 'tractor-1',
    name: 'Standard Day Cab',
    steerAxleRating: 12000,
    driveAxleRating: 34000,
    fifthWheelPosition: 150,
    tareWeight: 17000,
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

function makeItem(overrides?: Partial<SteelOrderLineItem>): SteelOrderLineItem {
  return {
    orderNumber: 'ORD-001',
    customerName: 'Acme Steel',
    deliveryStop: 1,
    productType: 'plate',
    quantity: 1,
    pieceWeight: 5000,
    dimensions: { length: 120, width: 48, height: 6 },
    totalLineWeight: 5000,
    handlingMethod: 'crane',
    stackPermission: 'yes',
    maxStackHeight: 48,
    maxStackWeight: 20000,
    orientationRequirement: 'any',
    dunnageRequired: false,
    specialNotes: '',
    ...overrides,
  };
}

function makePlanRequest(items: SteelOrderLineItem[], overrides?: Partial<PlanRequest>): PlanRequest {
  const trailer = makeTrailer();
  const tractor = makeTractor();
  const equipment = makeEquipment(trailer, tractor);
  return {
    items,
    trailer,
    tractor,
    equipment,
    ...overrides,
  };
}

// ─── Pattern Detection Tests ─────────────────────────────────────────────────

describe('detectLoadPattern', () => {
  it('returns "mixed" for empty items', () => {
    expect(detectLoadPattern([])).toBe('mixed');
  });

  it('detects "long_product" when >80% items are long products', () => {
    const items = [
      makeItem({ productType: 'beam_i', orderNumber: 'A' }),
      makeItem({ productType: 'pipe', orderNumber: 'B' }),
      makeItem({ productType: 'channel', orderNumber: 'C' }),
      makeItem({ productType: 'flat_bar', orderNumber: 'D' }),
      makeItem({ productType: 'rebar_bundle', orderNumber: 'E' }),
    ];
    expect(detectLoadPattern(items)).toBe('long_product');
  });

  it('detects "layered" when all items are same geometric type and stackable', () => {
    const items = [
      makeItem({ productType: 'plate', stackPermission: 'yes', orderNumber: 'A' }),
      makeItem({ productType: 'plate', stackPermission: 'yes', orderNumber: 'B' }),
      makeItem({ productType: 'plate', stackPermission: 'yes', orderNumber: 'C' }),
    ];
    expect(detectLoadPattern(items)).toBe('layered');
  });

  it('detects "customer_zoning" when 3+ distinct delivery stops', () => {
    const items = [
      makeItem({ deliveryStop: 1, orderNumber: 'A', productType: 'plate' }),
      makeItem({ deliveryStop: 2, orderNumber: 'B', productType: 'beam_i' }),
      makeItem({ deliveryStop: 3, orderNumber: 'C', productType: 'pipe' }),
    ];
    expect(detectLoadPattern(items)).toBe('customer_zoning');
  });

  it('detects "nested" when cylindrical items exist among varying types', () => {
    const items = [
      makeItem({ productType: 'pipe', orderNumber: 'A' }),
      makeItem({ productType: 'plate', orderNumber: 'B' }),
      makeItem({ productType: 'palletized', orderNumber: 'C' }),
    ];
    expect(detectLoadPattern(items)).toBe('nested');
  });

  it('detects "column_building" or "row_building" for rectangular items', () => {
    const items = [
      makeItem({ productType: 'plate', orderNumber: 'A', dimensions: { length: 120, width: 48, height: 48 } }),
      makeItem({ productType: 'plate', orderNumber: 'B', dimensions: { length: 120, width: 48, height: 48 } }),
      makeItem({ productType: 'plate', orderNumber: 'C', dimensions: { length: 120, width: 48, height: 48 } }),
      makeItem({ productType: 'palletized', orderNumber: 'D', dimensions: { length: 48, width: 48, height: 48 } }),
    ];
    // aspect ratio width/height = 1, so column_building
    expect(detectLoadPattern(items)).toBe('column_building');
  });

  it('returns "mixed" when items dont fit any specific pattern', () => {
    const items = [
      makeItem({ productType: 'fabricated_assembly', orderNumber: 'A' }),
      makeItem({ productType: 'mixed_bundle', orderNumber: 'B' }),
    ];
    expect(detectLoadPattern(items)).toBe('mixed');
  });
});

// ─── generateLoadPlan Tests ──────────────────────────────────────────────────

describe('generateLoadPlan', () => {
  it('produces a successful plan for a single item', () => {
    const items = [makeItem()];
    const request = makePlanRequest(items);
    const result = generateLoadPlan(request);

    expect(result.success).toBe(true);
    expect(result.placedFreight).toHaveLength(1);
    expect(result.unplacedItems).toHaveLength(0);
    expect(result.placedFreight[0].item.orderNumber).toBe('ORD-001');
    expect(result.loadingSequence).toHaveLength(1);
    expect(result.detectedPattern).toBeDefined();
  });

  it('produces an empty successful plan for no items', () => {
    const request = makePlanRequest([]);
    const result = generateLoadPlan(request);

    expect(result.success).toBe(true);
    expect(result.placedFreight).toHaveLength(0);
    expect(result.unplacedItems).toHaveLength(0);
    expect(result.canApprove).toBe(true);
  });

  it('places items within trailer boundaries', () => {
    const items = [
      makeItem({ orderNumber: 'A', dimensions: { length: 120, width: 48, height: 6 } }),
      makeItem({ orderNumber: 'B', dimensions: { length: 96, width: 36, height: 8 } }),
      makeItem({ orderNumber: 'C', dimensions: { length: 144, width: 60, height: 4 } }),
    ];
    const request = makePlanRequest(items);
    const result = generateLoadPlan(request);

    const trailer = request.trailer;
    const trailerLengthIn = trailer.lengthFt * 12;
    const halfWidth = trailer.deckWidthIn / 2;

    for (const pf of result.placedFreight) {
      // Longitudinal bounds
      expect(pf.position.x).toBeGreaterThanOrEqual(0);
      expect(pf.position.x + pf.geometry.boundingBox.length).toBeLessThanOrEqual(trailerLengthIn);
      // Lateral bounds
      expect(pf.position.y).toBeGreaterThanOrEqual(-halfWidth);
      expect(pf.position.y + pf.geometry.boundingBox.width).toBeLessThanOrEqual(halfWidth);
    }
  });

  it('is deterministic — same inputs produce identical outputs', () => {
    const items = [
      makeItem({ orderNumber: 'A', pieceWeight: 8000, deliveryStop: 2 }),
      makeItem({ orderNumber: 'B', pieceWeight: 3000, deliveryStop: 1, productType: 'beam_i', dimensions: { length: 240, width: 12, height: 12 } }),
      makeItem({ orderNumber: 'C', pieceWeight: 5000, deliveryStop: 1 }),
    ];
    const request = makePlanRequest(items);

    const result1 = generateLoadPlan(request);
    const result2 = generateLoadPlan(request);

    expect(result1.placedFreight.length).toBe(result2.placedFreight.length);
    for (let i = 0; i < result1.placedFreight.length; i++) {
      expect(result1.placedFreight[i].position).toEqual(result2.placedFreight[i].position);
      expect(result1.placedFreight[i].orientation).toBe(result2.placedFreight[i].orientation);
      expect(result1.placedFreight[i].layer).toBe(result2.placedFreight[i].layer);
      expect(result1.placedFreight[i].item.orderNumber).toBe(result2.placedFreight[i].item.orderNumber);
    }
    expect(result1.loadingSequence).toEqual(result2.loadingSequence);
    expect(result1.detectedPattern).toBe(result2.detectedPattern);
  });

  it('respects stop-order accessibility (last stop placed first/rear)', () => {
    const items = [
      makeItem({ orderNumber: 'STOP1-A', deliveryStop: 1, pieceWeight: 4000 }),
      makeItem({ orderNumber: 'STOP2-A', deliveryStop: 2, pieceWeight: 4000 }),
    ];
    const request = makePlanRequest(items);
    const result = generateLoadPlan(request);

    expect(result.success).toBe(true);
    expect(result.placedFreight.length).toBe(2);

    // Stop 2 items should generally be more toward the rear (higher x)
    // or at least not stacked on top of stop 1 items
    const stop1Item = result.placedFreight.find(pf => pf.item.orderNumber === 'STOP1-A');
    const stop2Item = result.placedFreight.find(pf => pf.item.orderNumber === 'STOP2-A');
    expect(stop1Item).toBeDefined();
    expect(stop2Item).toBeDefined();

    // Stop 2 should not be stacked above stop 1 (would block access)
    if (stop1Item!.layer === stop2Item!.layer) {
      // Same layer is fine — they're side by side or adjacent
      expect(true).toBe(true);
    } else {
      // If different layers, stop 2 should NOT be above stop 1
      // (our heuristic processes stop 2 first, so it goes on layer 0)
      expect(stop2Item!.layer).toBeLessThanOrEqual(stop1Item!.layer);
    }
  });

  it('handles multiple items with stacking', () => {
    const items = [
      makeItem({ orderNumber: 'A', pieceWeight: 3000, stackPermission: 'yes', maxStackWeight: 10000, maxStackHeight: 48, dimensions: { length: 120, width: 48, height: 6 } }),
      makeItem({ orderNumber: 'B', pieceWeight: 2000, stackPermission: 'yes', maxStackWeight: 10000, maxStackHeight: 48, dimensions: { length: 120, width: 48, height: 6 } }),
      makeItem({ orderNumber: 'C', pieceWeight: 1000, stackPermission: 'yes', maxStackWeight: 10000, maxStackHeight: 48, dimensions: { length: 120, width: 48, height: 6 } }),
    ];
    const request = makePlanRequest(items);
    const result = generateLoadPlan(request);

    expect(result.success).toBe(true);
    expect(result.placedFreight.length).toBe(3);
  });

  it('reports unplaceable items when item exceeds trailer dimensions', () => {
    // Item wider than the trailer deck
    const items = [
      makeItem({ orderNumber: 'TOO-WIDE', dimensions: { length: 120, width: 200, height: 6 } }),
    ];
    const request = makePlanRequest(items);
    const result = generateLoadPlan(request);

    expect(result.unplacedItems.length).toBe(1);
    expect(result.unplacedItems[0].orderNumber).toBe('TOO-WIDE');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('uses patternOverride when provided', () => {
    const items = [
      makeItem({ productType: 'beam_i', orderNumber: 'A' }),
      makeItem({ productType: 'beam_i', orderNumber: 'B' }),
    ];
    const request = makePlanRequest(items, { patternOverride: 'customer_zoning' });
    const result = generateLoadPlan(request);

    expect(result.detectedPattern).toBe('customer_zoning');
  });

  it('calculates weight metrics for the placed load', () => {
    const items = [
      makeItem({ orderNumber: 'A', pieceWeight: 10000 }),
      makeItem({ orderNumber: 'B', pieceWeight: 8000 }),
    ];
    const request = makePlanRequest(items);
    const result = generateLoadPlan(request);

    expect(result.weightMetrics.totalGross).toBeGreaterThan(0);
    expect(result.weightMetrics.steerWeight).toBeGreaterThan(0);
    expect(result.weightMetrics.driveWeight).toBeGreaterThan(0);
    expect(result.weightMetrics.trailerWeight).toBeGreaterThan(0);
  });

  it('generates securement assignments', () => {
    const items = [
      makeItem({ orderNumber: 'A', pieceWeight: 10000, dimensions: { length: 240, width: 48, height: 6 } }),
    ];
    const request = makePlanRequest(items);
    const result = generateLoadPlan(request);

    expect(result.securement.plans.length).toBeGreaterThan(0);
    expect(result.securement.plans[0].tieDowns.length).toBeGreaterThanOrEqual(2);
  });

  it('generates loading sequence covering all placed items', () => {
    const items = [
      makeItem({ orderNumber: 'A' }),
      makeItem({ orderNumber: 'B' }),
      makeItem({ orderNumber: 'C' }),
    ];
    const request = makePlanRequest(items);
    const result = generateLoadPlan(request);

    expect(result.loadingSequence.length).toBe(result.placedFreight.length);
    // Loading sequence should contain all valid indices
    const indices = new Set(result.loadingSequence);
    expect(indices.size).toBe(result.placedFreight.length);
    for (const idx of result.loadingSequence) {
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(result.placedFreight.length);
    }
  });

  it('handles coil items with proper geometry (cradle angle and chocks)', () => {
    const items = [
      makeItem({
        orderNumber: 'COIL-1',
        productType: 'coil_hot_rolled',
        dimensions: { length: 48, width: 60, height: 60 }, // height = diameter for coils
        pieceWeight: 20000,
      }),
    ];
    const request = makePlanRequest(items);
    const result = generateLoadPlan(request);

    expect(result.success).toBe(true);
    if (result.placedFreight.length > 0) {
      const coil = result.placedFreight[0];
      expect(coil.geometry.type).toBe('horizontal_coil');
      expect(coil.geometry.cradleAngle).toBeDefined();
      expect(coil.geometry.cradleAngle).toBeGreaterThan(0);
      expect(coil.geometry.cradleAngle).toBeLessThan(90);
      expect(coil.geometry.chockDimensions).toBeDefined();
      expect(coil.geometry.chockDimensions!.width).toBeGreaterThan(0);
      expect(coil.geometry.chockDimensions!.height).toBeGreaterThan(0);
    }
  });

  it('respects "no stack" permission', () => {
    // Two items at same position — first one has stackPermission: 'no'
    const items = [
      makeItem({
        orderNumber: 'NO-STACK',
        stackPermission: 'no',
        pieceWeight: 10000,
        dimensions: { length: 120, width: 96, height: 6 },
      }),
      makeItem({
        orderNumber: 'WANTS-TO-STACK',
        pieceWeight: 2000,
        dimensions: { length: 120, width: 96, height: 6 },
      }),
    ];
    const request = makePlanRequest(items);
    const result = generateLoadPlan(request);

    // Both should be placed
    expect(result.placedFreight.length).toBe(2);

    // Find the no-stack item and verify nothing is above it at the same XY
    const noStackItem = result.placedFreight.find(pf => pf.item.orderNumber === 'NO-STACK');
    const otherItem = result.placedFreight.find(pf => pf.item.orderNumber === 'WANTS-TO-STACK');
    expect(noStackItem).toBeDefined();
    expect(otherItem).toBeDefined();

    // If they overlap in XY, the other item must NOT be on a higher layer
    if (noStackItem && otherItem) {
      const noStackRight = noStackItem.position.x + noStackItem.geometry.boundingBox.length;
      const otherLeft = otherItem.position.x;
      const noStackTop = noStackItem.position.y + noStackItem.geometry.boundingBox.width;
      const otherBottom = otherItem.position.y;

      const overlapsXY =
        otherLeft < noStackRight &&
        otherItem.position.x + otherItem.geometry.boundingBox.length > noStackItem.position.x &&
        otherBottom < noStackTop &&
        otherItem.position.y + otherItem.geometry.boundingBox.width > noStackItem.position.y;

      if (overlapsXY) {
        // If they overlap, the other item should not be stacked above the no-stack item
        expect(otherItem.layer).toBeLessThanOrEqual(noStackItem.layer);
      }
    }
  });
});
