// ─── Property-Based Tests for Batch Result Count ─────────────────────────────
// Feature: daily-fleet-load-planner
// Property 8: Batch generation produces one result per vehicle with orders
// **Validates: Requirements 4.1, 4.2**
//
// For N vehicles each with ≥1 order, assert Fleet_Plan_Result contains exactly
// N entries preserving vehicle ID, license plate, and vehicle type.

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import type { ConditionCode } from './types';

const VALID_CONDITION_CODES: ConditionCode[] = ['ZN', 'ZO', 'ZB', 'ZA', 'ZF'];

// ─── Custom Generators ───────────────────────────────────────────────────────

/** Generates a vehicle spec with unique identity fields and at least 1 order */
function arbitraryVehicleSpec() {
  return fc.record({
    vehicleId: fc.stringMatching(/^[A-Z]{2,4}[0-9]{2,4}$/).filter((s) => s.length >= 4),
    licensePlate: fc.stringMatching(/^[A-Z0-9]{5,8}$/).filter((s) => s.length >= 5),
    vehicleType: fc.constantFrom('Camión', 'Trailer c/Plataforma', 'Grúa'),
    conditionCode: fc.constantFrom(...VALID_CONDITION_CODES),
    orderCount: fc.integer({ min: 1, max: 5 }),
  });
}

/**
 * Generates a fleet of 1–10 vehicles, each with at least one order.
 * Deduplicates by vehicleId to ensure unique entries.
 */
function arbitraryFleetWithOrders() {
  return fc
    .array(arbitraryVehicleSpec(), { minLength: 1, maxLength: 10 })
    .map((specs) => {
      // Deduplicate by vehicleId
      const seen = new Set<string>();
      return specs.filter((v) => {
        if (seen.has(v.vehicleId)) return false;
        seen.add(v.vehicleId);
        return true;
      });
    })
    .filter((specs) => specs.length >= 1);
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Fleet Planner — Batch Result Count Property Tests', () => {
  // Feature: daily-fleet-load-planner, Property 8: Batch generation produces one result per vehicle with orders
  // **Validates: Requirements 4.1, 4.2**
  it('Property 8: For N vehicles with ≥1 order, result contains exactly N entries preserving vehicleId, licensePlate, and vehicleType', async () => {
    const { generateFleetPlan } = await import('./fleet-planner');
    const plannerModule = await import('@ptv-discovery-coach/shared');

    await fc.assert(
      fc.asyncProperty(arbitraryFleetWithOrders(), async (vehicleSpecs) => {
        // Mock generateLoadPlan to return a simple success result for each vehicle
        vi.spyOn(plannerModule, 'generateLoadPlan').mockImplementation((request: any) => {
          const items = request.items || [];
          return {
            placedFreight: items,
            unplacedItems: [],
            trailer: request.trailer,
            totalWeight: items.length * 1000,
            weightCapacity: 50000,
            loadingInstructions: [],
          } as any;
        });

        try {
          // Build the FleetPlanRequest — each vehicle has ≥1 order
          const fleetRequest = {
            vehicles: vehicleSpecs.map((spec) => ({
              vehicleId: spec.vehicleId,
              licensePlate: spec.licensePlate,
              vehicleType: spec.vehicleType,
              conditionCode: spec.conditionCode as ConditionCode,
              profile: {
                trailer: { id: `trailer-${spec.vehicleId}` } as any,
                tractor: { id: `tractor-${spec.vehicleId}` } as any,
                equipment: { id: `equip-${spec.vehicleId}` } as any,
              },
              orders: Array.from({ length: spec.orderCount }, (_, i) => ({
                orderNumber: `ORD-${spec.vehicleId}-${i}`,
                weight: 1000,
                length: 20,
                width: 4,
                height: 4,
              })) as any[],
            })),
            rules: [],
          };

          const result = await generateFleetPlan(fleetRequest);

          // ─── Assertion: Exactly N entries ──────────────────────────────
          expect(result.vehicles.length).toBe(vehicleSpecs.length);

          // ─── Assertion: Each entry preserves identity fields ───────────
          for (let i = 0; i < vehicleSpecs.length; i++) {
            const spec = vehicleSpecs[i];
            const entry = result.vehicles[i];

            expect(entry.vehicleId).toBe(spec.vehicleId);
            expect(entry.licensePlate).toBe(spec.licensePlate);
            expect(entry.vehicleType).toBe(spec.vehicleType);
          }
        } finally {
          vi.restoreAllMocks();
        }
      }),
      { numRuns: 100, timeout: 30000 },
    );
  }, 60000);
});
