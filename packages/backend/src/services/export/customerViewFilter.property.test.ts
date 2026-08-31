// ─── Property-Based Tests for Customer View Isolation ────────────────────────
// Feature: flatbed-load-planner, Property 17: Customer view data isolation
// Validates: Requirements 15.5
//
// For any customer viewing a shared plan link, the displayed items SHALL contain
// only freight assigned to that customer's delivery stops — no items from other
// customers SHALL be visible.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterPlanForCustomer } from './customerViewFilter.js';
import type {
  PlanExportData,
  FreightItem,
  PlacedFreightItem,
  LoadingStepData,
} from './PdfExportService.js';

// ─── Custom Generators ───────────────────────────────────────────────────────

/** Generates a customer name from a small pool to ensure overlap */
function arbitraryCustomerName(): fc.Arbitrary<string> {
  return fc.constantFrom(
    'Acme Steel Co',
    'Global Metals Inc',
    'Northwest Fabricators',
    'Pacific Iron Works',
    'Summit Steel Supply'
  );
}

/** Generates a valid order number */
function arbitraryOrderNumber(index: number): fc.Arbitrary<string> {
  return fc.constant(`ORD-${String(index).padStart(4, '0')}`);
}

/** Generates a steel product type */
function arbitraryProductType(): fc.Arbitrary<string> {
  return fc.constantFrom(
    'coil_hot_rolled',
    'coil_cold_rolled',
    'plate',
    'beam_i',
    'pipe',
    'rebar_bundle',
    'sheet_bundle',
    'channel'
  );
}

/** Generates a delivery stop number (1-5) */
function arbitraryDeliveryStop(): fc.Arbitrary<number> {
  return fc.integer({ min: 1, max: 5 });
}

/** Generates a single FreightItem with a given index for unique order numbers */
function arbitraryFreightItem(index: number): fc.Arbitrary<FreightItem> {
  return fc.record({
    orderNumber: arbitraryOrderNumber(index),
    customerName: arbitraryCustomerName(),
    deliveryStop: arbitraryDeliveryStop(),
    productType: arbitraryProductType(),
    quantity: fc.integer({ min: 1, max: 20 }),
    weight: fc.integer({ min: 1000, max: 50000 }),
  });
}

/**
 * Generates a freight manifest with multiple customers.
 * Ensures at least 2 different customers are present.
 */
function arbitraryFreightManifest(): fc.Arbitrary<FreightItem[]> {
  return fc
    .integer({ min: 4, max: 20 })
    .chain((count) => {
      const items: fc.Arbitrary<FreightItem>[] = [];
      for (let i = 0; i < count; i++) {
        items.push(arbitraryFreightItem(i + 1));
      }
      return fc.tuple(...items).map((arr) => arr as FreightItem[]);
    })
    .filter((items) => {
      // Ensure at least 2 distinct customers
      const customers = new Set(items.map((i) => i.customerName));
      return customers.size >= 2;
    });
}

/**
 * Generates placed freight items consistent with a freight manifest.
 */
function arbitraryPlacedFreightFromManifest(
  manifest: FreightItem[]
): PlacedFreightItem[] {
  return manifest.map((item) => ({
    orderNumber: item.orderNumber,
    productType: item.productType,
    position: { x: Math.random() * 600, y: Math.random() * 96, z: 0 },
    orientation: Math.random() > 0.5 ? 'longitudinal' : 'transverse',
    layer: 0,
    supportMethod: 'direct_to_deck',
    weight: item.weight,
  }));
}

/**
 * Generates loading steps consistent with a freight manifest.
 * Each step references an item by including its order number in the description.
 */
function arbitraryLoadingSequenceFromManifest(
  manifest: FreightItem[]
): LoadingStepData[] {
  return manifest.map((item, idx) => ({
    stepNumber: idx + 1,
    itemDescription: `${item.orderNumber} - ${item.productType} (${item.quantity}x)`,
    positionDescription: `Place at position ${idx + 1}`,
    orientation: 'longitudinal',
    dunnage: item.productType.includes('coil') ? '4x4 wood dunnage' : 'None',
    securement: 'Chain with binder',
  }));
}

/**
 * Generates a complete PlanExportData with multi-customer freight.
 */
function arbitraryMultiCustomerPlan(): fc.Arbitrary<PlanExportData> {
  return arbitraryFreightManifest().map((manifest) => {
    const placedFreight = arbitraryPlacedFreightFromManifest(manifest);
    const loadingSequence = arbitraryLoadingSequenceFromManifest(manifest);

    return {
      planId: 'plan-test-001',
      version: 1,
      status: 'approved',
      equipment: {
        tractorName: 'Test Tractor',
        trailerName: 'Test 53ft Flatbed',
        trailerLengthFt: 53,
        maxGrossWeight: 80000,
        availablePayload: 48000,
      },
      freightManifest: manifest,
      placedFreight,
      weightMetrics: {
        totalGross: 60000,
        steerAxleWeight: 12000,
        driveAxleWeight: 20000,
        trailerAxleWeight: 28000,
        cgLongitudinal: 280,
        cgLateral: 0.5,
        steerAxlePercent: 85,
        driveAxlePercent: 88,
        trailerAxlePercent: 82,
      },
      securementPlan: {
        items: [],
        totalTieDowns: 10,
        totalWLL: 25000,
      },
      loadingSequence,
      warnings: [],
    };
  });
}

// ─── Property 17: Customer view data isolation ───────────────────────────────

describe('Feature: flatbed-load-planner, Property 17: Customer view data isolation', () => {
  /**
   * **Validates: Requirements 15.5**
   *
   * For any plan with multiple customers and any single customer C, the filtered
   * view contains ONLY items where customerName === C. No items from other
   * customers should be visible in the freight manifest.
   */
  it('filtered freight manifest contains only items belonging to the target customer', () => {
    fc.assert(
      fc.property(
        arbitraryMultiCustomerPlan(),
        (planData) => {
          // Pick a customer that exists in the plan
          const allCustomers = [...new Set(planData.freightManifest.map((i) => i.customerName))];
          for (const targetCustomer of allCustomers) {
            const view = filterPlanForCustomer(planData, targetCustomer);

            // INCLUSION: All items in the view belong to the target customer
            for (const item of view.freightItems) {
              expect(item.customerName).toBe(targetCustomer);
            }

            // EXCLUSION: No items from other customers are present
            const otherCustomerItems = view.freightItems.filter(
              (item) => item.customerName !== targetCustomer
            );
            expect(otherCustomerItems).toHaveLength(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 15.5**
   *
   * All items assigned to the customer's stops are included (completeness).
   * No customer items are lost during filtering.
   */
  it('filtered view includes ALL items belonging to the target customer (completeness)', () => {
    fc.assert(
      fc.property(
        arbitraryMultiCustomerPlan(),
        (planData) => {
          const allCustomers = [...new Set(planData.freightManifest.map((i) => i.customerName))];
          for (const targetCustomer of allCustomers) {
            const view = filterPlanForCustomer(planData, targetCustomer);

            // Count expected items for this customer in the original manifest
            const expectedItems = planData.freightManifest.filter(
              (item) => item.customerName === targetCustomer
            );

            // The filtered view must contain exactly the same count
            expect(view.freightItems.length).toBe(expectedItems.length);

            // All expected order numbers must be present
            const expectedOrderNumbers = new Set(expectedItems.map((i) => i.orderNumber));
            const actualOrderNumbers = new Set(view.freightItems.map((i) => i.orderNumber));
            for (const orderNum of expectedOrderNumbers) {
              expect(actualOrderNumbers.has(orderNum)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 15.5**
   *
   * Placed freight items in the customer view only reference order numbers
   * that belong to the target customer. No other customer's placement data leaks.
   */
  it('placed freight items contain only the target customer order numbers', () => {
    fc.assert(
      fc.property(
        arbitraryMultiCustomerPlan(),
        (planData) => {
          const allCustomers = [...new Set(planData.freightManifest.map((i) => i.customerName))];
          for (const targetCustomer of allCustomers) {
            const view = filterPlanForCustomer(planData, targetCustomer);

            // Get the set of order numbers that belong to this customer
            const customerOrderNumbers = new Set(
              planData.freightManifest
                .filter((item) => item.customerName === targetCustomer)
                .map((item) => item.orderNumber)
            );

            // Every placed freight item in the view must have an order number from the customer
            for (const placed of view.placedFreight) {
              expect(customerOrderNumbers.has(placed.orderNumber)).toBe(true);
            }

            // No placed freight from other customers should be present
            const otherCustomerOrders = new Set(
              planData.freightManifest
                .filter((item) => item.customerName !== targetCustomer)
                .map((item) => item.orderNumber)
            );
            for (const placed of view.placedFreight) {
              expect(otherCustomerOrders.has(placed.orderNumber)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 15.5**
   *
   * The customer stops list in the view accurately reflects the delivery stops
   * that the customer has items assigned to (and no others).
   */
  it('customer stops reflect only the stops where the customer has items', () => {
    fc.assert(
      fc.property(
        arbitraryMultiCustomerPlan(),
        (planData) => {
          const allCustomers = [...new Set(planData.freightManifest.map((i) => i.customerName))];
          for (const targetCustomer of allCustomers) {
            const view = filterPlanForCustomer(planData, targetCustomer);

            // Expected stops: unique delivery stops from the customer's items
            const expectedStops = [
              ...new Set(
                planData.freightManifest
                  .filter((item) => item.customerName === targetCustomer)
                  .map((item) => item.deliveryStop)
              ),
            ].sort((a, b) => a - b);

            expect(view.customerStops).toEqual(expectedStops);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 15.5**
   *
   * For a customer with no items in the plan, the filtered view is empty.
   * This ensures non-existent customers see nothing.
   */
  it('non-existent customer receives an empty view with no items', () => {
    fc.assert(
      fc.property(
        arbitraryMultiCustomerPlan(),
        (planData) => {
          const nonExistentCustomer = 'ZZZZZ_NonExistent_Customer_ZZZZZ';
          const view = filterPlanForCustomer(planData, nonExistentCustomer);

          expect(view.freightItems).toHaveLength(0);
          expect(view.placedFreight).toHaveLength(0);
          expect(view.loadingSequence).toHaveLength(0);
          expect(view.customerStops).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
