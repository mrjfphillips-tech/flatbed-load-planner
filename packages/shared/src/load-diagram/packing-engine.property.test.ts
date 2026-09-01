// ─── Property-Based Tests for the 3D Packing Engine ─────────────────────────
// Feature: load-diagram-generator
// Validates packing invariants: no overlaps, within bounds, weight <= payload,
// axle-weight conservation, load-sequence ordering, floor-only at Z=0, and
// nothing above top-load-prohibited items.
// Validates: Requirements 3.1, 3.3, 3.4, 3.5

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeLoadPlan, calculateAxleWeights } from './packing-engine';
import type { LoadItem, PlacedItem, ItemOrientation, TrailerProfile } from './types';

// ─── Fixtures & generators ───────────────────────────────────────────────────

/** A roomy trailer so most items fit and invariants get exercised. */
const TEST_TRAILER: TrailerProfile = {
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

const ORIENTATION_MAP: Record<ItemOrientation, ['length' | 'width' | 'height', 'length' | 'width' | 'height', 'length' | 'width' | 'height']> = {
  LWH: ['length', 'width', 'height'],
  WLH: ['width', 'length', 'height'],
  LHW: ['length', 'height', 'width'],
  WHL: ['width', 'height', 'length'],
  HLW: ['height', 'length', 'width'],
  HWL: ['height', 'width', 'length'],
};

function orientedExtent(it: PlacedItem): { dx: number; dy: number; dz: number } {
  const [a, b, c] = ORIENTATION_MAP[it.placedOrientation];
  return { dx: it[a], dy: it[b], dz: it[c] };
}

function boxOf(it: PlacedItem) {
  const { dx, dy, dz } = orientedExtent(it);
  return {
    x0: it.placedX,
    y0: it.placedY,
    z0: it.placedZ,
    x1: it.placedX + dx,
    y1: it.placedY + dy,
    z1: it.placedZ + dz,
  };
}

function overlaps3D(a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>): boolean {
  const EPS = 1e-6;
  return (
    a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS &&
    a.y0 < b.y1 - EPS && a.y1 > b.y0 + EPS &&
    a.z0 < b.z1 - EPS && a.z1 > b.z0 + EPS
  );
}

function overlapsXY(a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>): boolean {
  const EPS = 1e-6;
  return (
    a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS &&
    a.y0 < b.y1 - EPS && a.y1 > b.y0 + EPS
  );
}

/** Generates a modestly sized load item that fits comfortably in the trailer. */
function arbitraryItem(): fc.Arbitrary<LoadItem> {
  return fc.record({
    idNum: fc.integer({ min: 1, max: 9999 }),
    length: fc.integer({ min: 200, max: 1200 }),
    width: fc.integer({ min: 200, max: 1200 }),
    height: fc.integer({ min: 200, max: 1200 }),
    weight: fc.integer({ min: 10, max: 800 }),
    deliveryStop: fc.integer({ min: 1, max: 5 }),
  }).map((r): LoadItem => ({
    id: `item-${r.idNum}`,
    itemId: `SKU-${String(r.idNum).padStart(4, '0')}`,
    length: r.length,
    width: r.width,
    height: r.height,
    weight: r.weight,
    quantity: 1,
    deliveryStop: r.deliveryStop,
    floorOnly: false,
    topLoadProhibited: false,
  }));
}

function arbitraryItems(min = 1, max = 25): fc.Arbitrary<LoadItem[]> {
  return fc.array(arbitraryItem(), { minLength: min, maxLength: max });
}

// ─── Invariant properties ────────────────────────────────────────────────────

describe('packing engine invariants', () => {
  it('never overlaps two placed items in 3D space', () => {
    fc.assert(
      fc.property(arbitraryItems(), (items) => {
        const { placedItems } = computeLoadPlan(items, TEST_TRAILER);
        for (let i = 0; i < placedItems.length; i++) {
          for (let j = i + 1; j < placedItems.length; j++) {
            expect(overlaps3D(boxOf(placedItems[i]), boxOf(placedItems[j]))).toBe(false);
          }
        }
      }),
      { numRuns: 50 },
    );
  });

  it('keeps all placed items within trailer bounds', () => {
    fc.assert(
      fc.property(arbitraryItems(), (items) => {
        const { placedItems } = computeLoadPlan(items, TEST_TRAILER);
        for (const it of placedItems) {
          const b = boxOf(it);
          expect(b.x0).toBeGreaterThanOrEqual(-1e-6);
          expect(b.y0).toBeGreaterThanOrEqual(-1e-6);
          expect(b.z0).toBeGreaterThanOrEqual(-1e-6);
          expect(b.x1).toBeLessThanOrEqual(TEST_TRAILER.internalLength + 1e-6);
          expect(b.y1).toBeLessThanOrEqual(TEST_TRAILER.internalWidth + 1e-6);
          expect(b.z1).toBeLessThanOrEqual(TEST_TRAILER.internalHeight + 1e-6);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('keeps total placed weight within max payload', () => {
    fc.assert(
      fc.property(arbitraryItems(), (items) => {
        const { placedItems } = computeLoadPlan(items, TEST_TRAILER);
        const total = placedItems.reduce((s, p) => s + p.weight, 0);
        expect(total).toBeLessThanOrEqual(TEST_TRAILER.maxPayloadWeight + 1e-6);
      }),
      { numRuns: 50 },
    );
  });

  it('conserves mass: sum of axle weights equals total placed weight', () => {
    fc.assert(
      fc.property(arbitraryItems(), (items) => {
        const { placedItems } = computeLoadPlan(items, TEST_TRAILER);
        const total = placedItems.reduce((s, p) => s + p.weight, 0);
        const axle = calculateAxleWeights(placedItems, TEST_TRAILER);
        const axleSum = axle.reduce((s, w) => s + w, 0);
        expect(axleSum).toBeCloseTo(total, 4);
      }),
      { numRuns: 50 },
    );
  });

  it('loads higher delivery stops first (lower load sequence)', () => {
    fc.assert(
      fc.property(arbitraryItems(), (items) => {
        const { placedItems } = computeLoadPlan(items, TEST_TRAILER);
        // For any two placed items, if A has a higher delivery stop than B,
        // A must have a lower (earlier) load sequence than B.
        for (const a of placedItems) {
          for (const b of placedItems) {
            const stopA = a.deliveryStop ?? 0;
            const stopB = b.deliveryStop ?? 0;
            if (stopA > stopB) {
              expect(a.loadSequence).toBeLessThan(b.loadSequence);
            }
          }
        }
      }),
      { numRuns: 50 },
    );
  });

  it('is deterministic: identical inputs produce identical placements', () => {
    fc.assert(
      fc.property(arbitraryItems(), (items) => {
        const a = computeLoadPlan(items, TEST_TRAILER);
        const b = computeLoadPlan(items, TEST_TRAILER);
        expect(a.placedItems.map((p) => [p.id, p.placedX, p.placedY, p.placedZ, p.placedOrientation, p.loadSequence]))
          .toEqual(b.placedItems.map((p) => [p.id, p.placedX, p.placedY, p.placedZ, p.placedOrientation, p.loadSequence]));
        expect(a.overflowItems.map((o) => o.id)).toEqual(b.overflowItems.map((o) => o.id));
      }),
      { numRuns: 30 },
    );
  });
});

describe('constraint enforcement', () => {
  it('places floor-only items directly on the floor (Z = 0)', () => {
    fc.assert(
      fc.property(arbitraryItems(1, 15), (items) => {
        const floorOnly = items.map((it, i) => ({ ...it, floorOnly: i % 2 === 0 }));
        const { placedItems } = computeLoadPlan(floorOnly, TEST_TRAILER);
        for (const it of placedItems) {
          if (it.floorOnly) {
            expect(it.placedZ).toBeCloseTo(0, 6);
          }
        }
      }),
      { numRuns: 40 },
    );
  });

  it('never places anything on top of a top-load-prohibited item', () => {
    fc.assert(
      fc.property(arbitraryItems(1, 15), (items) => {
        const marked = items.map((it, i) => ({ ...it, topLoadProhibited: i % 3 === 0 }));
        const { placedItems } = computeLoadPlan(marked, TEST_TRAILER);
        for (const target of placedItems) {
          if (!target.topLoadProhibited) continue;
          const tb = boxOf(target);
          for (const other of placedItems) {
            if (other === target) continue;
            const ob = boxOf(other);
            const directlyAbove = ob.z0 >= tb.z1 - 1e-6 && overlapsXY(ob, tb);
            expect(directlyAbove).toBe(false);
          }
        }
      }),
      { numRuns: 40 },
    );
  });

  it('respects max stack weight of supporting items', () => {
    fc.assert(
      fc.property(arbitraryItems(2, 15), (items) => {
        const withLimits = items.map((it) => ({ ...it, maxStackWeight: 300 }));
        const { placedItems } = computeLoadPlan(withLimits, TEST_TRAILER);
        for (const support of placedItems) {
          if (support.maxStackWeight == null) continue;
          const sb = boxOf(support);
          const onTopWeight = placedItems
            .filter((p) => p !== support && boxOf(p).z0 >= sb.z1 - 1e-6 && overlapsXY(boxOf(p), sb))
            .reduce((s, p) => s + p.weight, 0);
          expect(onTopWeight).toBeLessThanOrEqual(support.maxStackWeight + 1e-6);
        }
      }),
      { numRuns: 40 },
    );
  });
});
