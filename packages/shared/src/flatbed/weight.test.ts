// ─── Weight Calculator Unit Tests ────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  calculateAxleLoads,
  calculateWeightMetrics,
  calculateConcentratedLoad,
  calculateAxleUtilization,
} from './weight';
import type { WeightMetrics } from './weight';
import type {
  AxleGroup,
  EquipmentCombination,
  PlacedFreight,
  TractorProfile,
  TrailerProfile,
} from './types';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeTrailer(overrides: Partial<TrailerProfile> = {}): TrailerProfile {
  return {
    id: 'trailer-1',
    name: 'Test 53ft Flatbed',
    lengthFt: 53,
    deckWidthIn: 102,
    deckHeightIn: 60,
    maxGrossWeight: 80000,
    tareWeight: 15000,
    axleCount: 2,
    axlePositions: [480, 528], // tandem axles ~40-44ft from kingpin
    axleWeightRatings: [34000, 34000],
    kingpinPosition: 24,
    rearOverhangLimit: 48,
    deckMaterial: 'steel',
    stakePockets: [],
    anchorPoints: [],
    maxConcentratedLoadPSF: 800,
    ...overrides,
  };
}

function makeTractor(overrides: Partial<TractorProfile> = {}): TractorProfile {
  return {
    id: 'tractor-1',
    name: 'Test Day Cab',
    steerAxleRating: 12000,
    driveAxleRating: 34000,
    fifthWheelPosition: 150, // 150 inches from front of tractor
    tareWeight: 18000,
    driveAxleCount: 2,
    ...overrides,
  };
}

function makeEquipment(
  tractor: TractorProfile = makeTractor(),
  trailer: TrailerProfile = makeTrailer()
): EquipmentCombination {
  return {
    tractorId: tractor.id,
    trailerId: trailer.id,
    availablePayload: trailer.maxGrossWeight - tractor.tareWeight - trailer.tareWeight,
    totalLegalGross: trailer.maxGrossWeight,
    perAxleLimits: {
      steer: tractor.steerAxleRating,
      drive: tractor.driveAxleRating,
      trailer: trailer.axleWeightRatings.reduce((s, r) => s + r, 0),
    },
  };
}

function makePlacedFreight(overrides: Partial<PlacedFreight> = {}): PlacedFreight {
  return {
    item: {
      orderNumber: 'ORD-001',
      customerName: 'Test Customer',
      deliveryStop: 1,
      productType: 'plate',
      quantity: 1,
      pieceWeight: 10000,
      dimensions: { length: 120, width: 60, height: 6 },
      totalLineWeight: 10000,
      handlingMethod: 'crane',
      stackPermission: 'yes',
      maxStackHeight: 48,
      maxStackWeight: 40000,
      orientationRequirement: 'longitudinal',
      dunnageRequired: false,
      specialNotes: '',
    },
    geometry: {
      type: 'plate_stack',
      boundingBox: { length: 120, width: 60, height: 6 },
      contactFootprint: { area: 7200, shape: 'rectangle' },
      centerOfMass: { x: 60, y: 30, z: 3 },
    },
    position: { x: 100, y: 21, z: 0 }, // 100" from kingpin, centered-ish
    orientation: 'longitudinal',
    supportMethod: 'direct_to_deck',
    layer: 0,
    ...overrides,
  };
}

// ─── calculateAxleLoads Tests ────────────────────────────────────────────────

describe('calculateAxleLoads', () => {
  const trailerAxlePositions = [480, 528]; // center at 504"
  const fifthWheelPosition = 150;

  it('distributes weight for an item at the kingpin (position 0)', () => {
    const loads = calculateAxleLoads(10000, 0, trailerAxlePositions, fifthWheelPosition);

    // Item at kingpin: all load goes to fifth wheel, none to trailer axles
    expect(loads.trailer).toBeCloseTo(0, 0);
    expect(loads.steer + loads.drive).toBeCloseTo(10000, 0);
    // Total must equal item weight
    expect(loads.steer + loads.drive + loads.trailer).toBeCloseTo(10000, 5);
  });

  it('distributes weight for an item at the trailer axle center', () => {
    const axleCenter = 504; // average of 480 and 528
    const loads = calculateAxleLoads(10000, axleCenter, trailerAxlePositions, fifthWheelPosition);

    // Item at axle center: all load goes to trailer axles
    expect(loads.trailer).toBeCloseTo(10000, 0);
    expect(loads.steer).toBeCloseTo(0, 0);
    expect(loads.drive).toBeCloseTo(0, 0);
  });

  it('distributes weight for an item at midpoint between kingpin and axle center', () => {
    const axleCenter = 504;
    const midpoint = axleCenter / 2; // 252"
    const loads = calculateAxleLoads(10000, midpoint, trailerAxlePositions, fifthWheelPosition);

    // At midpoint: roughly 50% to each (fifth wheel and trailer axles)
    expect(loads.trailer).toBeCloseTo(5000, 0);
    expect(loads.steer + loads.drive).toBeCloseTo(5000, 0);
    // Conservation: total = item weight
    expect(loads.steer + loads.drive + loads.trailer).toBeCloseTo(10000, 5);
  });

  it('conserves total weight regardless of position', () => {
    const positions = [0, 100, 200, 300, 400, 504];
    for (const pos of positions) {
      const loads = calculateAxleLoads(20000, pos, trailerAxlePositions, fifthWheelPosition);
      expect(loads.steer + loads.drive + loads.trailer).toBeCloseTo(20000, 5);
    }
  });

  it('returns zeros for invalid inputs', () => {
    expect(calculateAxleLoads(0, 100, trailerAxlePositions, fifthWheelPosition))
      .toEqual({ steer: 0, drive: 0, trailer: 0 });
    expect(calculateAxleLoads(-100, 100, trailerAxlePositions, fifthWheelPosition))
      .toEqual({ steer: 0, drive: 0, trailer: 0 });
    expect(calculateAxleLoads(10000, 100, [], fifthWheelPosition))
      .toEqual({ steer: 0, drive: 0, trailer: 0 });
    expect(calculateAxleLoads(10000, 100, trailerAxlePositions, 0))
      .toEqual({ steer: 0, drive: 0, trailer: 0 });
  });

  it('puts more load on drive than steer (standard tractor geometry)', () => {
    const loads = calculateAxleLoads(10000, 200, trailerAxlePositions, fifthWheelPosition);
    expect(loads.drive).toBeGreaterThan(loads.steer);
  });

  it('handles single axle trailer', () => {
    const loads = calculateAxleLoads(10000, 250, [500], fifthWheelPosition);
    expect(loads.steer + loads.drive + loads.trailer).toBeCloseTo(10000, 5);
    expect(loads.trailer).toBeCloseTo(5000, 0); // half way = 50%
  });
});

// ─── calculateConcentratedLoad Tests ─────────────────────────────────────────

describe('calculateConcentratedLoad', () => {
  it('calculates PSF for a single item with no overlapping items', () => {
    const item = makePlacedFreight();
    // plate_stack footprint = length × width = 120 × 60 = 7200 sq in = 50 sq ft
    // PSF = 10000 / 50 = 200 PSF
    const psf = calculateConcentratedLoad(item, []);
    expect(psf).toBeCloseTo(200, 0);
  });

  it('adds overlapping item weight to the concentrated load', () => {
    const baseItem = makePlacedFreight();
    const stackedItem = makePlacedFreight({
      item: {
        ...makePlacedFreight().item,
        orderNumber: 'ORD-002',
        pieceWeight: 5000,
        totalLineWeight: 5000,
      },
      position: { x: 100, y: 21, z: 6 },
      layer: 1,
    });

    // Total weight = 10000 + 5000 = 15000
    // Footprint of base item = 120 × 60 = 7200 sq in = 50 sq ft
    // PSF = 15000 / 50 = 300 PSF
    const psf = calculateConcentratedLoad(baseItem, [stackedItem]);
    expect(psf).toBeCloseTo(300, 0);
  });

  it('handles multiple overlapping items', () => {
    const baseItem = makePlacedFreight();
    const stacked1 = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'ORD-002', pieceWeight: 3000, quantity: 1 },
      layer: 1,
    });
    const stacked2 = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'ORD-003', pieceWeight: 2000, quantity: 1 },
      layer: 2,
    });

    // Total = 10000 + 3000 + 2000 = 15000
    const psf = calculateConcentratedLoad(baseItem, [stacked1, stacked2]);
    expect(psf).toBeCloseTo(300, 0);
  });

  it('accounts for quantity when calculating weight', () => {
    const item = makePlacedFreight({
      item: { ...makePlacedFreight().item, pieceWeight: 5000, quantity: 3 },
    });
    // Weight = 5000 × 3 = 15000
    // Footprint = 50 sq ft
    // PSF = 15000 / 50 = 300
    const psf = calculateConcentratedLoad(item, []);
    expect(psf).toBeCloseTo(300, 0);
  });
});

// ─── calculateAxleUtilization Tests ──────────────────────────────────────────

describe('calculateAxleUtilization', () => {
  it('calculates correct percentages', () => {
    const utilization = calculateAxleUtilization(
      6000, 17000, 34000,
      { steer: 12000, drive: 34000, trailer: 68000 }
    );

    expect(utilization.steer).toBeCloseTo(50, 5);
    expect(utilization.drive).toBeCloseTo(50, 5);
    expect(utilization.trailer).toBeCloseTo(50, 5);
  });

  it('returns 100% when at full capacity', () => {
    const utilization = calculateAxleUtilization(
      12000, 34000, 68000,
      { steer: 12000, drive: 34000, trailer: 68000 }
    );

    expect(utilization.steer).toBeCloseTo(100, 5);
    expect(utilization.drive).toBeCloseTo(100, 5);
    expect(utilization.trailer).toBeCloseTo(100, 5);
  });

  it('allows over 100% (overweight detection)', () => {
    const utilization = calculateAxleUtilization(
      15000, 40000, 75000,
      { steer: 12000, drive: 34000, trailer: 68000 }
    );

    expect(utilization.steer).toBeCloseTo(125, 5);
    expect(utilization.drive).toBeGreaterThan(100);
    expect(utilization.trailer).toBeGreaterThan(100);
  });

  it('handles zero axle limits gracefully', () => {
    const utilization = calculateAxleUtilization(
      5000, 10000, 20000,
      { steer: 0, drive: 0, trailer: 0 }
    );

    expect(utilization.steer).toBe(0);
    expect(utilization.drive).toBe(0);
    expect(utilization.trailer).toBe(0);
  });
});

// ─── calculateWeightMetrics Tests ────────────────────────────────────────────

describe('calculateWeightMetrics', () => {
  const trailer = makeTrailer();
  const tractor = makeTractor();
  const equipment = makeEquipment(tractor, trailer);

  it('returns base tare weights with no freight', () => {
    const metrics = calculateWeightMetrics([], equipment, trailer, tractor);

    // With no freight, total gross = tractor tare + trailer tare
    expect(metrics.totalGross).toBeCloseTo(tractor.tareWeight + trailer.tareWeight, -1);
    expect(metrics.steerWeight + metrics.driveWeight + metrics.trailerWeight)
      .toBeCloseTo(metrics.totalGross, 5);
    expect(metrics.cgLongitudinal).toBe(0);
    expect(metrics.cgLateral).toBe(0);
    expect(metrics.maxConcentratedLoadPSF).toBe(0);
  });

  it('conserves total weight: sum of axle weights = totalGross', () => {
    const freight = [makePlacedFreight()];
    const metrics = calculateWeightMetrics(freight, equipment, trailer, tractor);

    const axleSum = metrics.steerWeight + metrics.driveWeight + metrics.trailerWeight;
    expect(axleSum).toBeCloseTo(metrics.totalGross, 5);
  });

  it('totalGross equals tractor tare + trailer tare + freight weight', () => {
    const freight = [makePlacedFreight()];
    const metrics = calculateWeightMetrics(freight, equipment, trailer, tractor);

    const expectedGross = tractor.tareWeight + trailer.tareWeight + 10000; // 10000 lb freight
    expect(metrics.totalGross).toBeCloseTo(expectedGross, -1);
  });

  it('calculates longitudinal CG correctly for single centered item', () => {
    // Item at position x=100, length=120, so CG at x=160
    const freight = [makePlacedFreight()];
    const metrics = calculateWeightMetrics(freight, equipment, trailer, tractor);

    expect(metrics.cgLongitudinal).toBeCloseTo(160, 5); // x + length/2
  });

  it('calculates lateral CG offset', () => {
    // Item at position y=21, width=60, so CG at y=51 (right of centerline=0)
    const freight = [makePlacedFreight()];
    const metrics = calculateWeightMetrics(freight, equipment, trailer, tractor);

    expect(metrics.cgLateral).toBeCloseTo(51, 5);
  });

  it('reports zero lateral imbalance when freight is centered', () => {
    // Center the item laterally: y = -width/2 = -30 puts CG at y=0
    const centeredFreight = makePlacedFreight({
      position: { x: 100, y: -30, z: 0 },
    });
    const metrics = calculateWeightMetrics([centeredFreight], equipment, trailer, tractor);

    expect(metrics.cgLateral).toBeCloseTo(0, 5);
    expect(metrics.lateralImbalancePercent).toBeCloseTo(0, 5);
  });

  it('finds maximum concentrated load across all items', () => {
    // Small footprint item should have higher PSF
    const heavySmallItem = makePlacedFreight({
      item: {
        ...makePlacedFreight().item,
        orderNumber: 'ORD-HEAVY',
        pieceWeight: 20000,
        quantity: 1,
      },
      geometry: {
        type: 'rectangular',
        boundingBox: { length: 24, width: 24, height: 24 },
        contactFootprint: { area: 576, shape: 'rectangle' },
        centerOfMass: { x: 12, y: 12, z: 12 },
      },
      position: { x: 200, y: 21, z: 0 },
    });

    const lightLargeItem = makePlacedFreight(); // 10000 lbs on 7200 sq in

    const metrics = calculateWeightMetrics(
      [heavySmallItem, lightLargeItem],
      equipment, trailer, tractor
    );

    // Heavy small item: 20000 / (576/144) = 20000 / 4 = 5000 PSF
    // Light large item: 10000 / (7200/144) = 10000 / 50 = 200 PSF
    expect(metrics.maxConcentratedLoadPSF).toBeCloseTo(5000, 0);
  });

  it('computes axle utilization percentages', () => {
    const freight = [makePlacedFreight()];
    const metrics = calculateWeightMetrics(freight, equipment, trailer, tractor);

    // All utilization values should be between 0 and 100 for a normal load
    expect(metrics.axleUtilization.steer).toBeGreaterThan(0);
    expect(metrics.axleUtilization.drive).toBeGreaterThan(0);
    expect(metrics.axleUtilization.trailer).toBeGreaterThan(0);
  });

  it('handles multiple freight items and sums them correctly', () => {
    const item1 = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'ORD-1', pieceWeight: 8000 },
      position: { x: 100, y: 0, z: 0 },
    });
    const item2 = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'ORD-2', pieceWeight: 12000 },
      position: { x: 300, y: 0, z: 0 },
    });

    const metrics = calculateWeightMetrics([item1, item2], equipment, trailer, tractor);

    const expectedGross = tractor.tareWeight + trailer.tareWeight + 8000 + 12000;
    expect(metrics.totalGross).toBeCloseTo(expectedGross, -1);
    expect(metrics.steerWeight + metrics.driveWeight + metrics.trailerWeight)
      .toBeCloseTo(metrics.totalGross, 5);
  });
});
