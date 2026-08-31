// ─── Property-Based Tests for Fleet Summary Count Consistency ─────────────────
// Feature: daily-fleet-load-planner
// Property 10: Fleet summary counts are consistent
// Validates: Requirements 4.5

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import type { FleetPlanResult, VehiclePlanEntry, ConditionCode } from './types';

// ─── Custom Generators ───────────────────────────────────────────────────────

const VALID_CONDITION_CODES: ConditionCode[] = ['ZN', 'ZO', 'ZB', 'ZA', 'ZF'];

/** Generates an arbitrary vehicle plan entry with a random status */
function arbitraryVehiclePlanEntry(): fc.Arbitrary<VehiclePlanEntry> {
  const nonEmptyString = fc
    .stringMatching(/^[A-Za-z0-9][A-Za-z0-9 _-]{0,14}[A-Za-z0-9]$/)
    .filter((s) => s.trim().length > 0);

  const status = fc.constantFrom<'success' | 'partial' | 'failed'>('success', 'partial', 'failed');

  return fc.record({
    vehicleId: nonEmptyString,
    licensePlate: nonEmptyString,
    vehicleType: nonEmptyString,
    conditionCode: fc.constantFrom(...VALID_CONDITION_CODES),
    status,
    planResult: fc.constant(null),
    assignedOrders: fc.constant([]),
  });
}

/**
 * Generates an arbitrary FleetPlanResult by:
 * 1. Creating an array of VehiclePlanEntry with random statuses
 * 2. Computing the summary counts from the actual entries
 *
 * This simulates what generateFleetPlan would produce — the summary
 * must always be consistent with the vehicles array.
 */
function arbitraryFleetPlanResult(): fc.Arbitrary<FleetPlanResult> {
  return fc
    .array(arbitraryVehiclePlanEntry(), { minLength: 1, maxLength: 30 })
    .map((vehicles) => {
      // Compute counts from the vehicles array (mirrors generateFleetPlan logic)
      let successCount = 0;
      let partialCount = 0;
      let failedCount = 0;

      for (const v of vehicles) {
        switch (v.status) {
          case 'success':
            successCount++;
            break;
          case 'partial':
            partialCount++;
            break;
          case 'failed':
            failedCount++;
            break;
        }
      }

      const result: FleetPlanResult = {
        vehicles,
        unmatchedOrders: [],
        summary: {
          totalVehicles: vehicles.length,
          successCount,
          partialCount,
          failedCount,
          totalOrdersPlaced: 0,
          totalOrdersUnplaced: 0,
        },
      };

      return result;
    });
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Fleet Planner — Summary Count Consistency Property Tests', () => {
  // Feature: daily-fleet-load-planner, Property 10: Fleet summary counts are consistent
  // **Validates: Requirements 4.5**
  it('Property 10: successCount + partialCount + failedCount === totalVehicles === vehicles.length', () => {
    fc.assert(
      fc.property(arbitraryFleetPlanResult(), (result) => {
        const { summary, vehicles } = result;

        // Invariant 1: sum of status counts equals totalVehicles
        expect(summary.successCount + summary.partialCount + summary.failedCount).toBe(
          summary.totalVehicles,
        );

        // Invariant 2: totalVehicles equals the length of the vehicles array
        expect(summary.totalVehicles).toBe(vehicles.length);
      }),
      { numRuns: 100 },
    );
  });

  // Additional structural check: verify through generateFleetPlan directly
  // This tests the real implementation produces consistent summaries
  it('Property 10 (via generateFleetPlan): real fleet plan results maintain count consistency', async () => {
    // Dynamically mock generateLoadPlan to return different outcomes per vehicle
    const { generateFleetPlan } = await import('./fleet-planner');

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            vehicleId: fc.stringMatching(/^[A-Z]{2,4}[0-9]{2,4}$/).filter((s) => s.length > 0),
            licensePlate: fc.stringMatching(/^[A-Z0-9]{5,8}$/).filter((s) => s.length > 0),
            vehicleType: fc.constantFrom('Camión', 'Trailer', 'Grúa'),
            conditionCode: fc.constantFrom(...VALID_CONDITION_CODES),
            // Each vehicle gets 1-5 mock orders
            orderCount: fc.integer({ min: 1, max: 5 }),
            // Determine outcome: success (all placed), partial (some unplaced), or throw
            outcome: fc.constantFrom('success', 'partial', 'error'),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (vehicleSpecs) => {
          // Ensure unique IDs
          const seen = new Set<string>();
          const specs = vehicleSpecs.filter((v) => {
            if (seen.has(v.vehicleId)) return false;
            seen.add(v.vehicleId);
            return true;
          });
          if (specs.length === 0) return;

          // Mock generateLoadPlan at the module level
          const plannerModule = await import('@ptv-discovery-coach/shared');
          void plannerModule.generateLoadPlan;

          // Track which vehicle is being processed
          let callIndex = 0;

          vi.spyOn(plannerModule, 'generateLoadPlan').mockImplementation((request: any) => {
            const spec = specs[callIndex % specs.length];
            callIndex++;

            if (spec.outcome === 'error') {
              throw new Error('Simulated planning failure');
            }

            // Create mock placed/unplaced arrays
            const items = request.items || [];
            if (spec.outcome === 'partial' && items.length > 1) {
              return {
                placedFreight: [items[0]],
                unplacedItems: items.slice(1),
                trailer: request.trailer,
                totalWeight: 1000,
                weightCapacity: 50000,
                loadingInstructions: [],
              } as any;
            }

            // Success: all placed
            return {
              placedFreight: items,
              unplacedItems: [],
              trailer: request.trailer,
              totalWeight: 1000,
              weightCapacity: 50000,
              loadingInstructions: [],
            } as any;
          });

          try {
            // Build a FleetPlanRequest
            const fleetRequest = {
              vehicles: specs.map((spec) => ({
                vehicleId: spec.vehicleId,
                licensePlate: spec.licensePlate,
                vehicleType: spec.vehicleType,
                conditionCode: spec.conditionCode as ConditionCode,
                profile: {
                  trailer: { id: 'mock-trailer' } as any,
                  tractor: { id: 'mock-tractor' } as any,
                  equipment: { id: 'mock-equip' } as any,
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

            // Assert the structural invariant holds
            expect(
              result.summary.successCount + result.summary.partialCount + result.summary.failedCount,
            ).toBe(result.summary.totalVehicles);
            expect(result.summary.totalVehicles).toBe(result.vehicles.length);
          } finally {
            vi.restoreAllMocks();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
