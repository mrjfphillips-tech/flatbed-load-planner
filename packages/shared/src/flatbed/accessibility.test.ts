// ─── OptiFlow Flatbed Steel Load Planner — Accessibility Tests ───────────────
import { describe, it, expect } from 'vitest';
import {
  validateDeliveryStopAssignments,
  validateCraneAccess,
  validateSideAccess,
  validateRearAccess,
  validateStopOrderAccessibility,
  handlingToUnloadingMethod,
} from './accessibility';
import type { PlacedFreight, TrailerProfile, FreightGeometry } from './types';

// ─── Test Helpers ────────────────────────────────────────────────────────────

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
    axlePositions: [480, 528],
    axleWeightRatings: [34000, 34000],
    kingpinPosition: 36,
    rearOverhangLimit: 48,
    deckMaterial: 'steel',
    stakePockets: [],
    anchorPoints: [],
    maxConcentratedLoadPSF: 800,
    ...overrides,
  };
}

function makeGeometry(overrides?: Partial<FreightGeometry>): FreightGeometry {
  return {
    type: 'rectangular',
    boundingBox: { length: 120, width: 48, height: 12 },
    contactFootprint: { area: 5760, shape: 'rectangle' },
    centerOfMass: { x: 60, y: 24, z: 6 },
    ...overrides,
  };
}

function makePlacedFreight(overrides: {
  orderNumber?: string;
  deliveryStop?: number;
  handlingMethod?: 'crane' | 'forklift' | 'magnet' | 'manual';
  x?: number;
  y?: number;
  z?: number;
  length?: number;
  width?: number;
  height?: number;
  layer?: number;
}): PlacedFreight {
  const length = overrides.length ?? 120;
  const width = overrides.width ?? 48;
  const height = overrides.height ?? 12;

  return {
    item: {
      orderNumber: overrides.orderNumber ?? 'ORD-001',
      customerName: 'Test Customer',
      deliveryStop: overrides.deliveryStop ?? 1,
      productType: 'plate',
      quantity: 1,
      pieceWeight: 5000,
      dimensions: { length, width, height },
      totalLineWeight: 5000,
      handlingMethod: overrides.handlingMethod ?? 'crane',
      stackPermission: 'yes',
      maxStackHeight: 48,
      maxStackWeight: 20000,
      orientationRequirement: 'any',
      dunnageRequired: false,
      specialNotes: '',
    },
    geometry: makeGeometry({
      boundingBox: { length, width, height },
      centerOfMass: { x: length / 2, y: width / 2, z: height / 2 },
    }),
    position: {
      x: overrides.x ?? 0,
      y: overrides.y ?? -24,
      z: overrides.z ?? 0,
    },
    orientation: 'longitudinal',
    supportMethod: overrides.z && overrides.z > 0 ? 'on_prior_layer' : 'direct_to_deck',
    layer: overrides.layer ?? 0,
  };
}

// ─── handlingToUnloadingMethod Tests ─────────────────────────────────────────

describe('handlingToUnloadingMethod', () => {
  it('maps crane to crane', () => {
    expect(handlingToUnloadingMethod('crane')).toBe('crane');
  });

  it('maps forklift to forklift_side', () => {
    expect(handlingToUnloadingMethod('forklift')).toBe('forklift_side');
  });

  it('maps magnet to magnet', () => {
    expect(handlingToUnloadingMethod('magnet')).toBe('magnet');
  });

  it('maps manual to manual', () => {
    expect(handlingToUnloadingMethod('manual')).toBe('manual');
  });
});

// ─── validateDeliveryStopAssignments Tests ───────────────────────────────────

describe('validateDeliveryStopAssignments', () => {
  it('returns no errors for valid assignments', () => {
    const freight = [
      makePlacedFreight({ orderNumber: 'A', deliveryStop: 1 }),
      makePlacedFreight({ orderNumber: 'B', deliveryStop: 2 }),
      makePlacedFreight({ orderNumber: 'C', deliveryStop: 3 }),
    ];
    expect(validateDeliveryStopAssignments(freight)).toHaveLength(0);
  });

  it('reports error for zero delivery stop', () => {
    const freight = [
      makePlacedFreight({ orderNumber: 'A', deliveryStop: 0 }),
    ];
    const errors = validateDeliveryStopAssignments(freight);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('A');
    expect(errors[0]).toContain('invalid');
  });

  it('reports error for negative delivery stop', () => {
    const freight = [
      makePlacedFreight({ orderNumber: 'B', deliveryStop: -1 }),
    ];
    const errors = validateDeliveryStopAssignments(freight);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('B');
  });

  it('returns empty for an empty array', () => {
    expect(validateDeliveryStopAssignments([])).toHaveLength(0);
  });
});

// ─── validateCraneAccess Tests ───────────────────────────────────────────────

describe('validateCraneAccess', () => {
  it('returns no conflicts when no items overlap vertically', () => {
    const freight = [
      makePlacedFreight({ orderNumber: 'A', deliveryStop: 1, x: 0, y: -24, z: 0 }),
      makePlacedFreight({ orderNumber: 'B', deliveryStop: 2, x: 200, y: -24, z: 0 }),
    ];
    expect(validateCraneAccess(freight)).toHaveLength(0);
  });

  it('detects vertical blocking by later-stop item above earlier-stop item', () => {
    const freight = [
      makePlacedFreight({ orderNumber: 'STOP1', deliveryStop: 1, x: 0, y: -24, z: 0, handlingMethod: 'crane' }),
      makePlacedFreight({ orderNumber: 'STOP2', deliveryStop: 2, x: 0, y: -24, z: 12, layer: 1, handlingMethod: 'crane' }),
    ];
    const conflicts = validateCraneAccess(freight);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].blockedItem).toBe('STOP1');
    expect(conflicts[0].blockingItem).toBe('STOP2');
    expect(conflicts[0].violationType).toBe('vertical');
  });

  it('allows same-stop items stacked above each other', () => {
    const freight = [
      makePlacedFreight({ orderNumber: 'A', deliveryStop: 1, x: 0, y: -24, z: 0, handlingMethod: 'crane' }),
      makePlacedFreight({ orderNumber: 'B', deliveryStop: 1, x: 0, y: -24, z: 12, layer: 1, handlingMethod: 'crane' }),
    ];
    expect(validateCraneAccess(freight)).toHaveLength(0);
  });

  it('allows earlier-stop item stacked above later-stop item', () => {
    // Stop 1 item above stop 2 item is fine — stop 1 is removed first (from top)
    const freight = [
      makePlacedFreight({ orderNumber: 'STOP2', deliveryStop: 2, x: 0, y: -24, z: 0, handlingMethod: 'crane' }),
      makePlacedFreight({ orderNumber: 'STOP1', deliveryStop: 1, x: 0, y: -24, z: 12, layer: 1, handlingMethod: 'crane' }),
    ];
    expect(validateCraneAccess(freight)).toHaveLength(0);
  });

  it('does not check items with forklift handling', () => {
    const freight = [
      makePlacedFreight({ orderNumber: 'A', deliveryStop: 1, x: 0, y: -24, z: 0, handlingMethod: 'forklift' }),
      makePlacedFreight({ orderNumber: 'B', deliveryStop: 2, x: 0, y: -24, z: 12, layer: 1, handlingMethod: 'forklift' }),
    ];
    // Forklift items don't need crane access
    expect(validateCraneAccess(freight)).toHaveLength(0);
  });
});

// ─── validateSideAccess Tests ────────────────────────────────────────────────

describe('validateSideAccess', () => {
  const trailer = makeTrailer();

  it('returns no conflicts when forklift items are at the edge', () => {
    // Item at left edge — no blocking
    const freight = [
      makePlacedFreight({
        orderNumber: 'A',
        deliveryStop: 1,
        x: 100,
        y: -51, // at the left edge
        width: 30,
        handlingMethod: 'forklift',
      }),
      makePlacedFreight({
        orderNumber: 'B',
        deliveryStop: 2,
        x: 100,
        y: 10, // to the right, not blocking left access
        width: 30,
        handlingMethod: 'forklift',
      }),
    ];
    expect(validateSideAccess(freight, trailer)).toHaveLength(0);
  });

  it('detects lateral blocking from both sides', () => {
    // Item in the center, blocked by later-stop items on both sides
    const freight = [
      makePlacedFreight({
        orderNumber: 'CENTER',
        deliveryStop: 1,
        x: 100,
        y: -15,
        width: 30,
        height: 12,
        handlingMethod: 'forklift',
      }),
      makePlacedFreight({
        orderNumber: 'LEFT-BLOCKER',
        deliveryStop: 2,
        x: 100,
        y: -51,
        width: 30,
        height: 12,
        handlingMethod: 'crane',
      }),
      makePlacedFreight({
        orderNumber: 'RIGHT-BLOCKER',
        deliveryStop: 3,
        x: 100,
        y: 20,
        width: 30,
        height: 12,
        handlingMethod: 'crane',
      }),
    ];
    const conflicts = validateSideAccess(freight, trailer);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].blockedItem).toBe('CENTER');
    expect(conflicts[0].violationType).toBe('lateral');
  });

  it('allows access when only blocked from one side', () => {
    // Item blocked from the right but accessible from the left
    const freight = [
      makePlacedFreight({
        orderNumber: 'TARGET',
        deliveryStop: 1,
        x: 100,
        y: -40,
        width: 30,
        height: 12,
        handlingMethod: 'forklift',
      }),
      makePlacedFreight({
        orderNumber: 'RIGHT-BLOCKER',
        deliveryStop: 2,
        x: 100,
        y: -5,
        width: 30,
        height: 12,
        handlingMethod: 'crane',
      }),
    ];
    expect(validateSideAccess(freight, trailer)).toHaveLength(0);
  });

  it('does not check crane-handled items', () => {
    // Crane items don't need side access
    const freight = [
      makePlacedFreight({
        orderNumber: 'A',
        deliveryStop: 1,
        x: 100,
        y: -15,
        width: 30,
        handlingMethod: 'crane',
      }),
    ];
    expect(validateSideAccess(freight, trailer)).toHaveLength(0);
  });
});

// ─── validateRearAccess Tests ────────────────────────────────────────────────

describe('validateRearAccess', () => {
  const trailer = makeTrailer();

  it('returns no conflicts when nothing blocks rear path', () => {
    // Item at the rear of trailer — clear path
    const freight = [
      makePlacedFreight({
        orderNumber: 'A',
        deliveryStop: 1,
        x: 500,
        y: -24,
        handlingMethod: 'manual',
      }),
    ];
    expect(validateRearAccess(freight, trailer)).toHaveLength(0);
  });

  it('detects rear blocking by later-stop item behind target', () => {
    const freight = [
      makePlacedFreight({
        orderNumber: 'FRONT',
        deliveryStop: 1,
        x: 100,
        y: -24,
        width: 48,
        height: 12,
        handlingMethod: 'manual',
      }),
      makePlacedFreight({
        orderNumber: 'REAR-BLOCKER',
        deliveryStop: 2,
        x: 300,
        y: -24,
        width: 48,
        height: 12,
        handlingMethod: 'crane',
      }),
    ];
    const conflicts = validateRearAccess(freight, trailer);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].blockedItem).toBe('FRONT');
    expect(conflicts[0].blockingItem).toBe('REAR-BLOCKER');
    expect(conflicts[0].violationType).toBe('rear');
  });

  it('allows if blocking item is at same or earlier stop', () => {
    const freight = [
      makePlacedFreight({
        orderNumber: 'FRONT',
        deliveryStop: 2,
        x: 100,
        y: -24,
        width: 48,
        height: 12,
        handlingMethod: 'manual',
      }),
      makePlacedFreight({
        orderNumber: 'REAR-SAME',
        deliveryStop: 1,
        x: 300,
        y: -24,
        width: 48,
        height: 12,
        handlingMethod: 'crane',
      }),
    ];
    // Earlier stop behind a later stop is fine
    expect(validateRearAccess(freight, trailer)).toHaveLength(0);
  });

  it('does not flag items at different lateral positions', () => {
    const freight = [
      makePlacedFreight({
        orderNumber: 'FRONT',
        deliveryStop: 1,
        x: 100,
        y: -50,
        width: 20,
        height: 12,
        handlingMethod: 'manual',
      }),
      makePlacedFreight({
        orderNumber: 'REAR-NO-OVERLAP',
        deliveryStop: 2,
        x: 300,
        y: 20,
        width: 20,
        height: 12,
        handlingMethod: 'crane',
      }),
    ];
    // No lateral overlap, so no blocking
    expect(validateRearAccess(freight, trailer)).toHaveLength(0);
  });
});

// ─── validateStopOrderAccessibility (Combined) Tests ─────────────────────────

describe('validateStopOrderAccessibility', () => {
  const trailer = makeTrailer();

  it('returns accessible for empty freight', () => {
    const result = validateStopOrderAccessibility([], trailer);
    expect(result.isAccessible).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it('returns accessible for single-stop loads', () => {
    const freight = [
      makePlacedFreight({ orderNumber: 'A', deliveryStop: 1, x: 0, z: 0 }),
      makePlacedFreight({ orderNumber: 'B', deliveryStop: 1, x: 0, z: 12, layer: 1 }),
    ];
    const result = validateStopOrderAccessibility(freight, trailer);
    expect(result.isAccessible).toBe(true);
  });

  it('detects invalid delivery stop assignments', () => {
    const freight = [
      makePlacedFreight({ orderNumber: 'BAD', deliveryStop: 0 }),
    ];
    const result = validateStopOrderAccessibility(freight, trailer);
    expect(result.isAccessible).toBe(false);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it('reports conflicts for multi-stop with vertical blockage', () => {
    const freight = [
      makePlacedFreight({ orderNumber: 'STOP1', deliveryStop: 1, x: 0, y: -24, z: 0, handlingMethod: 'crane' }),
      makePlacedFreight({ orderNumber: 'STOP2', deliveryStop: 2, x: 0, y: -24, z: 12, layer: 1, handlingMethod: 'crane' }),
    ];
    const result = validateStopOrderAccessibility(freight, trailer);
    expect(result.isAccessible).toBe(false);
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts[0].violationType).toBe('vertical');
  });

  it('passes when multi-stop items are properly separated', () => {
    const freight = [
      makePlacedFreight({ orderNumber: 'STOP1', deliveryStop: 1, x: 400, y: -24, z: 0, handlingMethod: 'crane' }),
      makePlacedFreight({ orderNumber: 'STOP2', deliveryStop: 2, x: 100, y: -24, z: 0, handlingMethod: 'crane' }),
    ];
    const result = validateStopOrderAccessibility(freight, trailer);
    expect(result.isAccessible).toBe(true);
  });

  it('uses stopConfigs to override unloading methods', () => {
    // Item A at stop 1 (default crane), item B at stop 2 behind A
    const freight = [
      makePlacedFreight({
        orderNumber: 'A',
        deliveryStop: 1,
        x: 100,
        y: -24,
        width: 48,
        height: 12,
        handlingMethod: 'crane', // will be overridden to forklift_rear
      }),
      makePlacedFreight({
        orderNumber: 'B',
        deliveryStop: 2,
        x: 300,
        y: -24,
        width: 48,
        height: 12,
        handlingMethod: 'crane',
      }),
    ];
    // Override stop 1 to forklift_rear — now B blocks A from the rear
    const result = validateStopOrderAccessibility(freight, trailer, [
      { stop: 1, method: 'forklift_rear' },
    ]);
    // Should detect rear access conflict
    expect(result.conflicts.some(c => c.violationType === 'rear')).toBe(true);
  });

  it('provides a meaningful summary message', () => {
    const freight = [
      makePlacedFreight({ orderNumber: 'A', deliveryStop: 1, x: 0, y: -24, z: 0, handlingMethod: 'crane' }),
      makePlacedFreight({ orderNumber: 'B', deliveryStop: 2, x: 0, y: -24, z: 12, layer: 1, handlingMethod: 'crane' }),
    ];
    const result = validateStopOrderAccessibility(freight, trailer);
    expect(result.summary).toContain('conflict');
  });

  it('includes suggested actions in conflict reports', () => {
    const freight = [
      makePlacedFreight({ orderNumber: 'A', deliveryStop: 1, x: 0, y: -24, z: 0, handlingMethod: 'crane' }),
      makePlacedFreight({ orderNumber: 'B', deliveryStop: 2, x: 0, y: -24, z: 12, layer: 1, handlingMethod: 'crane' }),
    ];
    const result = validateStopOrderAccessibility(freight, trailer);
    for (const conflict of result.conflicts) {
      expect(conflict.suggestedAction).toBeDefined();
      expect(conflict.suggestedAction.length).toBeGreaterThan(0);
    }
  });
});
