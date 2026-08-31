// ─── Property-Based Tests for Fleet Delivery Matcher ─────────────────────────
// Feature: daily-fleet-load-planner
// Property 6: Orders grouped by Delivery_Number partition completely
// **Validates: Requirements 3.4**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { groupOrdersByDeliveryNumber } from './delivery-matcher';
import type { SteelOrderLineItem } from '@ptv-discovery-coach/shared';

// ─── Custom Generators ───────────────────────────────────────────────────────

/**
 * Generates an arbitrary SteelOrderLineItem with a random deliveryNumber.
 * Only orderNumber and deliveryNumber vary — other fields use fixed/minimal
 * values since grouping logic depends only on deliveryNumber.
 */
function arbitraryOrderWithDeliveryNumber(): fc.Arbitrary<SteelOrderLineItem> {
  return fc.record({
    orderNumber: fc.stringMatching(/^ORD-[A-Z0-9]{3,8}$/),
    customerName: fc.constant('Test Customer'),
    deliveryStop: fc.constant(1),
    productType: fc.constant('coil_hot_rolled' as const),
    quantity: fc.constant(1),
    pieceWeight: fc.constant(5000),
    dimensions: fc.constant({ length: 48, width: 48, height: 48 }),
    totalLineWeight: fc.constant(5000),
    handlingMethod: fc.constant('crane' as const),
    stackPermission: fc.constant('no' as const),
    maxStackHeight: fc.constant(0),
    maxStackWeight: fc.constant(0),
    orientationRequirement: fc.constant('any' as const),
    dunnageRequired: fc.constant(false),
    specialNotes: fc.constant(''),
    deliveryNumber: fc.oneof(
      // Most orders have a delivery number
      fc.stringMatching(/^DN-[A-Z0-9]{2,6}$/),
      // Some orders may have undefined or empty delivery number
      fc.constant(undefined),
      fc.constant(''),
    ),
  }) as fc.Arbitrary<SteelOrderLineItem>;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Fleet Delivery Matcher — Property Tests', () => {
  // Feature: daily-fleet-load-planner, Property 6: Orders grouped by Delivery_Number partition completely
  // **Validates: Requirements 3.4**
  it('Property 6: groups are disjoint and their union equals the original set', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryOrderWithDeliveryNumber(), { minLength: 0, maxLength: 50 }),
        (orders) => {
          const groups = groupOrdersByDeliveryNumber(orders);

          // 1. Union of all groups has the same total count as the input
          const totalGroupedCount = [...groups.values()].reduce(
            (sum, arr) => sum + arr.length,
            0,
          );
          expect(totalGroupedCount).toBe(orders.length);

          // 2. Groups are disjoint: no order appears in more than one group.
          //    Since orders are placed by reference, we can collect all
          //    grouped references and verify uniqueness.
          const allGroupedOrders: SteelOrderLineItem[] = [];
          for (const group of groups.values()) {
            allGroupedOrders.push(...group);
          }

          // Verify no duplicates by checking total count matches unique set size.
          // Using a Set of references (objects) to detect duplicated references.
          const uniqueRefs = new Set(allGroupedOrders);
          expect(uniqueRefs.size).toBe(allGroupedOrders.length);

          // 3. Every order from the original array is present in the grouped output
          //    (no orders lost). Each input order reference must appear exactly once.
          for (const order of orders) {
            expect(allGroupedOrders).toContain(order);
          }

          // 4. Every order in the grouped output came from the original array
          //    (no orders created from nowhere).
          for (const groupedOrder of allGroupedOrders) {
            expect(orders).toContain(groupedOrder);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
