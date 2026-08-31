// ─── OptiFlow Flatbed Steel Load Planner — Stacking Rules Tests ──────────────
import { describe, it, expect } from 'vitest';
import {
  enforceNoStackRule,
  canPlaceAbove,
  enforceMaxStackWeight,
  enforceMaxStackHeight,
  isStackingWithinLimits,
  enforceCoilAntiRoll,
  requiresAntiRollSecurement,
  requiresDunnageBetween,
  enforceDissimilarHardnessDunnage,
  isLongProduct,
  calculateLongProductSupport,
  enforceLongProductSupport,
  requiresEdgeProtection,
  calculateEdgeProtection,
  enforcePlateEdgeProtection,
  evaluateStackingRules,
} from './stacking-rules';
import type { PlacedFreight, SteelOrderLineItem, FreightGeometry } from './types';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeItem(overrides?: Partial<SteelOrderLineItem>): SteelOrderLineItem {
  return {
    orderNumber: 'ORD-001',
    customerName: 'Test Steel',
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

function makeGeometry(overrides?: Partial<FreightGeometry>): FreightGeometry {
  return {
    type: 'plate_stack',
    boundingBox: { length: 120, width: 48, height: 6 },
    contactFootprint: { area: 5760, shape: 'rectangle' },
    centerOfMass: { x: 60, y: 24, z: 3 },
    ...overrides,
  };
}

function makePlacedFreight(overrides?: Partial<PlacedFreight>): PlacedFreight {
  return {
    item: makeItem(),
    geometry: makeGeometry(),
    position: { x: 0, y: 0, z: 0 },
    orientation: 'longitudinal',
    supportMethod: 'direct_to_deck',
    layer: 0,
    ...overrides,
  };
}

// ─── 1. No-Stack Enforcement Tests ──────────────────────────────────────────

describe('enforceNoStackRule', () => {
  it('returns no violations when no "no stack" items exist', () => {
    const freight = [
      makePlacedFreight({ item: makeItem({ orderNumber: 'A', stackPermission: 'yes' }) }),
      makePlacedFreight({
        item: makeItem({ orderNumber: 'B', stackPermission: 'yes' }),
        position: { x: 0, y: 0, z: 6 },
        layer: 1,
      }),
    ];
    expect(enforceNoStackRule(freight)).toHaveLength(0);
  });

  it('returns violation when "no stack" item has items above', () => {
    const freight = [
      makePlacedFreight({ item: makeItem({ orderNumber: 'NO-STACK', stackPermission: 'no' }) }),
      makePlacedFreight({
        item: makeItem({ orderNumber: 'ABOVE' }),
        position: { x: 0, y: 0, z: 6 },
        layer: 1,
      }),
    ];
    const violations = enforceNoStackRule(freight);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('stacking_no_stack_violated');
    expect(violations[0].affectedItems).toContain('NO-STACK');
    expect(violations[0].affectedItems).toContain('ABOVE');
  });

  it('returns no violation when "no stack" item has no items above (non-overlapping)', () => {
    const freight = [
      makePlacedFreight({ item: makeItem({ orderNumber: 'NO-STACK', stackPermission: 'no' }) }),
      makePlacedFreight({
        item: makeItem({ orderNumber: 'BESIDE' }),
        position: { x: 200, y: 0, z: 0 }, // far away, no XY overlap
        layer: 0,
      }),
    ];
    expect(enforceNoStackRule(freight)).toHaveLength(0);
  });
});

describe('canPlaceAbove', () => {
  it('returns false for "no stack" items', () => {
    const placed = makePlacedFreight({ item: makeItem({ stackPermission: 'no' }) });
    expect(canPlaceAbove(placed)).toBe(false);
  });

  it('returns true for "yes" stack items', () => {
    const placed = makePlacedFreight({ item: makeItem({ stackPermission: 'yes' }) });
    expect(canPlaceAbove(placed)).toBe(true);
  });

  it('returns true for "conditional" stack items', () => {
    const placed = makePlacedFreight({ item: makeItem({ stackPermission: 'conditional' }) });
    expect(canPlaceAbove(placed)).toBe(true);
  });
});

// ─── 2. Max Stack Weight & Height Tests ─────────────────────────────────────

describe('enforceMaxStackWeight', () => {
  it('returns no violations when weight is within limits', () => {
    const freight = [
      makePlacedFreight({ item: makeItem({ orderNumber: 'BOTTOM', maxStackWeight: 20000 }) }),
      makePlacedFreight({
        item: makeItem({ orderNumber: 'TOP', pieceWeight: 5000 }),
        position: { x: 0, y: 0, z: 6 },
        layer: 1,
      }),
    ];
    expect(enforceMaxStackWeight(freight)).toHaveLength(0);
  });

  it('returns violation when weight exceeds limit', () => {
    const freight = [
      makePlacedFreight({ item: makeItem({ orderNumber: 'BOTTOM', maxStackWeight: 3000 }) }),
      makePlacedFreight({
        item: makeItem({ orderNumber: 'TOP', pieceWeight: 5000 }),
        position: { x: 0, y: 0, z: 6 },
        layer: 1,
      }),
    ];
    const violations = enforceMaxStackWeight(freight);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('stacking_max_weight_exceeded');
    expect(violations[0].affectedItems).toContain('BOTTOM');
  });
});

describe('enforceMaxStackHeight', () => {
  it('returns no violations when height is within limits', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'A', maxStackHeight: 48 }),
        geometry: makeGeometry({ boundingBox: { length: 120, width: 48, height: 6 } }),
      }),
    ];
    expect(enforceMaxStackHeight(freight)).toHaveLength(0);
  });

  it('returns violation when stack exceeds legal max height', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'HIGH', maxStackHeight: 200 }),
        geometry: makeGeometry({ boundingBox: { length: 120, width: 48, height: 6 } }),
        position: { x: 0, y: 0, z: 100 }, // starts at 100, top at 106
        layer: 3,
      }),
    ];
    const violations = enforceMaxStackHeight(freight, 102);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('stacking_max_height_exceeded');
  });

  it('returns violation when stack exceeds item maxStackHeight for bottom item', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'BOTTOM', maxStackHeight: 24 }),
        geometry: makeGeometry({ boundingBox: { length: 120, width: 48, height: 6 } }),
        layer: 0,
      }),
      makePlacedFreight({
        item: makeItem({ orderNumber: 'TOP', maxStackHeight: 100 }),
        geometry: makeGeometry({ boundingBox: { length: 120, width: 48, height: 20 } }),
        position: { x: 0, y: 0, z: 6 },
        layer: 1,
      }),
    ];
    const violations = enforceMaxStackHeight(freight);
    expect(violations.some(v => v.ruleId === 'stacking_item_height_limit_exceeded')).toBe(true);
  });
});

describe('isStackingWithinLimits', () => {
  it('returns true when within both limits', () => {
    expect(isStackingWithinLimits(5000, 0, 20000, 12, 48, 102)).toBe(true);
  });

  it('returns false when weight exceeds limit', () => {
    expect(isStackingWithinLimits(5000, 16000, 20000, 12, 48, 102)).toBe(false);
  });

  it('returns false when height exceeds item limit', () => {
    expect(isStackingWithinLimits(5000, 0, 20000, 50, 48, 102)).toBe(false);
  });

  it('returns false when height exceeds legal limit', () => {
    expect(isStackingWithinLimits(5000, 0, 20000, 110, 200, 102)).toBe(false);
  });
});

// ─── 3. Coil Anti-Roll Tests ─────────────────────────────────────────────────

describe('enforceCoilAntiRoll', () => {
  it('returns no violations when coil has cradle angle and chocks', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'COIL', productType: 'coil_hot_rolled' }),
        geometry: makeGeometry({
          type: 'horizontal_coil',
          cradleAngle: 37,
          chockDimensions: { width: 20, height: 15 },
        }),
      }),
    ];
    expect(enforceCoilAntiRoll(freight)).toHaveLength(0);
  });

  it('returns violation when coil lacks anti-roll securement', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'UNSAFE-COIL', productType: 'coil_hot_rolled' }),
        geometry: makeGeometry({
          type: 'horizontal_coil',
          cradleAngle: undefined,
          chockDimensions: undefined,
        }),
      }),
    ];
    const violations = enforceCoilAntiRoll(freight);
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('stacking_coil_anti_roll_missing');
    expect(violations[0].affectedItems).toContain('UNSAFE-COIL');
  });

  it('passes when coil has only cradle angle (no chocks)', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'COIL', productType: 'coil_galvanized' }),
        geometry: makeGeometry({
          type: 'horizontal_coil',
          cradleAngle: 30,
          chockDimensions: undefined,
        }),
      }),
    ];
    expect(enforceCoilAntiRoll(freight)).toHaveLength(0);
  });

  it('ignores non-coil items', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'PLATE', productType: 'plate' }),
        geometry: makeGeometry({ type: 'plate_stack' }),
      }),
    ];
    expect(enforceCoilAntiRoll(freight)).toHaveLength(0);
  });
});

describe('requiresAntiRollSecurement', () => {
  it('returns true for horizontal coil types', () => {
    expect(requiresAntiRollSecurement('coil_hot_rolled')).toBe(true);
    expect(requiresAntiRollSecurement('coil_cold_rolled')).toBe(true);
    expect(requiresAntiRollSecurement('coil_galvanized')).toBe(true);
    expect(requiresAntiRollSecurement('wire_rod_coil')).toBe(true);
  });

  it('returns false for non-coil types', () => {
    expect(requiresAntiRollSecurement('plate')).toBe(false);
    expect(requiresAntiRollSecurement('beam_i')).toBe(false);
    expect(requiresAntiRollSecurement('pipe')).toBe(false);
  });
});

// ─── 4. Dissimilar Hardness Dunnage Tests ────────────────────────────────────

describe('requiresDunnageBetween', () => {
  it('returns false for same hardness category', () => {
    // Both hard
    expect(requiresDunnageBetween('plate', 'beam_i')).toBe(false);
    // Both coated
    expect(requiresDunnageBetween('coil_galvanized', 'roofing_sheet_bundle')).toBe(false);
  });

  it('returns true for different hardness categories', () => {
    // Hard on coated
    expect(requiresDunnageBetween('plate', 'coil_galvanized')).toBe(true);
    // Hard on soft
    expect(requiresDunnageBetween('beam_i', 'palletized')).toBe(true);
    // Medium on hard
    expect(requiresDunnageBetween('coil_cold_rolled', 'plate')).toBe(true);
    // Coated on hard
    expect(requiresDunnageBetween('coil_galvanized', 'beam_i')).toBe(true);
  });
});

describe('enforceDissimilarHardnessDunnage', () => {
  it('returns no violations when same hardness stacked', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'A', productType: 'plate' }),
        layer: 0,
      }),
      makePlacedFreight({
        item: makeItem({ orderNumber: 'B', productType: 'beam_i' }),
        position: { x: 0, y: 0, z: 6 },
        layer: 1,
        supportMethod: 'on_prior_layer',
      }),
    ];
    const result = enforceDissimilarHardnessDunnage(freight);
    expect(result.violations).toHaveLength(0);
  });

  it('returns violation when dissimilar hardness stacked without dunnage', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'HARD', productType: 'plate' }),
        layer: 0,
      }),
      makePlacedFreight({
        item: makeItem({ orderNumber: 'COATED', productType: 'coil_galvanized' }),
        geometry: makeGeometry({ type: 'horizontal_coil' }),
        position: { x: 0, y: 0, z: 6 },
        layer: 1,
        supportMethod: 'on_prior_layer',
      }),
    ];
    const result = enforceDissimilarHardnessDunnage(freight);
    expect(result.violations).toHaveLength(1);
    expect(result.dunnageRequired).toHaveLength(1);
    expect(result.dunnageRequired[0].dunnageMaterial).toBe('wood');
  });

  it('returns no violation when dunnage already present', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'HARD', productType: 'plate' }),
        layer: 0,
      }),
      makePlacedFreight({
        item: makeItem({ orderNumber: 'COATED', productType: 'coil_galvanized' }),
        geometry: makeGeometry({ type: 'horizontal_coil' }),
        position: { x: 0, y: 0, z: 6 },
        layer: 1,
        supportMethod: 'on_dunnage', // dunnage present
      }),
    ];
    const result = enforceDissimilarHardnessDunnage(freight);
    expect(result.violations).toHaveLength(0);
  });

  it('uses rubber dunnage when coated material is below', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'COATED', productType: 'coil_galvanized' }),
        geometry: makeGeometry({ type: 'horizontal_coil' }),
        layer: 0,
      }),
      makePlacedFreight({
        item: makeItem({ orderNumber: 'HARD', productType: 'plate' }),
        position: { x: 0, y: 0, z: 6 },
        layer: 1,
        supportMethod: 'on_prior_layer',
      }),
    ];
    const result = enforceDissimilarHardnessDunnage(freight);
    expect(result.dunnageRequired).toHaveLength(1);
    expect(result.dunnageRequired[0].dunnageMaterial).toBe('rubber');
  });
});

// ─── 5. Long Product Support Tests ──────────────────────────────────────────

describe('isLongProduct', () => {
  it('returns true for beams, bars, pipes, tubes', () => {
    expect(isLongProduct('beam_i')).toBe(true);
    expect(isLongProduct('beam_h')).toBe(true);
    expect(isLongProduct('beam_wide_flange')).toBe(true);
    expect(isLongProduct('channel')).toBe(true);
    expect(isLongProduct('angle')).toBe(true);
    expect(isLongProduct('flat_bar')).toBe(true);
    expect(isLongProduct('round_bar')).toBe(true);
    expect(isLongProduct('pipe')).toBe(true);
    expect(isLongProduct('tube')).toBe(true);
    expect(isLongProduct('hollow_structural_section')).toBe(true);
    expect(isLongProduct('rebar_bundle')).toBe(true);
  });

  it('returns false for non-long products', () => {
    expect(isLongProduct('plate')).toBe(false);
    expect(isLongProduct('coil_hot_rolled')).toBe(false);
    expect(isLongProduct('palletized')).toBe(false);
  });
});

describe('calculateLongProductSupport', () => {
  it('provides at least 2 support points for short items', () => {
    const item = makePlacedFreight({
      item: makeItem({ orderNumber: 'SHORT-BEAM', productType: 'beam_i' }),
      geometry: makeGeometry({ boundingBox: { length: 96, width: 12, height: 12 } }),
    });
    const support = calculateLongProductSupport(item, 120);
    expect(support.supportPoints.length).toBeGreaterThanOrEqual(2);
    expect(support.meetsRequirement).toBe(true);
  });

  it('adds support points for items exceeding max span', () => {
    const item = makePlacedFreight({
      item: makeItem({ orderNumber: 'LONG-BEAM', productType: 'beam_i' }),
      geometry: makeGeometry({ boundingBox: { length: 360, width: 12, height: 12 } }),
    });
    const support = calculateLongProductSupport(item, 120);
    // 360 / 120 = 3 spans, so need 4 points
    expect(support.supportPoints.length).toBeGreaterThanOrEqual(4);
    expect(support.actualMaxSpan).toBeLessThanOrEqual(120);
    expect(support.meetsRequirement).toBe(true);
  });

  it('correctly identifies first and last support positions', () => {
    const item = makePlacedFreight({
      item: makeItem({ orderNumber: 'PIPE', productType: 'pipe' }),
      geometry: makeGeometry({ boundingBox: { length: 240, width: 8, height: 8 } }),
    });
    const support = calculateLongProductSupport(item, 120);
    expect(support.supportPoints[0].position).toBe(0);
    expect(support.supportPoints[support.supportPoints.length - 1].position).toBe(240);
  });
});

describe('enforceLongProductSupport', () => {
  it('returns no violations for properly supported long products', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'BEAM', productType: 'beam_i' }),
        geometry: makeGeometry({ boundingBox: { length: 200, width: 12, height: 12 } }),
      }),
    ];
    const result = enforceLongProductSupport(freight, 120);
    expect(result.violations).toHaveLength(0);
    expect(result.supportConfigs).toHaveLength(1);
    expect(result.supportConfigs[0].meetsRequirement).toBe(true);
  });

  it('ignores non-long-product items', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'PLATE', productType: 'plate' }),
      }),
    ];
    const result = enforceLongProductSupport(freight);
    expect(result.violations).toHaveLength(0);
    expect(result.supportConfigs).toHaveLength(0);
  });
});

// ─── 6. Plate/Sheet Edge Protection Tests ────────────────────────────────────

describe('requiresEdgeProtection', () => {
  it('returns true for plate and sheet types', () => {
    expect(requiresEdgeProtection('plate')).toBe(true);
    expect(requiresEdgeProtection('sheet_bundle')).toBe(true);
    expect(requiresEdgeProtection('roofing_sheet_bundle')).toBe(true);
  });

  it('returns false for non-plate/sheet types', () => {
    expect(requiresEdgeProtection('beam_i')).toBe(false);
    expect(requiresEdgeProtection('coil_hot_rolled')).toBe(false);
    expect(requiresEdgeProtection('pipe')).toBe(false);
  });
});

describe('calculateEdgeProtection', () => {
  it('requires edge protection and banding for plate items', () => {
    const item = makePlacedFreight({
      item: makeItem({ orderNumber: 'PLATE', productType: 'plate' }),
      geometry: makeGeometry({ boundingBox: { length: 120, width: 48, height: 6 } }),
    });
    const protection = calculateEdgeProtection(item);
    expect(protection.requiresEdgeProtection).toBe(true);
    expect(protection.requiresBanding).toBe(true);
    expect(protection.bandCount).toBeGreaterThanOrEqual(2);
    expect(protection.edgeProtectorPositions.length).toBe(protection.bandCount);
  });

  it('calculates more bands for longer plates', () => {
    const shortItem = makePlacedFreight({
      item: makeItem({ orderNumber: 'SHORT', productType: 'plate' }),
      geometry: makeGeometry({ boundingBox: { length: 60, width: 48, height: 6 } }),
    });
    const longItem = makePlacedFreight({
      item: makeItem({ orderNumber: 'LONG', productType: 'plate' }),
      geometry: makeGeometry({ boundingBox: { length: 360, width: 48, height: 6 } }),
    });
    const shortProtection = calculateEdgeProtection(shortItem);
    const longProtection = calculateEdgeProtection(longItem);
    expect(longProtection.bandCount).toBeGreaterThan(shortProtection.bandCount);
  });

  it('returns no requirements for non-plate items', () => {
    const item = makePlacedFreight({
      item: makeItem({ orderNumber: 'BEAM', productType: 'beam_i' }),
      geometry: makeGeometry({ type: 'long_rectangular_bundle' }),
    });
    const protection = calculateEdgeProtection(item);
    expect(protection.requiresEdgeProtection).toBe(false);
    expect(protection.requiresBanding).toBe(false);
    expect(protection.bandCount).toBe(0);
  });
});

describe('enforcePlateEdgeProtection', () => {
  it('returns edge protection configs for plate items', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'PLATE', productType: 'plate' }),
      }),
    ];
    const result = enforcePlateEdgeProtection(freight);
    expect(result.edgeProtections).toHaveLength(1);
    expect(result.edgeProtections[0].requiresEdgeProtection).toBe(true);
  });
});

// ─── Combined evaluateStackingRules Tests ────────────────────────────────────

describe('evaluateStackingRules', () => {
  it('passes for a simple valid placement', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'A', productType: 'plate', stackPermission: 'yes' }),
      }),
    ];
    const result = evaluateStackingRules(freight);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.edgeProtections.length).toBeGreaterThan(0); // plate needs edge protection (informational)
  });

  it('detects multiple violation types simultaneously', () => {
    const freight = [
      // No-stack item with something above
      makePlacedFreight({
        item: makeItem({ orderNumber: 'NO-STACK', stackPermission: 'no' }),
      }),
      makePlacedFreight({
        item: makeItem({ orderNumber: 'ABOVE', pieceWeight: 5000 }),
        position: { x: 0, y: 0, z: 6 },
        layer: 1,
        supportMethod: 'on_prior_layer',
      }),
      // Unsecured coil
      makePlacedFreight({
        item: makeItem({ orderNumber: 'COIL', productType: 'coil_hot_rolled' }),
        geometry: makeGeometry({
          type: 'horizontal_coil',
          cradleAngle: undefined,
          chockDimensions: undefined,
        }),
        position: { x: 200, y: 0, z: 0 },
      }),
    ];
    const result = evaluateStackingRules(freight);
    expect(result.passed).toBe(false);
    expect(result.violations.length).toBeGreaterThan(1);
    // Should have no-stack violation and coil anti-roll violation
    const ruleIds = result.violations.map(v => v.ruleId);
    expect(ruleIds).toContain('stacking_no_stack_violated');
    expect(ruleIds).toContain('stacking_coil_anti_roll_missing');
  });

  it('includes long product support configs', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'BEAM', productType: 'beam_i' }),
        geometry: makeGeometry({
          type: 'long_rectangular_bundle',
          boundingBox: { length: 240, width: 12, height: 12 },
        }),
      }),
    ];
    const result = evaluateStackingRules(freight);
    expect(result.longProductSupports).toHaveLength(1);
    expect(result.longProductSupports[0].supportPoints.length).toBeGreaterThanOrEqual(2);
  });

  it('includes dunnage insertions when dissimilar hardness detected', () => {
    const freight = [
      makePlacedFreight({
        item: makeItem({ orderNumber: 'HARD', productType: 'plate' }),
        layer: 0,
      }),
      makePlacedFreight({
        item: makeItem({ orderNumber: 'SOFT', productType: 'palletized' }),
        position: { x: 0, y: 0, z: 6 },
        layer: 1,
        supportMethod: 'on_prior_layer',
      }),
    ];
    const result = evaluateStackingRules(freight);
    expect(result.dunnageInsertions.length).toBeGreaterThan(0);
  });
});
