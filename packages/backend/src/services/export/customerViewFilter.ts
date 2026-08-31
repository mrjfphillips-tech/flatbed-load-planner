/**
 * Customer View Filter — Filters plan data for customer-specific shareable link views.
 *
 * When a Customer_Viewer accesses a shared link, only items assigned to that customer's
 * delivery stops are displayed. This module provides the pure filtering logic that
 * enforces data isolation between customers viewing the same plan.
 *
 * Validates: Requirements 15.5
 */

import type { PlanExportData, FreightItem, PlacedFreightItem, LoadingStepData } from './PdfExportService.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A filtered view of plan data containing only the items relevant to a specific customer.
 */
export interface CustomerPlanView {
  planId: string;
  version: number;
  status: string;
  customerName: string;
  /** Only freight items belonging to this customer */
  freightItems: FreightItem[];
  /** Only placed freight items belonging to this customer */
  placedFreight: PlacedFreightItem[];
  /** Only loading steps referencing this customer's items */
  loadingSequence: LoadingStepData[];
  /** Delivery stops assigned to this customer */
  customerStops: number[];
}

// ─── Filter Function ──────────────────────────────────────────────────────────

/**
 * Filters a full plan export to show only items assigned to a specific customer's
 * delivery stops. Ensures complete data isolation — no other customer's freight
 * is visible in the returned view.
 *
 * The filtering logic:
 * 1. Identifies all delivery stops assigned to the target customer
 * 2. Returns only freight manifest items where customerName matches
 * 3. Returns only placed freight items whose orderNumber is in the customer's manifest
 * 4. Returns only loading steps that reference the customer's items
 *
 * @param planData - The full plan export data
 * @param customerName - The customer name to filter for (case-sensitive match)
 * @returns A filtered customer view containing only that customer's items
 */
export function filterPlanForCustomer(
  planData: PlanExportData,
  customerName: string
): CustomerPlanView {
  // Step 1: Filter freight manifest to only this customer's items
  const customerFreight = planData.freightManifest.filter(
    (item) => item.customerName === customerName
  );

  // Step 2: Identify the customer's delivery stops
  const customerStops = [...new Set(customerFreight.map((item) => item.deliveryStop))].sort(
    (a, b) => a - b
  );

  // Step 3: Get order numbers belonging to this customer
  const customerOrderNumbers = new Set(customerFreight.map((item) => item.orderNumber));

  // Step 4: Filter placed freight to only customer's items
  const customerPlacedFreight = planData.placedFreight.filter((placed) =>
    customerOrderNumbers.has(placed.orderNumber)
  );

  // Step 5: Filter loading sequence to only steps referencing customer's items
  const customerLoadingSequence = planData.loadingSequence.filter((step) => {
    // Match loading steps that reference any of the customer's order numbers
    // The itemDescription typically contains the order number
    return [...customerOrderNumbers].some(
      (orderNum) => step.itemDescription.includes(orderNum)
    );
  });

  return {
    planId: planData.planId,
    version: planData.version,
    status: planData.status,
    customerName,
    freightItems: customerFreight,
    placedFreight: customerPlacedFreight,
    loadingSequence: customerLoadingSequence,
    customerStops,
  };
}
