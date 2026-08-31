// ─── Property-Based Tests for Order Grouping ─────────────────────────────────
// Feature: daily-fleet-load-planner
// Property 6: Orders grouped by Delivery_Number partition completely
// Validates: Requirements 3.4

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { groupOrdersByDeliveryNumber } from './delivery-matcher';
import type { SteelOrderLineItem } from '@ptv-discovery-coach/shared';

// ─── Custom Generators ───────────────────────────────────────────────────────

/**
 * Generates a minimal SteelOrderLineItem stub with orderNumber and deliveryNumber.
 * Uses type assertion since we only need these fields for grouping logic.
 */
export function _arbitraryOrderStub(): fc.Arbitrary<SteelOrderLineItem> {
  return fc
    .record({
      orderNumber: fc.stringMatching(/^ORD-[A-Z0-9]{3,8}$/),
      deliveryNumber: fc.stringMatching(/^DN-[A-Z0-9]{2,6}$/),
    })
    .map(
      ({ orderNumber, deliveryNumber }) =>
        ({
          orderNumber,
          deliveryNumber,
          customerName: 'Test Customer',
          deliveryStop: 1,
          productType: 'plate',
          quantity: 1,
          pieceWeight: 1000,
          dimensions: { length: 48, width: 24, height: 6 },
          totalLineWeight: 1000,
          handlingMethod: 'crane',
          stackPermission: 'yes',
          maxStackHeight: 72,
          maxStackWeight: 5000,
          orientationRequirement: 'any',
          dunnageRequired: false,
          specialNotes: '',
        }) as SteelOrderLineItem,
    );
}

/**
 * Generates an array of order stubs with delivery numbers drawn from a
 * limited pool, ensuring multiple orders can share the same delivery number.
 */
function arbitraryOrderSet(): fc.Arbitrary<SteelOrderLineItem[]> {
  return fc
    .tuple(
      // Pool of delivery numbers (1-5 unique values)
      fc.array(fc.stringMatching(/^DN-[A-Z0-9]{2,6}$/), {
        minLength: 1,
        maxLength: 5,
      }),
      // Number of orders to generate
      fc.integer({ min: 1, max: 30 }),
    )
    .chain(([deliveryNumbers, count]) =>
      fc.array(
        fc.record({
          orderNumber: fc.stringMatching(/^ORD-[A-Z0-9]{3,8}$/),
          deliveryNumberIndex: fc.integer({
            min: 0,
            max: deliveryNumbers.length - 1,
          }),
        }).map(({ orderNumber, deliveryNumberIndex }) => ({
          orderNumber,
          deliveryNumber: deliveryNumbers[deliveryNumberIndex],
          customerName: 'Test Customer',
          deliveryStop: 1,
          productType: 'plate' as const,
          quantity: 1,
          pieceWeight: 1000,
          dimensions: { length: 48, width: 24, height: 6 },
          totalLineWeight: 1000,
          handlingMethod: 'crane' as const,
          stackPermission: 'yes' as const,
          maxStackHeight: 72,
          maxStackWeight: 5000,
          orientationRequirement: 'any' as const,
          dunnageRequired: false,
          specialNotes: '',
        }) as SteelOrderLineItem),
        { minLength: 1, maxLength: count },
      ),
    );
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Delivery Matcher — Order Grouping Property Tests', () => {
  // Feature: daily-fleet-load-planner, Property 6: Orders grouped by Delivery_Number partition completely
  // **Validates: Requirements 3.4**
  it('Property 6: grouped orders form a complete partition (no orders lost, no duplicates)', () => {
    fc.assert(
      fc.property(arbitraryOrderSet(), (orders) => {
        const groups = groupOrdersByDeliveryNumber(orders);

        // 1. Total count across all groups equals input length (no orders lost)
        let totalGroupedCount = 0;
        for (const groupOrders of groups.values()) {
          totalGroupedCount += groupOrders.length;
        }
        expect(totalGroupedCount).toBe(orders.length);

        // 2. Groups are disjoint — no order appears in multiple groups
        const allGroupedOrders: SteelOrderLineItem[] = [];
        for (const groupOrders of groups.values()) {
          allGroupedOrders.push(...groupOrders);
        }
        // Use object identity: each order reference should appear exactly once
        const uniqueRefs = new Set(allGroupedOrders);
        expect(uniqueRefs.size).toBe(orders.length);

        // 3. Every order from input appears in exactly one group (complete partition)
        for (const order of orders) {
          const key = order.deliveryNumber?.trim() || '';
          const group = groups.get(key);
          expect(group).toBeDefined();
          expect(group).toContain(order);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Additional edge case: empty order set should produce empty map
  it('Property 6 (edge): empty order array produces empty groups', () => {
    const groups = groupOrdersByDeliveryNumber([]);
    expect(groups.size).toBe(0);
  });
});
