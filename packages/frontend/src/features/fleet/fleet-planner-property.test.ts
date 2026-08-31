// ─── Property-Based Tests for Vehicle Plan Failure Isolation ──────────────────
// Feature: daily-fleet-load-planner
// Property 9: Vehicle plan independence (failure isolation)
// **Validates: Requirements 4.3**
//
// For any fleet plan request, if the planning engine fails for vehicle X
// (throws an error), all other vehicles' plan results should remain unaffected —
// their status and placed items should be identical to what they would produce
// independently.

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import type { ConditionCode } from './types';

const VALID_CONDITION_CODES: ConditionCode[] = ['ZN', 'ZO', 'ZB', 'ZA', 'ZF'];

// ─── Custom Generators ───────────────────────────────────────────────────────

/** Generates a vehicle spec with a unique ID, orders, and an outcome marker */
function arbitraryVehicleSpec() {
  return fc.record({
    vehicleId: fc.stringMatching(/^[A-Z]{2,4}[0-9]{2,4}$/).filter((s) => s.length >= 4),
    licensePlate: fc.stringMatching(/^[A-Z0-9]{5,8}$/).filter((s) => s.length >= 5),
    vehicleType: fc.constantFrom('Camión', 'Trailer', 'Grúa'),
    conditionCode: fc.constantFrom(...VALID_CONDITION_CODES),
    orderCount: fc.integer({ min: 1, max: 5 }),
  });
}

/**
 * Generates a fleet of 2–8 vehicles, then picks one at random as the "failing" vehicle.
 * This ensures we always have at least one non-failing vehicle to verify isolation.
 */
function arbitraryFleetWithOneFailure() {
  return fc
    .array(arbitraryVehicleSpec(), { minLength: 2, maxLength: 8 })
    .chain((specs) => {
      // Deduplicate by vehicleId
      const seen = new Set<string>();
      const unique = specs.filter((v) => {
        if (seen.has(v.vehicleId)) return false;
        seen.add(v.vehicleId);
        return true;
      });
      // Need at least 2 unique vehicles
      if (unique.length < 2) {
        return fc.constant(null);
      }
      // Pick a random index for the failing vehicle
      return fc.integer({ min: 0, max: unique.length - 1 }).map((failIdx) => ({
        vehicles: unique,
        failingIndex: failIdx,
      }));
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Fleet Planner — Vehicle Plan Failure Isolation Property Tests', () => {
  // Feature: daily-fleet-load-planner, Property 9: Vehicle plan independence (failure isolation)
  // **Validates: Requirements 4.3**
  it('Property 9: A failure on one vehicle does not affect other vehicles\' plan results', async () => {
    const { generateFleetPlan } = await import('./fleet-planner');
    const plannerModule = await import('@ptv-discovery-coach/shared');

    await fc.assert(
      fc.asyncProperty(arbitraryFleetWithOneFailure(), async ({ vehicles, failingIndex }) => {
        const failingVehicleId = vehicles[failingIndex].vehicleId;

        // Track call order to map each generateLoadPlan invocation to a vehicle
        let callIndex = 0;

        vi.spyOn(plannerModule, 'generateLoadPlan').mockImplementation((request: any) => {
          const currentIdx = callIndex;
          callIndex++;

          // The vehicle at failingIndex should throw
          if (currentIdx === failingIndex) {
            throw new Error(`Simulated failure for vehicle ${failingVehicleId}`);
          }

          // All other vehicles succeed with all items placed
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
          // Build the fleet plan request
          const fleetRequest = {
            vehicles: vehicles.map((spec) => ({
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

          // ─── Assertions ──────────────────────────────────────────────

          // Result should have an entry for every vehicle
          expect(result.vehicles.length).toBe(vehicles.length);

          for (let i = 0; i < result.vehicles.length; i++) {
            const entry = result.vehicles[i];

            if (i === failingIndex) {
              // The failing vehicle should have status 'failed' with an error message
              expect(entry.status).toBe('failed');
              expect(entry.error).toBeDefined();
              expect(entry.error!.length).toBeGreaterThan(0);
              expect(entry.planResult).toBeNull();
            } else {
              // All other vehicles should be unaffected — successful plan
              expect(entry.status).toBe('success');
              expect(entry.planResult).not.toBeNull();
              expect(entry.planResult!.placedFreight.length).toBe(vehicles[i].orderCount);
              expect(entry.planResult!.unplacedItems.length).toBe(0);
              // Verify vehicle identity is preserved
              expect(entry.vehicleId).toBe(vehicles[i].vehicleId);
              expect(entry.licensePlate).toBe(vehicles[i].licensePlate);
              expect(entry.vehicleType).toBe(vehicles[i].vehicleType);
            }
          }
        } finally {
          vi.restoreAllMocks();
        }
      }),
      { numRuns: 100, timeout: 30000 },
    );
  }, 60000);
});
