import { describe, it, expect } from 'vitest';
import {
  calculateMinTieDowns,
  calculateRequiredWLL,
  recommendPrimarySecurement,
  recommendAdditionalSecurement,
  isCoilProduct,
  generateCoilSecurementNotes,
  generateItemSecurementPlan,
  assignAnchorPoints,
  assignSecurement,
  CHAIN_WLL,
  STRAP_WLL,
} from './securement';
import type { SecurementPlan } from './securement';
import type {
  PlacedFreight,
  Position2D,
  SteelOrderLineItem,
  TrailerProfile,
  FreightGeometry,
} from './types';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeOrderItem(overrides: Partial<SteelOrderLineItem> = {}): SteelOrderLineItem {
  return {
    orderNumber: 'ORD-001',
    customerName: 'Steel Co',
    deliveryStop: 1,
    productType: 'plate',
    quantity: 1,
    pieceWeight: 10000,
    dimensions: { length: 240, width: 96, height: 2 },
    totalLineWeight: 10000,
    handlingMethod: 'crane',
    stackPermission: 'yes',
    maxStackHeight: 48,
    maxStackWeight: 40000,
    orientationRequirement: 'longitudinal',
    dunnageRequired: false,
    specialNotes: '',
    ...overrides,
  };
}

function makeGeometry(overrides: Partial<FreightGeometry> = {}): FreightGeometry {
  return {
    type: 'plate_stack',
    boundingBox: { length: 240, width: 96, height: 2 },
    contactFootprint: { area: 23040, shape: 'rectangle' },
    centerOfMass: { x: 120, y: 48, z: 1 },
    ...overrides,
  };
}

function makePlacedFreight(overrides: Partial<PlacedFreight> = {}): PlacedFreight {
  return {
    item: makeOrderItem(),
    geometry: makeGeometry(),
    position: { x: 100, y: 0, z: 0 },
    orientation: 'longitudinal',
    supportMethod: 'direct_to_deck',
    layer: 0,
    ...overrides,
  };
}

function makeTrailer(overrides: Partial<TrailerProfile> = {}): TrailerProfile {
  return {
    id: 'trailer-1',
    name: 'Standard 53ft Flatbed',
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
    anchorPoints: generateAnchorPoints(20),
    maxConcentratedLoadPSF: 500,
    ...overrides,
  };
}

/** Generate evenly-spaced anchor points along the trailer for testing */
function generateAnchorPoints(count: number): Position2D[] {
  const points: Position2D[] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      x: 50 + (i * 30), // spread along trailer length
      y: i % 2 === 0 ? -48 : 48, // alternating left/right sides
    });
  }
  return points;
}

// ─── calculateMinTieDowns Tests ──────────────────────────────────────────────

describe('calculateMinTieDowns', () => {
  it('returns minimum 2 tie-downs for short items', () => {
    // Item 5 feet long (60 inches) — less than 10 feet
    expect(calculateMinTieDowns(60, 5000)).toBe(2);
  });

  it('returns minimum 2 tie-downs for items exactly 10 feet', () => {
    // 10 feet = 120 inches → ceil(120/120) = 1, but min is 2
    expect(calculateMinTieDowns(120, 5000)).toBe(2);
  });

  it('returns 2 tie-downs for items under 10 feet', () => {
    expect(calculateMinTieDowns(100, 3000)).toBe(2);
  });

  it('returns 2 tie-downs for 20-foot item (240 inches)', () => {
    // ceil(240/120) = 2 → max(2, 2) = 2
    expect(calculateMinTieDowns(240, 10000)).toBe(2);
  });

  it('returns 3 tie-downs for 25-foot item (300 inches)', () => {
    // ceil(300/120) = 3 → max(2, 3) = 3
    expect(calculateMinTieDowns(300, 15000)).toBe(3);
  });

  it('returns 4 tie-downs for 40-foot item (480 inches)', () => {
    // ceil(480/120) = 4 → max(2, 4) = 4
    expect(calculateMinTieDowns(480, 20000)).toBe(4);
  });

  it('returns 5 tie-downs for 53-foot item (636 inches)', () => {
    // ceil(636/120) = 6 → max(2, 6) = 6
    expect(calculateMinTieDowns(636, 25000)).toBe(6);
  });

  it('returns minimum 2 for zero or negative length', () => {
    expect(calculateMinTieDowns(0, 5000)).toBe(2);
    expect(calculateMinTieDowns(-10, 5000)).toBe(2);
  });
});

// ─── calculateRequiredWLL Tests ──────────────────────────────────────────────

describe('calculateRequiredWLL', () => {
  it('returns 50% of cargo weight', () => {
    expect(calculateRequiredWLL(10000)).toBe(5000);
  });

  it('returns 50% for a light item', () => {
    expect(calculateRequiredWLL(2000)).toBe(1000);
  });

  it('returns 50% for a heavy item', () => {
    expect(calculateRequiredWLL(48000)).toBe(24000);
  });

  it('returns 0 for zero weight', () => {
    expect(calculateRequiredWLL(0)).toBe(0);
  });

  it('returns 0 for negative weight', () => {
    expect(calculateRequiredWLL(-500)).toBe(0);
  });
});

// ─── recommendPrimarySecurement Tests ────────────────────────────────────────

describe('recommendPrimarySecurement', () => {
  it('recommends chains for hot rolled coils', () => {
    expect(recommendPrimarySecurement('coil_hot_rolled', 20000)).toBe('chain');
  });

  it('recommends chains for cold rolled coils', () => {
    expect(recommendPrimarySecurement('coil_cold_rolled', 15000)).toBe('chain');
  });

  it('recommends chains for galvanized coils', () => {
    expect(recommendPrimarySecurement('coil_galvanized', 18000)).toBe('chain');
  });

  it('recommends chains for wire rod coils', () => {
    expect(recommendPrimarySecurement('wire_rod_coil', 12000)).toBe('chain');
  });

  it('recommends chains for plate', () => {
    expect(recommendPrimarySecurement('plate', 8000)).toBe('chain');
  });

  it('recommends chains for sheet bundles', () => {
    expect(recommendPrimarySecurement('sheet_bundle', 6000)).toBe('chain');
  });

  it('recommends straps for rebar bundles', () => {
    expect(recommendPrimarySecurement('rebar_bundle', 4000)).toBe('strap');
  });

  it('recommends straps for pipe', () => {
    expect(recommendPrimarySecurement('pipe', 3000)).toBe('strap');
  });

  it('recommends straps for tube', () => {
    expect(recommendPrimarySecurement('tube', 2500)).toBe('strap');
  });

  it('recommends straps for HSS', () => {
    expect(recommendPrimarySecurement('hollow_structural_section', 3500)).toBe('strap');
  });

  it('recommends chains for heavy beams (>5000 lbs)', () => {
    expect(recommendPrimarySecurement('beam_i', 8000)).toBe('chain');
    expect(recommendPrimarySecurement('beam_h', 6000)).toBe('chain');
    expect(recommendPrimarySecurement('beam_wide_flange', 7000)).toBe('chain');
  });

  it('recommends straps for lighter beams (≤5000 lbs)', () => {
    expect(recommendPrimarySecurement('beam_i', 4000)).toBe('strap');
    expect(recommendPrimarySecurement('beam_h', 3000)).toBe('strap');
    expect(recommendPrimarySecurement('channel', 2000)).toBe('strap');
    expect(recommendPrimarySecurement('angle', 1500)).toBe('strap');
  });

  it('recommends straps for palletized steel', () => {
    expect(recommendPrimarySecurement('palletized', 5000)).toBe('strap');
  });
});

// ─── recommendAdditionalSecurement Tests ─────────────────────────────────────

describe('recommendAdditionalSecurement', () => {
  it('recommends coil_rack, chock, blocking for coils', () => {
    const additional = recommendAdditionalSecurement('coil_hot_rolled', 'chain');
    expect(additional).toContain('coil_rack');
    expect(additional).toContain('chock');
    expect(additional).toContain('blocking');
  });

  it('recommends edge_protector for plate', () => {
    const additional = recommendAdditionalSecurement('plate', 'chain');
    expect(additional).toContain('edge_protector');
  });

  it('recommends edge_protector for pipe with straps', () => {
    const additional = recommendAdditionalSecurement('pipe', 'strap');
    expect(additional).toContain('edge_protector');
  });

  it('recommends edge_protector for beams with straps', () => {
    const additional = recommendAdditionalSecurement('beam_i', 'strap');
    expect(additional).toContain('edge_protector');
  });

  it('recommends nothing extra for beams with chains', () => {
    const additional = recommendAdditionalSecurement('beam_i', 'chain');
    expect(additional).toHaveLength(0);
  });

  it('recommends edge_protector for palletized', () => {
    const additional = recommendAdditionalSecurement('palletized', 'strap');
    expect(additional).toContain('edge_protector');
  });
});

// ─── isCoilProduct Tests ─────────────────────────────────────────────────────

describe('isCoilProduct', () => {
  it('returns true for all coil types', () => {
    expect(isCoilProduct('coil_hot_rolled')).toBe(true);
    expect(isCoilProduct('coil_cold_rolled')).toBe(true);
    expect(isCoilProduct('coil_galvanized')).toBe(true);
    expect(isCoilProduct('wire_rod_coil')).toBe(true);
  });

  it('returns false for non-coil types', () => {
    expect(isCoilProduct('plate')).toBe(false);
    expect(isCoilProduct('beam_i')).toBe(false);
    expect(isCoilProduct('pipe')).toBe(false);
    expect(isCoilProduct('palletized')).toBe(false);
  });
});

// ─── generateCoilSecurementNotes Tests ───────────────────────────────────────

describe('generateCoilSecurementNotes', () => {
  it('generates notes for coil products', () => {
    const notes = generateCoilSecurementNotes('coil_hot_rolled');
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.some((n) => n.toLowerCase().includes('chain'))).toBe(true);
    expect(notes.some((n) => n.toLowerCase().includes('blocking'))).toBe(true);
    expect(notes.some((n) => n.toLowerCase().includes('chock'))).toBe(true);
    expect(notes.some((n) => n.toLowerCase().includes('rack') || n.toLowerCase().includes('cradle'))).toBe(true);
  });

  it('returns empty array for non-coil products', () => {
    expect(generateCoilSecurementNotes('plate')).toHaveLength(0);
    expect(generateCoilSecurementNotes('beam_i')).toHaveLength(0);
  });
});

// ─── generateItemSecurementPlan Tests ────────────────────────────────────────

describe('generateItemSecurementPlan', () => {
  it('generates plan with at least 2 tie-downs for a short item', () => {
    const freight = makePlacedFreight({
      item: makeOrderItem({ totalLineWeight: 5000 }),
      geometry: makeGeometry({ boundingBox: { length: 100, width: 48, height: 10 } }),
    });
    const plan = generateItemSecurementPlan(freight);

    expect(plan.tieDowns.length).toBeGreaterThanOrEqual(2);
    expect(plan.itemOrderNumber).toBe('ORD-001');
  });

  it('generates enough tie-downs to meet WLL requirement', () => {
    // Heavy item: 48000 lbs → requires 24000 WLL
    // Chains at 4700 each → ceil(24000/4700) = 6 tie-downs needed for WLL
    const freight = makePlacedFreight({
      item: makeOrderItem({ totalLineWeight: 48000, productType: 'plate' }),
      geometry: makeGeometry({ boundingBox: { length: 240, width: 96, height: 6 } }),
    });
    const plan = generateItemSecurementPlan(freight);

    expect(plan.aggregateWLL).toBeGreaterThanOrEqual(plan.requiredWLL);
    expect(plan.meetsRequirements).toBe(true);
  });

  it('uses chains for coil products', () => {
    const freight = makePlacedFreight({
      item: makeOrderItem({ productType: 'coil_hot_rolled', totalLineWeight: 20000 }),
      geometry: makeGeometry({
        type: 'horizontal_coil',
        boundingBox: { length: 48, width: 60, height: 60 },
      }),
    });
    const plan = generateItemSecurementPlan(freight);

    expect(plan.tieDowns.every((td) => td.type === 'chain')).toBe(true);
    expect(plan.tieDowns.every((td) => td.wll === CHAIN_WLL)).toBe(true);
  });

  it('uses straps for pipe products', () => {
    const freight = makePlacedFreight({
      item: makeOrderItem({ productType: 'pipe', totalLineWeight: 4000 }),
      geometry: makeGeometry({
        type: 'cylindrical_bundle',
        boundingBox: { length: 240, width: 24, height: 24 },
      }),
    });
    const plan = generateItemSecurementPlan(freight);

    expect(plan.tieDowns.every((td) => td.type === 'strap')).toBe(true);
    expect(plan.tieDowns.every((td) => td.wll === STRAP_WLL)).toBe(true);
  });

  it('includes coil-specific notes for coil items', () => {
    const freight = makePlacedFreight({
      item: makeOrderItem({ productType: 'coil_galvanized', totalLineWeight: 15000 }),
      geometry: makeGeometry({
        type: 'horizontal_coil',
        boundingBox: { length: 36, width: 48, height: 48 },
      }),
    });
    const plan = generateItemSecurementPlan(freight);

    expect(plan.notes.length).toBeGreaterThan(0);
    expect(plan.additionalSecurement).toContain('coil_rack');
    expect(plan.additionalSecurement).toContain('chock');
    expect(plan.additionalSecurement).toContain('blocking');
  });

  it('includes edge protector note for items with sharp edges', () => {
    const freight = makePlacedFreight({
      item: makeOrderItem({ productType: 'rebar_bundle', totalLineWeight: 4000 }),
      geometry: makeGeometry({
        type: 'cylindrical_bundle',
        boundingBox: { length: 240, width: 18, height: 18 },
      }),
    });
    const plan = generateItemSecurementPlan(freight);

    expect(plan.additionalSecurement).toContain('edge_protector');
    expect(plan.notes.some((n) => n.includes('Edge protector'))).toBe(true);
  });

  it('calculates correct requiredWLL as 50% of item weight', () => {
    const freight = makePlacedFreight({
      item: makeOrderItem({ totalLineWeight: 20000 }),
    });
    const plan = generateItemSecurementPlan(freight);

    expect(plan.requiredWLL).toBe(10000);
  });
});

// ─── assignAnchorPoints Tests ────────────────────────────────────────────────

describe('assignAnchorPoints', () => {
  it('assigns anchor points to tie-downs when enough are available', () => {
    const trailer = makeTrailer({ anchorPoints: generateAnchorPoints(10) });
    const freight = makePlacedFreight({
      item: makeOrderItem({ totalLineWeight: 5000 }),
    });
    const plan = generateItemSecurementPlan(freight);

    const result = assignAnchorPoints([plan], trailer);

    expect(result.hasOverflow).toBe(false);
    expect(result.anchorPointsUsed).toBe(plan.tieDowns.length);
    expect(result.anchorPointsAvailable).toBe(10);
    // Every tie-down should have an anchor point assigned
    result.plans[0].tieDowns.forEach((td) => {
      expect(td.anchorPointId).toBeDefined();
    });
  });

  it('detects overflow when more tie-downs needed than anchor points', () => {
    // Only 2 anchor points but need more tie-downs
    const trailer = makeTrailer({ anchorPoints: generateAnchorPoints(2) });
    // Heavy item needs many tie-downs
    const freight = makePlacedFreight({
      item: makeOrderItem({ totalLineWeight: 48000, productType: 'plate' }),
      geometry: makeGeometry({ boundingBox: { length: 480, width: 96, height: 6 } }),
    });
    const plan = generateItemSecurementPlan(freight);

    // Ensure we need more than 2 tie-downs
    expect(plan.tieDowns.length).toBeGreaterThan(2);

    const result = assignAnchorPoints([plan], trailer);

    expect(result.hasOverflow).toBe(true);
    expect(result.anchorPointsUsed).toBe(2); // only 2 were available
  });

  it('returns no overflow with empty trailer having no anchor points and no freight', () => {
    const trailer = makeTrailer({ anchorPoints: [] });
    const result = assignAnchorPoints([], trailer);

    expect(result.hasOverflow).toBe(false);
    expect(result.anchorPointsUsed).toBe(0);
    expect(result.anchorPointsAvailable).toBe(0);
  });
});

// ─── assignSecurement Tests ──────────────────────────────────────────────────

describe('assignSecurement', () => {
  it('generates a complete securement assignment for multiple items', () => {
    const trailer = makeTrailer({ anchorPoints: generateAnchorPoints(20) });
    const freight1 = makePlacedFreight({
      item: makeOrderItem({ orderNumber: 'ORD-001', totalLineWeight: 10000 }),
      position: { x: 50, y: 0, z: 0 },
    });
    const freight2 = makePlacedFreight({
      item: makeOrderItem({
        orderNumber: 'ORD-002',
        productType: 'pipe',
        totalLineWeight: 4000,
      }),
      geometry: makeGeometry({
        type: 'cylindrical_bundle',
        boundingBox: { length: 300, width: 18, height: 18 },
      }),
      position: { x: 300, y: 0, z: 0 },
    });

    const result = assignSecurement([freight1, freight2], trailer);

    expect(result.plans).toHaveLength(2);
    expect(result.plans[0].itemOrderNumber).toBe('ORD-001');
    expect(result.plans[1].itemOrderNumber).toBe('ORD-002');
    expect(result.hasOverflow).toBe(false);
    // All plans should meet requirements
    result.plans.forEach((plan) => {
      expect(plan.meetsRequirements).toBe(true);
    });
  });

  it('each plan meets the aggregate WLL requirement', () => {
    const trailer = makeTrailer({ anchorPoints: generateAnchorPoints(30) });
    const items = [
      makePlacedFreight({
        item: makeOrderItem({
          orderNumber: 'ORD-A',
          productType: 'coil_hot_rolled',
          totalLineWeight: 25000,
        }),
        geometry: makeGeometry({
          type: 'horizontal_coil',
          boundingBox: { length: 48, width: 60, height: 60 },
        }),
        position: { x: 100, y: 0, z: 0 },
      }),
      makePlacedFreight({
        item: makeOrderItem({
          orderNumber: 'ORD-B',
          productType: 'beam_i',
          totalLineWeight: 8000,
        }),
        geometry: makeGeometry({
          type: 'long_rectangular_bundle',
          boundingBox: { length: 480, width: 12, height: 24 },
        }),
        position: { x: 200, y: 0, z: 0 },
      }),
    ];

    const result = assignSecurement(items, trailer);

    result.plans.forEach((plan) => {
      expect(plan.aggregateWLL).toBeGreaterThanOrEqual(plan.requiredWLL);
      expect(plan.meetsRequirements).toBe(true);
    });
  });
});
