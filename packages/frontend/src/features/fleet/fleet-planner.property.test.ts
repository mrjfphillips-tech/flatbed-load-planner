// ─── Property-Based Tests for Vehicle Plan Failure Isolation ─────────────────
// Feature: daily-fleet-load-planner
// Property 9: Vehicle plan independence (failure isolation)
// **Validates: Requirements 4.3**
//
// For any fleet plan request, if the planning engine fails for vehicle X (throws
// an error), all other vehicles' plan results should remain unaffected — their
// status and placed items should be identical to what they would be if vehicle X
// were not in the request.

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import type { ConditionCode } from './types';
import type { FleetPlanRequest } from './fleet-planner';

// ─── Mock Setup ──────────────────────────────────────────────────────────────

// Track which vehicleId should fail — set per property iteration
let failingVehicleId: string | null = null;

vi.mock('@ptv-discovery-coach/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ptv-discovery-coach/shared')>();
  return {
    ...actual,
    generateLoadPlan: (request: any) => {
      // Identify the vehicle by checking order numbers prefixed with vehicleId
      const firstItem = request.items?.[0];
      const orderNumber: string = firstItem?.orderNumber ?? '';

      if (failingVehicleId && orderNumber.startsWith(`ORD-${failingVehicleId}-`)) {
        throw new Error(`Simulated failure for vehicle ${failingVehicleId}`);
      }

      // Success: return all items as placed
      return {
        placedFreight: request.items || [],
        unplacedItems: [],
        trailer: request.trailer,
        totalWeight: 1000,
        weightCapacity: 50000,
        loadingInstructions: [],
      };
    },
  };
});

// ─── Custom Generators ───────────────────────────────────────────────────────

const VALID_CONDITION_CODES: ConditionCode[] = ['ZN', 'ZO', 'ZB', 'ZA', 'ZF'];

/**
 * Generates a fleet scenario: N vehicles (2-8) with one randomly chosen to fail.
 * Returns unique-ID vehicles and the index of the vehicle that should fail.
 */
function fleetWithFailureArb() {
  return fc
    .record({
      vehicleCount: fc.integer({ min: 2, max: 8 }),
      failIndexSeed: fc.nat(),
    })
    .chain(({ vehicleCount, failIndexSeed }) => {
      return fc
        .array(
          fc.record({
            licensePlate: fc.stringMatching(/^[A-Z][0-9]{3}[A-Z]{2}$/).filter((s) => s.length === 6),
            vehicleType: fc.constantFrom('Camión', 'Trailer', 'Grúa'),
            conditionCode: fc.constantFrom(...VALID_CONDITION_CODES),
            orderCount: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: vehicleCount, maxLength: vehicleCount },
        )
        .map((specs) => {
          // Assign deterministic unique IDs
          const vehicles = specs.map((spec, idx) => ({
            ...spec,
            vehicleId: `VH${String(idx).padStart(3, '0')}`,
          }));
          const failIndex = failIndexSeed % vehicles.length;
          return { vehicles, failIndex };
        });
    });
}

/**
 * Builds a FleetPlanRequest from the generated vehicle specs.
 */
function buildFleetRequest(
  vehicles: Array<{
    vehicleId: string;
    licensePlate: string;
    vehicleType: string;
    conditionCode: ConditionCode;
    orderCount: number;
  }>,
): FleetPlanRequest {
  return {
    vehicles: vehicles.map((spec) => ({
      vehicleId: spec.vehicleId,
      licensePlate: spec.licensePlate,
      vehicleType: spec.vehicleType,
      conditionCode: spec.conditionCode,
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
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Fleet Planner — Vehicle Plan Independence (Failure Isolation) Property Tests', () => {
  // Feature: daily-fleet-load-planner, Property 9: Vehicle plan independence (failure isolation)
  // **Validates: Requirements 4.3**
  it('Property 9: A failure for one vehicle does not affect other vehicles\' plan results', async () => {
    const { generateFleetPlan } = await import('./fleet-planner');

    await fc.assert(
      fc.asyncProperty(fleetWithFailureArb(), async ({ vehicles, failIndex }) => {
        // Set the vehicle that should fail for this iteration
        failingVehicleId = vehicles[failIndex].vehicleId;

        const request = buildFleetRequest(vehicles);
        const result = await generateFleetPlan(request);

        // Assert: the failing vehicle has status 'failed' with an error message
        const failedEntry = result.vehicles.find((v) => v.vehicleId === failingVehicleId);
        expect(failedEntry).toBeDefined();
        expect(failedEntry!.status).toBe('failed');
        expect(failedEntry!.error).toBeDefined();
        expect(failedEntry!.error!.length).toBeGreaterThan(0);

        // Assert: all other vehicles have status 'success' (mock returns all items placed)
        const otherEntries = result.vehicles.filter((v) => v.vehicleId !== failingVehicleId);
        for (const entry of otherEntries) {
          expect(entry.status).toBe('success');
          expect(entry.planResult).not.toBeNull();
          expect(entry.planResult!.placedFreight.length).toBeGreaterThan(0);
          expect(entry.planResult!.unplacedItems.length).toBe(0);
          expect(entry.error).toBeUndefined();
        }

        // Assert: result contains entries for ALL vehicles (none dropped due to failure)
        expect(result.vehicles.length).toBe(vehicles.length);

        // Reset for next iteration
        failingVehicleId = null;
      }),
      { numRuns: 100 },
    );
  });

  // Additional isolation check: non-failing vehicles preserve their assigned orders in results
  // **Validates: Requirements 4.3**
  it('Property 9: Non-failing vehicles preserve their exact assigned order set', async () => {
    const { generateFleetPlan } = await import('./fleet-planner');

    await fc.assert(
      fc.asyncProperty(fleetWithFailureArb(), async ({ vehicles, failIndex }) => {
        failingVehicleId = vehicles[failIndex].vehicleId;

        const request = buildFleetRequest(vehicles);
        const result = await generateFleetPlan(request);

        // Verify each non-failing vehicle preserves its assigned order set
        for (const spec of vehicles) {
          if (spec.vehicleId === failingVehicleId) continue;

          const entry = result.vehicles.find((v) => v.vehicleId === spec.vehicleId);
          expect(entry).toBeDefined();

          // The assigned orders should match what we passed in
          expect(entry!.assignedOrders.length).toBe(spec.orderCount);

          // Placed freight should contain the expected order numbers
          const placedOrderNumbers = entry!.planResult!.placedFreight.map(
            (f: any) => f.orderNumber,
          );
          for (let i = 0; i < spec.orderCount; i++) {
            expect(placedOrderNumbers).toContain(`ORD-${spec.vehicleId}-${i}`);
          }
        }

        failingVehicleId = null;
      }),
      { numRuns: 100 },
    );
  });
});


// ─── Property 10: Fleet summary counts are consistent ────────────────────────
// Feature: daily-fleet-load-planner
// **Validates: Requirements 4.5**

describe('Fleet Planner — Property 10: Fleet summary counts are consistent', () => {
  // **Validates: Requirements 4.5**

  it('Property 10: successCount + partialCount + failedCount === totalVehicles === vehicles.length (structural)', () => {
    // Generate arbitrary FleetPlanResult objects with random statuses,
    // compute the summary from the vehicles array, and verify invariants hold.
    const arbitraryVehiclePlanEntry = fc.record({
      vehicleId: fc.stringMatching(/^[A-Z]{2,4}[0-9]{2,4}$/).filter((s) => s.length > 0),
      licensePlate: fc.stringMatching(/^[A-Z0-9]{5,8}$/).filter((s) => s.length > 0),
      vehicleType: fc.constantFrom('Camión', 'Trailer', 'Grúa'),
      conditionCode: fc.constantFrom(...VALID_CONDITION_CODES),
      status: fc.constantFrom<'success' | 'partial' | 'failed'>('success', 'partial', 'failed'),
      planResult: fc.constant(null),
      assignedOrders: fc.constant([]),
    });

    const arbitraryFleetPlanResult = fc
      .array(arbitraryVehiclePlanEntry, { minLength: 1, maxLength: 30 })
      .map((vehicles) => {
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

        return {
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
      });

    fc.assert(
      fc.property(arbitraryFleetPlanResult, (result) => {
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

  it('Property 10: generateFleetPlan always produces consistent summary counts', async () => {
    // Tests the actual aggregation logic through generateFleetPlan
    // with a mocked planning engine that produces various outcomes.
    const { generateFleetPlan } = await import('./fleet-planner');
    const plannerModule = await import('@ptv-discovery-coach/shared');

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            vehicleId: fc.stringMatching(/^[A-Z]{2,4}[0-9]{2,4}$/).filter((s) => s.length > 0),
            licensePlate: fc.stringMatching(/^[A-Z0-9]{5,8}$/).filter((s) => s.length > 0),
            vehicleType: fc.constantFrom('Camión', 'Trailer', 'Grúa'),
            conditionCode: fc.constantFrom(...VALID_CONDITION_CODES),
            orderCount: fc.integer({ min: 1, max: 5 }),
            outcome: fc.constantFrom('success', 'partial', 'error'),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (vehicleSpecs) => {
          // Deduplicate vehicle IDs
          const seen = new Set<string>();
          const specs = vehicleSpecs.filter((v) => {
            if (seen.has(v.vehicleId)) return false;
            seen.add(v.vehicleId);
            return true;
          });
          if (specs.length === 0) return;

          let callIndex = 0;

          vi.spyOn(plannerModule, 'generateLoadPlan').mockImplementation((request: any) => {
            const spec = specs[callIndex % specs.length];
            callIndex++;

            if (spec.outcome === 'error') {
              throw new Error('Simulated planning failure');
            }

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

            // Success: all items placed
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
            const fleetRequest: FleetPlanRequest = {
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

            // Assert Property 10 invariants
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
