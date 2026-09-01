// ─── Tests for the Constraint Validator ──────────────────────────────────────
// Feature: load-diagram-generator
// Validates: Requirements 5.1, 5.5, 6.2

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateAllConstraints,
  validateSinglePlacement,
  type StackabilityMatrix,
} from './constraint-validator';
import { computeLoadPlan } from './packing-engine';
import type { LoadItem, PlacedItem, TrailerProfile } from './types';

const TRAILER: TrailerProfile = {
  id: 'test',
  name: 'Test Trailer',
  internalLength: 13600,
  internalWidth: 2480,
  internalHeight: 2700,
  maxPayloadWeight: 24000,
  axleCount: 3,
  axleWeightLimits: [8000, 8000, 8000],
  displayUnitSystem: 'metric',
  doorConfig: { rear: true, sideLeft: false, sideRight: false },
  isTemplate: false,
};

function item(overrides: Partial<PlacedItem> & { id: string }): PlacedItem {
  return {
    itemId: overrides.id,
    description: undefined,
    length: 1000,
    width: 1000,
    height: 1000,
    weight: 100,
    quantity: 1,
    floorOnly: false,
    topLoadProhibited: false,
    placedX: 0,
    placedY: 0,
    placedZ: 0,
    placedOrientation: 'LWH',
    loadSequence: 1,
    ...overrides,
  };
}

// ─── Consistency with the engine ─────────────────────────────────────────────

function arbitraryItems(): fc.Arbitrary<LoadItem[]> {
  const one = fc.record({
    idNum: fc.integer({ min: 1, max: 9999 }),
    length: fc.integer({ min: 200, max: 1200 }),
    width: fc.integer({ min: 200, max: 1200 }),
    height: fc.integer({ min: 200, max: 1200 }),
    weight: fc.integer({ min: 10, max: 600 }),
    deliveryStop: fc.integer({ min: 1, max: 4 }),
  }).map((r): LoadItem => ({
    id: `item-${r.idNum}`,
    itemId: `SKU-${r.idNum}`,
    length: r.length,
    width: r.width,
    height: r.height,
    weight: r.weight,
    quantity: 1,
    deliveryStop: r.deliveryStop,
    floorOnly: false,
    topLoadProhibited: false,
  }));
  return fc.array(one, { minLength: 1, maxLength: 20 });
}

describe('validator/engine consistency', () => {
  it('reports no violations for any plan the engine produces', () => {
    fc.assert(
      fc.property(arbitraryItems(), (items) => {
        const { placedItems } = computeLoadPlan(items, TRAILER);
        const violations = validateAllConstraints(placedItems, TRAILER);
        expect(violations).toEqual([]);
      }),
      { numRuns: 50 },
    );
  });
});

// ─── Targeted single-placement checks ────────────────────────────────────────

describe('validateSinglePlacement', () => {
  it('accepts a valid floor placement', () => {
    const a = item({ id: 'a' });
    expect(validateSinglePlacement(a, [a], TRAILER)).toEqual([]);
  });

  it('flags out-of-bounds placement', () => {
    const a = item({ id: 'a', placedX: 13000, length: 1000 });
    const v = validateSinglePlacement(a, [a], TRAILER);
    expect(v.some((x) => x.type === 'out_of_bounds')).toBe(true);
  });

  it('flags overlapping items', () => {
    const a = item({ id: 'a' });
    const b = item({ id: 'b', placedX: 500 }); // overlaps a
    const v = validateSinglePlacement(b, [a, b], TRAILER);
    expect(v.some((x) => x.type === 'overlap' && x.relatedItemIds?.includes('a'))).toBe(true);
  });

  it('flags a floating (unsupported) item', () => {
    const a = item({ id: 'a', placedZ: 1500 }); // in the air, nothing below
    const v = validateSinglePlacement(a, [a], TRAILER);
    expect(v.some((x) => x.type === 'unsupported')).toBe(true);
  });

  it('flags a floor-only item placed off the floor', () => {
    const base = item({ id: 'base' });
    const top = item({ id: 'top', placedZ: 1000, floorOnly: true });
    const v = validateSinglePlacement(top, [base, top], TRAILER);
    expect(v.some((x) => x.type === 'floor_only')).toBe(true);
  });

  it('flags stacking on a top-load-prohibited item', () => {
    const base = item({ id: 'base', topLoadProhibited: true });
    const top = item({ id: 'top', placedZ: 1000 });
    const v = validateSinglePlacement(top, [base, top], TRAILER);
    expect(v.some((x) => x.type === 'top_load_prohibited' && x.relatedItemIds?.includes('base'))).toBe(true);
  });

  it('flags a disallowed stackability class combination', () => {
    const matrix: StackabilityMatrix = { fragile: { heavy: false } };
    const base = item({ id: 'base', stackabilityClass: 'fragile' });
    const top = item({ id: 'top', placedZ: 1000, stackabilityClass: 'heavy' });
    const v = validateSinglePlacement(top, [base, top], TRAILER, matrix);
    expect(v.some((x) => x.type === 'stackability_class')).toBe(true);
  });

  it('flags exceeding a supporting item max stack weight', () => {
    const base = item({ id: 'base', maxStackWeight: 50 });
    const top = item({ id: 'top', placedZ: 1000, weight: 100 });
    const v = validateSinglePlacement(top, [base, top], TRAILER);
    expect(v.some((x) => x.type === 'max_stack_weight')).toBe(true);
  });

  it('flags a temperature zone mismatch between stacked items', () => {
    const base = item({ id: 'base', temperatureZone: 'frozen' });
    const top = item({ id: 'top', placedZ: 1000, temperatureZone: 'ambient' });
    const v = validateSinglePlacement(top, [base, top], TRAILER);
    expect(v.some((x) => x.type === 'temperature_zone')).toBe(true);
  });
});

describe('validateAllConstraints plan-wide checks', () => {
  it('flags exceeding max payload', () => {
    // Many heavy items spread out so only payload (not axle) trips first-ish;
    // both may fire, we just assert max_payload is present.
    const items: PlacedItem[] = Array.from({ length: 6 }, (_, i) =>
      item({ id: `h${i}`, placedX: i * 2000, weight: 5000, length: 1500 }),
    );
    const v = validateAllConstraints(items, TRAILER);
    expect(v.some((x) => x.type === 'max_payload')).toBe(true);
  });

  it('flags exceeding an axle weight limit', () => {
    // Concentrate heavy weight at one longitudinal position.
    const items: PlacedItem[] = [
      item({ id: 'x1', placedX: 6800, weight: 7000, length: 1000 }),
      item({ id: 'x2', placedX: 6800, placedZ: 1000, weight: 7000, length: 1000, maxStackWeight: 99999 }),
    ];
    const v = validateAllConstraints(items, TRAILER);
    expect(v.some((x) => x.type === 'axle_weight_limit')).toBe(true);
  });

  it('reports each overlapping pair only once', () => {
    const a = item({ id: 'a' });
    const b = item({ id: 'b', placedX: 500 });
    const v = validateAllConstraints([a, b], TRAILER);
    expect(v.filter((x) => x.type === 'overlap').length).toBe(1);
  });
});
