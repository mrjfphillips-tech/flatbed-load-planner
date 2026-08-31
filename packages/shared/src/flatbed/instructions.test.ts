// ─── OptiFlow Flatbed Steel Load Planner — Instructions Unit Tests ───────────
import { describe, it, expect } from 'vitest';
import {
  generateLoadingSequence,
  generateUnloadingInstructions,
  formatInstructions,
} from './instructions';
import type { PlacedFreight, TrailerProfile } from './types';
import type { SecurementAssignment, SecurementPlan } from './securement';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function createTrailer(overrides?: Partial<TrailerProfile>): TrailerProfile {
  return {
    id: 'trailer-1',
    name: 'Standard 53ft',
    lengthFt: 53,
    deckWidthIn: 102,
    deckHeightIn: 60,
    maxGrossWeight: 80000,
    tareWeight: 15000,
    axleCount: 2,
    axlePositions: [480, 528],
    axleWeightRatings: [34000, 34000],
    kingpinPosition: 36,
    rearOverhangLimit: 48,
    deckMaterial: 'steel',
    stakePockets: [],
    anchorPoints: [
      { x: 100, y: -40 }, { x: 100, y: 40 },
      { x: 200, y: -40 }, { x: 200, y: 40 },
      { x: 300, y: -40 }, { x: 300, y: 40 },
      { x: 400, y: -40 }, { x: 400, y: 40 },
    ],
    maxConcentratedLoadPSF: 500,
    ...overrides,
  };
}

function createPlacedFreight(overrides: {
  orderNumber?: string;
  productType?: any;
  deliveryStop?: number;
  x?: number;
  y?: number;
  z?: number;
  layer?: number;
  orientation?: 'longitudinal' | 'transverse';
  supportMethod?: 'direct_to_deck' | 'on_dunnage' | 'on_prior_layer';
  totalLineWeight?: number;
}): PlacedFreight {
  return {
    item: {
      orderNumber: overrides.orderNumber ?? 'ORD-001',
      customerName: 'Test Customer',
      deliveryStop: overrides.deliveryStop ?? 1,
      productType: overrides.productType ?? 'plate',
      quantity: 1,
      pieceWeight: overrides.totalLineWeight ?? 5000,
      dimensions: { length: 120, width: 48, height: 12 },
      totalLineWeight: overrides.totalLineWeight ?? 5000,
      handlingMethod: 'crane',
      stackPermission: 'yes',
      maxStackHeight: 96,
      maxStackWeight: 20000,
      orientationRequirement: 'any',
      dunnageRequired: overrides.supportMethod === 'on_dunnage',
      specialNotes: '',
    },
    geometry: {
      type: 'plate_stack',
      boundingBox: { length: 120, width: 48, height: 12 },
      contactFootprint: { area: 5760, shape: 'rectangle' },
      centerOfMass: { x: 60, y: 24, z: 6 },
    },
    position: { x: overrides.x ?? 0, y: overrides.y ?? 0, z: overrides.z ?? 0 },
    orientation: overrides.orientation ?? 'longitudinal',
    supportMethod: overrides.supportMethod ?? 'direct_to_deck',
    layer: overrides.layer ?? 0,
  };
}

function createSecurementAssignment(
  plans: SecurementPlan[]
): SecurementAssignment {
  return {
    plans,
    anchorPointsUsed: plans.reduce((sum, p) => sum + p.tieDowns.length, 0),
    anchorPointsAvailable: 8,
    hasOverflow: false,
  };
}

function createSecurementPlan(orderNumber: string, tieDownCount = 2): SecurementPlan {
  return {
    itemOrderNumber: orderNumber,
    tieDowns: Array.from({ length: tieDownCount }, (_, i) => ({
      type: 'chain' as const,
      wll: 4700,
      anchorPointId: `anchor-${i}`,
      position: { x: 100 + i * 50, y: 0 },
    })),
    additionalSecurement: ['edge_protector' as const],
    aggregateWLL: tieDownCount * 4700,
    requiredWLL: 2500,
    meetsRequirements: true,
    notes: [],
  };
}

// ─── Test Cases ──────────────────────────────────────────────────────────────

describe('generateLoadingSequence', () => {
  it('returns empty array for no placed freight', () => {
    const trailer = createTrailer();
    const securement = createSecurementAssignment([]);
    const result = generateLoadingSequence([], trailer, securement);
    expect(result).toEqual([]);
  });

  it('generates numbered steps starting from 1', () => {
    const trailer = createTrailer();
    const freight = [
      createPlacedFreight({ orderNumber: 'ORD-001', x: 500 }),
      createPlacedFreight({ orderNumber: 'ORD-002', x: 300 }),
    ];
    const securement = createSecurementAssignment([
      createSecurementPlan('ORD-001'),
      createSecurementPlan('ORD-002'),
    ]);

    const result = generateLoadingSequence(freight, trailer, securement);

    expect(result.length).toBe(2);
    expect(result[0].stepNumber).toBe(1);
    expect(result[1].stepNumber).toBe(2);
  });

  it('orders by layer first (lower layers loaded first)', () => {
    const trailer = createTrailer();
    const freight = [
      createPlacedFreight({ orderNumber: 'ORD-LAYER1', x: 300, layer: 1, z: 12 }),
      createPlacedFreight({ orderNumber: 'ORD-LAYER0', x: 300, layer: 0, z: 0 }),
    ];
    const securement = createSecurementAssignment([
      createSecurementPlan('ORD-LAYER1'),
      createSecurementPlan('ORD-LAYER0'),
    ]);

    const result = generateLoadingSequence(freight, trailer, securement);

    expect(result[0].itemDescription).toContain('ORD-LAYER0');
    expect(result[1].itemDescription).toContain('ORD-LAYER1');
  });

  it('within same layer, orders rear items first (higher X first)', () => {
    const trailer = createTrailer();
    const freight = [
      createPlacedFreight({ orderNumber: 'ORD-FRONT', x: 100 }),
      createPlacedFreight({ orderNumber: 'ORD-REAR', x: 500 }),
    ];
    const securement = createSecurementAssignment([
      createSecurementPlan('ORD-FRONT'),
      createSecurementPlan('ORD-REAR'),
    ]);

    const result = generateLoadingSequence(freight, trailer, securement);

    expect(result[0].itemDescription).toContain('ORD-REAR');
    expect(result[1].itemDescription).toContain('ORD-FRONT');
  });

  it('includes plain-language position description', () => {
    const trailer = createTrailer();
    const freight = [createPlacedFreight({ orderNumber: 'ORD-001', x: 50, y: -40 })];
    const securement = createSecurementAssignment([createSecurementPlan('ORD-001')]);

    const result = generateLoadingSequence(freight, trailer, securement);

    expect(result[0].position).toContain('front');
    expect(result[0].position).toContain('left');
  });

  it('includes orientation description', () => {
    const trailer = createTrailer();
    const freight = [createPlacedFreight({ orderNumber: 'ORD-001', orientation: 'transverse' })];
    const securement = createSecurementAssignment([createSecurementPlan('ORD-001')]);

    const result = generateLoadingSequence(freight, trailer, securement);

    expect(result[0].orientation).toContain('crosswise');
  });

  it('includes dunnage instruction when support method is on_dunnage', () => {
    const trailer = createTrailer();
    const freight = [createPlacedFreight({ orderNumber: 'ORD-001', supportMethod: 'on_dunnage' })];
    const securement = createSecurementAssignment([createSecurementPlan('ORD-001')]);

    const result = generateLoadingSequence(freight, trailer, securement);

    expect(result[0].dunnageFirst).not.toBeNull();
    expect(result[0].dunnageFirst).toContain('dunnage');
  });

  it('sets dunnageFirst to null when no dunnage is needed', () => {
    const trailer = createTrailer();
    const freight = [createPlacedFreight({ orderNumber: 'ORD-001', supportMethod: 'direct_to_deck' })];
    const securement = createSecurementAssignment([createSecurementPlan('ORD-001')]);

    const result = generateLoadingSequence(freight, trailer, securement);

    expect(result[0].dunnageFirst).toBeNull();
  });

  it('includes securement instructions referencing the plan', () => {
    const trailer = createTrailer();
    const freight = [createPlacedFreight({ orderNumber: 'ORD-001' })];
    const securement = createSecurementAssignment([createSecurementPlan('ORD-001', 3)]);

    const result = generateLoadingSequence(freight, trailer, securement);

    expect(result[0].securementAfter).toContain('3');
    expect(result[0].securementAfter).toContain('chain');
  });
});

describe('generateUnloadingInstructions', () => {
  it('returns empty array for no placed freight', () => {
    const securement = createSecurementAssignment([]);
    const result = generateUnloadingInstructions([], securement);
    expect(result).toEqual([]);
  });

  it('groups items by delivery stop', () => {
    const freight = [
      createPlacedFreight({ orderNumber: 'ORD-001', deliveryStop: 1 }),
      createPlacedFreight({ orderNumber: 'ORD-002', deliveryStop: 2, x: 200 }),
      createPlacedFreight({ orderNumber: 'ORD-003', deliveryStop: 1, x: 100 }),
    ];
    const securement = createSecurementAssignment([
      createSecurementPlan('ORD-001'),
      createSecurementPlan('ORD-002'),
      createSecurementPlan('ORD-003'),
    ]);

    const result = generateUnloadingInstructions(freight, securement);

    expect(result.length).toBe(2);
    expect(result[0].stopNumber).toBe(1);
    expect(result[0].stopItems.length).toBe(2);
    expect(result[1].stopNumber).toBe(2);
    expect(result[1].stopItems.length).toBe(1);
  });

  it('orders stops in delivery sequence (ascending)', () => {
    const freight = [
      createPlacedFreight({ orderNumber: 'ORD-003', deliveryStop: 3, x: 300 }),
      createPlacedFreight({ orderNumber: 'ORD-001', deliveryStop: 1, x: 100 }),
      createPlacedFreight({ orderNumber: 'ORD-002', deliveryStop: 2, x: 200 }),
    ];
    const securement = createSecurementAssignment([
      createSecurementPlan('ORD-003'),
      createSecurementPlan('ORD-001'),
      createSecurementPlan('ORD-002'),
    ]);

    const result = generateUnloadingInstructions(freight, securement);

    expect(result[0].stopNumber).toBe(1);
    expect(result[1].stopNumber).toBe(2);
    expect(result[2].stopNumber).toBe(3);
  });

  it('generates removal order with higher layers first', () => {
    const freight = [
      createPlacedFreight({ orderNumber: 'ORD-BOTTOM', deliveryStop: 1, layer: 0, z: 0 }),
      createPlacedFreight({ orderNumber: 'ORD-TOP', deliveryStop: 1, layer: 1, z: 12 }),
    ];
    const securement = createSecurementAssignment([
      createSecurementPlan('ORD-BOTTOM'),
      createSecurementPlan('ORD-TOP'),
    ]);

    const result = generateUnloadingInstructions(freight, securement);

    expect(result[0].removalOrder[0]).toContain('ORD-TOP');
    expect(result[0].removalOrder[1]).toContain('ORD-BOTTOM');
  });

  it('includes securement removal steps before item removal', () => {
    const freight = [
      createPlacedFreight({ orderNumber: 'ORD-001', deliveryStop: 1 }),
    ];
    const securement = createSecurementAssignment([createSecurementPlan('ORD-001', 3)]);

    const result = generateUnloadingInstructions(freight, securement);

    expect(result[0].securementRemovalSteps.length).toBeGreaterThan(0);
    expect(result[0].securementRemovalSteps[0]).toContain('Remove');
    expect(result[0].securementRemovalSteps[0]).toContain('ORD-001');
    expect(result[0].securementRemovalSteps[0]).toContain('before lifting');
  });

  it('includes additional securement removal steps (edge protectors, etc.)', () => {
    const freight = [
      createPlacedFreight({ orderNumber: 'ORD-001', deliveryStop: 1 }),
    ];
    const securement = createSecurementAssignment([createSecurementPlan('ORD-001')]);

    const result = generateUnloadingInstructions(freight, securement);

    // The createSecurementPlan includes edge_protector as additional securement
    const hasAdditionalRemoval = result[0].securementRemovalSteps.some(
      step => step.includes('edge protector')
    );
    expect(hasAdditionalRemoval).toBe(true);
  });
});

describe('formatInstructions', () => {
  const trailer = createTrailer();

  function getTestLoadingSteps() {
    const freight = [
      createPlacedFreight({ orderNumber: 'ORD-001', x: 500, supportMethod: 'on_dunnage' }),
      createPlacedFreight({ orderNumber: 'ORD-002', x: 200 }),
    ];
    const securement = createSecurementAssignment([
      createSecurementPlan('ORD-001'),
      createSecurementPlan('ORD-002'),
    ]);
    return generateLoadingSequence(freight, trailer, securement);
  }

  function getTestUnloadingInstructions() {
    const freight = [
      createPlacedFreight({ orderNumber: 'ORD-001', deliveryStop: 1, x: 500 }),
      createPlacedFreight({ orderNumber: 'ORD-002', deliveryStop: 2, x: 200 }),
    ];
    const securement = createSecurementAssignment([
      createSecurementPlan('ORD-001'),
      createSecurementPlan('ORD-002'),
    ]);
    return generateUnloadingInstructions(freight, securement);
  }

  it('generates warehouse-view loading instructions with detailed formatting', () => {
    const loadingSteps = getTestLoadingSteps();
    const unloadingInstructions = getTestUnloadingInstructions();

    const result = formatInstructions(loadingSteps, unloadingInstructions, 'warehouse');

    expect(result.view).toBe('warehouse');
    expect(result.title).toContain('WAREHOUSE');
    expect(result.loadingSteps.length).toBe(2);
    // Warehouse view includes step headers, position, orientation, securement markers
    expect(result.loadingSteps[0]).toContain('Step 1');
    expect(result.loadingSteps[0]).toContain('POSITION');
    expect(result.loadingSteps[0]).toContain('ORIENTATION');
    expect(result.loadingSteps[0]).toContain('SECURE');
    expect(result.loadingSteps[0]).toContain('DUNNAGE');
  });

  it('generates driver-view loading instructions with concise formatting', () => {
    const loadingSteps = getTestLoadingSteps();
    const unloadingInstructions = getTestUnloadingInstructions();

    const result = formatInstructions(loadingSteps, unloadingInstructions, 'driver');

    expect(result.view).toBe('driver');
    expect(result.title).toContain('DRIVER');
    expect(result.loadingSteps.length).toBe(2);
    // Driver view uses numbered list format
    expect(result.loadingSteps[0]).toContain('1.');
    expect(result.loadingSteps[0]).toContain('Position:');
    expect(result.loadingSteps[0]).toContain('Secured:');
  });

  it('generates warehouse-view unloading instructions with stop headers', () => {
    const loadingSteps = getTestLoadingSteps();
    const unloadingInstructions = getTestUnloadingInstructions();

    const result = formatInstructions(loadingSteps, unloadingInstructions, 'warehouse');

    expect(result.unloadingStops.length).toBe(2);
    expect(result.unloadingStops[0]).toContain('STOP 1');
    expect(result.unloadingStops[0]).toContain('Securement removal');
    expect(result.unloadingStops[0]).toContain('Removal order');
  });

  it('generates driver-view unloading instructions with stop summaries', () => {
    const loadingSteps = getTestLoadingSteps();
    const unloadingInstructions = getTestUnloadingInstructions();

    const result = formatInstructions(loadingSteps, unloadingInstructions, 'driver');

    expect(result.unloadingStops.length).toBe(2);
    expect(result.unloadingStops[0]).toContain('Stop 1');
    expect(result.unloadingStops[0]).toContain('Deliver');
    expect(result.unloadingStops[0]).toContain('item(s)');
  });
});
