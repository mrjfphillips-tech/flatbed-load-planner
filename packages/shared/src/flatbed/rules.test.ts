// ─── Rules Engine Unit Tests ─────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import {
  evaluateAllRules,
  defaultRules,
  axleOverweightRule,
  grossWeightRule,
  concentratedLoadRule,
  stopOrderAccessibilityRule,
  antiRollSecurementRule,
  boundaryViolationRule,
  heavierItemsLowerRule,
  cgPositionRule,
  lateralImbalanceRule,
  dissimilarMetalsDunnageRule,
} from './rules';
import type { RuleContext } from './rules';
import type {
  EquipmentCombination,
  PlacedFreight,
  TractorProfile,
  TrailerProfile,
} from './types';
import type { WeightMetrics } from './weight';

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
    axlePositions: [480, 528],
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
    fifthWheelPosition: 150,
    tareWeight: 18000,
    driveAxleCount: 2,
    ...overrides,
  };
}

function makeEquipment(overrides: Partial<EquipmentCombination> = {}): EquipmentCombination {
  return {
    tractorId: 'tractor-1',
    trailerId: 'trailer-1',
    availablePayload: 47000,
    totalLegalGross: 80000,
    perAxleLimits: { steer: 12000, drive: 34000, trailer: 68000 },
    ...overrides,
  };
}

function makeWeightMetrics(overrides: Partial<WeightMetrics> = {}): WeightMetrics {
  return {
    totalGross: 60000,
    steerWeight: 8000,
    driveWeight: 22000,
    trailerWeight: 30000,
    cgLongitudinal: 280,
    cgLateral: 0,
    lateralImbalancePercent: 0,
    maxConcentratedLoadPSF: 300,
    axleUtilization: { steer: 66.7, drive: 64.7, trailer: 44.1 },
    ...overrides,
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
    position: { x: 100, y: -30, z: 0 },
    orientation: 'longitudinal',
    supportMethod: 'direct_to_deck',
    layer: 0,
    ...overrides,
  };
}

function makeContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    placedFreight: [makePlacedFreight()],
    equipment: makeEquipment(),
    trailer: makeTrailer(),
    tractor: makeTractor(),
    weightMetrics: makeWeightMetrics(),
    ...overrides,
  };
}

// ─── Hard Constraint Tests ───────────────────────────────────────────────────

describe('axleOverweightRule', () => {
  it('passes when all axles are within limits', () => {
    const ctx = makeContext();
    const result = axleOverweightRule.evaluate(ctx);
    expect(result.passed).toBe(true);
    expect(result.severity).toBe('error');
  });

  it('fails when steer axle exceeds rating', () => {
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({ steerWeight: 15000 }),
    });
    const result = axleOverweightRule.evaluate(ctx);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
    expect(result.message).toContain('steer');
    expect(result.message).toContain('3000 lbs over');
  });

  it('fails when drive axle exceeds rating', () => {
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({ driveWeight: 40000 }),
    });
    const result = axleOverweightRule.evaluate(ctx);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('drive');
  });

  it('includes suggested action', () => {
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({ trailerWeight: 75000 }),
    });
    const result = axleOverweightRule.evaluate(ctx);
    expect(result.passed).toBe(false);
    expect(result.suggestedAction).toBeDefined();
    expect(result.suggestedAction!.length).toBeGreaterThan(0);
  });
});

describe('grossWeightRule', () => {
  it('passes when gross weight is within limit', () => {
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({ totalGross: 75000 }),
    });
    const result = grossWeightRule.evaluate(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when gross weight exceeds limit', () => {
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({ totalGross: 85000 }),
    });
    const result = grossWeightRule.evaluate(ctx);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
    expect(result.message).toContain('85000');
    expect(result.message).toContain('80000');
    expect(result.suggestedAction).toContain('5000');
  });
});

describe('concentratedLoadRule', () => {
  it('passes when concentrated load is within trailer rating', () => {
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({ maxConcentratedLoadPSF: 500 }),
    });
    const result = concentratedLoadRule.evaluate(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when concentrated load exceeds trailer rating', () => {
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({ maxConcentratedLoadPSF: 1200 }),
    });
    const result = concentratedLoadRule.evaluate(ctx);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
    expect(result.message).toContain('1200');
    expect(result.message).toContain('800');
  });

  it('is not applicable when no freight is placed', () => {
    const ctx = makeContext({ placedFreight: [] });
    expect(concentratedLoadRule.isApplicable(ctx)).toBe(false);
  });
});

describe('stopOrderAccessibilityRule', () => {
  it('passes when later-stop items do not block earlier-stop items', () => {
    const item1 = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'ORD-1', deliveryStop: 1 },
      position: { x: 100, y: -30, z: 0 },
      layer: 0,
    });
    const item2 = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'ORD-2', deliveryStop: 2 },
      position: { x: 300, y: -30, z: 0 },
      layer: 0,
    });
    const ctx = makeContext({ placedFreight: [item1, item2] });
    const result = stopOrderAccessibilityRule.evaluate(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when a later-stop item is stacked above an earlier-stop item', () => {
    const item1 = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'ORD-1', deliveryStop: 1 },
      position: { x: 100, y: -30, z: 0 },
      layer: 0,
    });
    const item2 = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'ORD-2', deliveryStop: 2 },
      position: { x: 100, y: -30, z: 6 },
      layer: 1,
    });
    const ctx = makeContext({ placedFreight: [item1, item2] });
    const result = stopOrderAccessibilityRule.evaluate(ctx);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('ORD-2');
    expect(result.message).toContain('ORD-1');
  });

  it('is not applicable with only one delivery stop', () => {
    const ctx = makeContext();
    expect(stopOrderAccessibilityRule.isApplicable(ctx)).toBe(false);
  });
});

describe('antiRollSecurementRule', () => {
  it('passes when cylindrical items have cradle angle', () => {
    const coilItem = makePlacedFreight({
      item: { ...makePlacedFreight().item, productType: 'coil_hot_rolled' },
      geometry: {
        type: 'horizontal_coil',
        boundingBox: { length: 48, width: 60, height: 60 },
        contactFootprint: { area: 288, shape: 'line' },
        centerOfMass: { x: 24, y: 30, z: 30 },
        cradleAngle: 45,
      },
    });
    const ctx = makeContext({ placedFreight: [coilItem] });
    const result = antiRollSecurementRule.evaluate(ctx);
    expect(result.passed).toBe(true);
  });

  it('passes when cylindrical items have chock dimensions', () => {
    const coilItem = makePlacedFreight({
      item: { ...makePlacedFreight().item, productType: 'coil_hot_rolled' },
      geometry: {
        type: 'horizontal_coil',
        boundingBox: { length: 48, width: 60, height: 60 },
        contactFootprint: { area: 288, shape: 'line' },
        centerOfMass: { x: 24, y: 30, z: 30 },
        chockDimensions: { width: 20, height: 15 },
      },
    });
    const ctx = makeContext({ placedFreight: [coilItem] });
    const result = antiRollSecurementRule.evaluate(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when cylindrical items lack anti-roll securement', () => {
    const coilItem = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'COIL-1', productType: 'coil_hot_rolled' },
      geometry: {
        type: 'horizontal_coil',
        boundingBox: { length: 48, width: 60, height: 60 },
        contactFootprint: { area: 288, shape: 'line' },
        centerOfMass: { x: 24, y: 30, z: 30 },
        // no cradleAngle, no chockDimensions
      },
    });
    const ctx = makeContext({ placedFreight: [coilItem] });
    const result = antiRollSecurementRule.evaluate(ctx);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('error');
    expect(result.affectedItems).toContain('COIL-1');
  });

  it('is not applicable when no cylindrical items exist', () => {
    const ctx = makeContext(); // plate_stack geometry
    expect(antiRollSecurementRule.isApplicable(ctx)).toBe(false);
  });
});

describe('boundaryViolationRule', () => {
  it('passes when all items are within deck boundaries', () => {
    const ctx = makeContext();
    const result = boundaryViolationRule.evaluate(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when an item extends beyond trailer length', () => {
    const longItem = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'LONG-1' },
      position: { x: 600, y: -30, z: 0 }, // 600" + 120" length = 720" > 636" (53ft)
    });
    const ctx = makeContext({ placedFreight: [longItem] });
    const result = boundaryViolationRule.evaluate(ctx);
    expect(result.passed).toBe(false);
    expect(result.affectedItems).toContain('LONG-1');
  });

  it('fails when an item extends beyond trailer width', () => {
    const wideItem = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'WIDE-1' },
      position: { x: 100, y: 30, z: 0 }, // y=30, width=60, so end = 90 > halfWidth=51
    });
    const ctx = makeContext({ placedFreight: [wideItem] });
    const result = boundaryViolationRule.evaluate(ctx);
    expect(result.passed).toBe(false);
    expect(result.affectedItems).toContain('WIDE-1');
  });

  it('fails when an item has negative x position', () => {
    const negItem = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'NEG-1' },
      position: { x: -10, y: -30, z: 0 },
    });
    const ctx = makeContext({ placedFreight: [negItem] });
    const result = boundaryViolationRule.evaluate(ctx);
    expect(result.passed).toBe(false);
  });
});

// ─── Soft Preference Tests ───────────────────────────────────────────────────

describe('heavierItemsLowerRule', () => {
  it('passes when heavier items are on lower layers', () => {
    const heavy = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'HEAVY', pieceWeight: 20000 },
      position: { x: 100, y: -30, z: 0 },
      layer: 0,
    });
    const light = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'LIGHT', pieceWeight: 5000 },
      position: { x: 100, y: -30, z: 6 },
      layer: 1,
    });
    const ctx = makeContext({ placedFreight: [heavy, light] });
    const result = heavierItemsLowerRule.evaluate(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when a heavier item is above a lighter one', () => {
    const light = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'LIGHT', pieceWeight: 5000 },
      position: { x: 100, y: -30, z: 0 },
      layer: 0,
    });
    const heavy = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'HEAVY', pieceWeight: 20000 },
      position: { x: 100, y: -30, z: 6 },
      layer: 1,
    });
    const ctx = makeContext({ placedFreight: [light, heavy] });
    const result = heavierItemsLowerRule.evaluate(ctx);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.message).toContain('HEAVY');
    expect(result.message).toContain('LIGHT');
  });

  it('is not applicable when no stacking exists', () => {
    const ctx = makeContext(); // single item at layer 0
    expect(heavierItemsLowerRule.isApplicable(ctx)).toBe(false);
  });
});

describe('cgPositionRule', () => {
  it('passes when CG is at 45% of trailer length', () => {
    // 53ft = 636", 45% = 286.2"
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({ cgLongitudinal: 286 }),
    });
    const result = cgPositionRule.evaluate(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when CG is too far forward (< 40%)', () => {
    // 53ft = 636", 30% = 190.8"
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({ cgLongitudinal: 190 }),
    });
    const result = cgPositionRule.evaluate(ctx);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.message).toContain('forward');
  });

  it('fails when CG is too far rearward (> 50%)', () => {
    // 53ft = 636", 60% = 381.6"
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({ cgLongitudinal: 382 }),
    });
    const result = cgPositionRule.evaluate(ctx);
    expect(result.passed).toBe(false);
    expect(result.message).toContain('rearward');
  });
});

describe('lateralImbalanceRule', () => {
  it('passes when imbalance is within 5%', () => {
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({ lateralImbalancePercent: 3.5 }),
    });
    const result = lateralImbalanceRule.evaluate(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when imbalance exceeds 5%', () => {
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({ lateralImbalancePercent: 8.2 }),
    });
    const result = lateralImbalanceRule.evaluate(ctx);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.message).toContain('8.2%');
  });
});

describe('dissimilarMetalsDunnageRule', () => {
  it('passes when dissimilar metals have dunnage between them', () => {
    const hotRolled = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'HR-1', productType: 'coil_hot_rolled' },
      position: { x: 100, y: -30, z: 0 },
      layer: 0,
    });
    const galvanized = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'GV-1', productType: 'coil_galvanized' },
      position: { x: 100, y: -30, z: 60 },
      layer: 1,
      supportMethod: 'on_dunnage',
    });
    const ctx = makeContext({ placedFreight: [hotRolled, galvanized] });
    const result = dissimilarMetalsDunnageRule.evaluate(ctx);
    expect(result.passed).toBe(true);
  });

  it('fails when dissimilar metals are stacked without dunnage', () => {
    const hotRolled = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'HR-1', productType: 'coil_hot_rolled' },
      position: { x: 100, y: -30, z: 0 },
      layer: 0,
    });
    const galvanized = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'GV-1', productType: 'coil_galvanized' },
      position: { x: 100, y: -30, z: 60 },
      layer: 1,
      supportMethod: 'on_prior_layer',
    });
    const ctx = makeContext({ placedFreight: [hotRolled, galvanized] });
    const result = dissimilarMetalsDunnageRule.evaluate(ctx);
    expect(result.passed).toBe(false);
    expect(result.severity).toBe('warning');
    expect(result.message).toContain('dunnage');
  });

  it('passes when same-type metals are stacked without dunnage', () => {
    const plate1 = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'PL-1', productType: 'plate' },
      position: { x: 100, y: -30, z: 0 },
      layer: 0,
    });
    const plate2 = makePlacedFreight({
      item: { ...makePlacedFreight().item, orderNumber: 'PL-2', productType: 'plate' },
      position: { x: 100, y: -30, z: 6 },
      layer: 1,
      supportMethod: 'on_prior_layer',
    });
    const ctx = makeContext({ placedFreight: [plate1, plate2] });
    const result = dissimilarMetalsDunnageRule.evaluate(ctx);
    expect(result.passed).toBe(true);
  });
});

// ─── evaluateAllRules Tests ──────────────────────────────────────────────────

describe('evaluateAllRules', () => {
  it('returns canApprove=true when no hard constraints are violated', () => {
    const ctx = makeContext();
    const { results, canApprove } = evaluateAllRules(defaultRules, ctx);
    // With default metrics (all within bounds), should be approvable
    expect(canApprove).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns canApprove=false when a hard constraint is violated', () => {
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({ totalGross: 90000 }),
    });
    const { canApprove } = evaluateAllRules(defaultRules, ctx);
    expect(canApprove).toBe(false);
  });

  it('returns canApprove=true even with soft preference violations', () => {
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({ lateralImbalancePercent: 10 }),
    });
    const { results, canApprove } = evaluateAllRules(defaultRules, ctx);
    expect(canApprove).toBe(true);
    // Should have a warning from lateral imbalance
    const lateralResult = results.find((r) => r.ruleId === 'soft_lateral_imbalance');
    expect(lateralResult?.passed).toBe(false);
    expect(lateralResult?.severity).toBe('warning');
  });

  it('skips rules that are not applicable', () => {
    const ctx = makeContext({ placedFreight: [] });
    const { results } = evaluateAllRules(defaultRules, ctx);
    // Rules with isApplicable returning false should not appear
    const concentratedResult = results.find((r) => r.ruleId === 'hard_concentrated_load');
    expect(concentratedResult).toBeUndefined();
  });

  it('maps severity correctly: hard→error, soft→warning', () => {
    const ctx = makeContext({
      weightMetrics: makeWeightMetrics({
        totalGross: 90000,
        lateralImbalancePercent: 8,
      }),
    });
    const { results } = evaluateAllRules(defaultRules, ctx);

    const hardResult = results.find((r) => r.ruleId === 'hard_gross_weight');
    expect(hardResult?.severity).toBe('error');

    const softResult = results.find((r) => r.ruleId === 'soft_lateral_imbalance');
    expect(softResult?.severity).toBe('warning');
  });

  it('all rule results include plain language messages', () => {
    const ctx = makeContext();
    const { results } = evaluateAllRules(defaultRules, ctx);
    for (const result of results) {
      expect(result.message.length).toBeGreaterThan(0);
      // No formulas or technical symbols
      expect(result.message).not.toContain('=');
      expect(result.message).not.toContain('>=');
      expect(result.message).not.toContain('<=');
    }
  });
});
