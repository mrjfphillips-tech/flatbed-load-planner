// ─── Fleet Planner Service ───────────────────────────────────────────────────
// Orchestrates batch plan generation for the daily fleet load planner.
// Invokes the existing generateLoadPlan() engine once per vehicle, aggregating
// results into a FleetPlanResult with summary statistics.
//
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5

import {
  generateLoadPlan,
  type PlanRequest,
  type PlanResult,
  type SteelOrderLineItem,
  type Rule,
} from '@ptv-discovery-coach/shared';

import type {
  ConditionCode,
  FleetPlanResult,
  ResolvedVehicleProfile,
  VehiclePlanEntry,
} from './types';

// ─── Fleet Plan Request ──────────────────────────────────────────────────────

/**
 * Input to the fleet planner service.
 * Each vehicle entry contains its resolved profile and assigned orders.
 */
export interface FleetPlanRequest {
  vehicles: FleetPlanVehicle[];
  rules: Rule[];
}

export interface FleetPlanVehicle {
  vehicleId: string;
  licensePlate: string;
  vehicleType: string;
  conditionCode: ConditionCode;
  profile: ResolvedVehicleProfile;
  orders: SteelOrderLineItem[];
}

// ─── Progress Callback ───────────────────────────────────────────────────────

/** Callback for reporting batch generation progress */
export type FleetPlanProgressCallback = (completed: number, total: number) => void;

// ─── Fleet Planner Service ───────────────────────────────────────────────────

/**
 * Generates load plans for all vehicles in the fleet request.
 *
 * Behavior:
 * - Filters out vehicles with zero assigned orders (they are skipped)
 * - Creates a PlanRequest per vehicle using the resolved profile and orders
 * - Invokes generateLoadPlan() sequentially per vehicle
 * - Catches per-vehicle failures, recording them as 'failed' entries
 * - Classifies each result as 'success', 'partial', or 'failed'
 * - Aggregates results into FleetPlanResult with summary statistics
 *
 * Each vehicle is processed independently — a failure on one vehicle does NOT
 * prevent plan generation for other vehicles (Req 4.3).
 *
 * @param request - Fleet plan request with vehicles and rules
 * @param onProgress - Optional callback reporting (completed, total) counts
 * @returns Aggregated fleet plan result with per-vehicle entries and summary
 */
export async function generateFleetPlan(
  request: FleetPlanRequest,
  onProgress?: FleetPlanProgressCallback
): Promise<FleetPlanResult> {
  // Filter vehicles that have at least one assigned order
  const vehiclesWithOrders = request.vehicles.filter(v => v.orders.length > 0);
  const total = vehiclesWithOrders.length;

  const entries: VehiclePlanEntry[] = [];
  let successCount = 0;
  let partialCount = 0;
  let failedCount = 0;
  let totalOrdersPlaced = 0;
  let totalOrdersUnplaced = 0;

  // Report initial progress
  onProgress?.(0, total);

  // Process each vehicle sequentially (independent failure isolation)
  for (let i = 0; i < vehiclesWithOrders.length; i++) {
    const vehicle = vehiclesWithOrders[i];

    const entry = await generateSingleVehiclePlan(vehicle, request.rules);
    entries.push(entry);

    // Update summary counters
    switch (entry.status) {
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

    // Count placed and unplaced orders
    if (entry.planResult) {
      totalOrdersPlaced += entry.planResult.placedFreight.length;
      totalOrdersUnplaced += entry.planResult.unplacedItems.length;
    } else {
      // If no plan result, all assigned orders are unplaced
      totalOrdersUnplaced += entry.assignedOrders.length;
    }

    // Report progress after each vehicle completes
    onProgress?.(i + 1, total);
  }

  return {
    vehicles: entries,
    unmatchedOrders: [], // Unmatched orders are handled upstream by delivery-matcher
    summary: {
      totalVehicles: total,
      successCount,
      partialCount,
      failedCount,
      totalOrdersPlaced,
      totalOrdersUnplaced,
    },
  };
}

// ─── Single Vehicle Plan Generation ──────────────────────────────────────────

/**
 * Generates a load plan for a single vehicle, wrapping any exceptions
 * as a 'failed' entry to ensure fault isolation (Req 4.3).
 */
async function generateSingleVehiclePlan(
  vehicle: FleetPlanVehicle,
  rules: Rule[]
): Promise<VehiclePlanEntry> {
  const baseEntry: Pick<VehiclePlanEntry, 'vehicleId' | 'licensePlate' | 'vehicleType' | 'conditionCode' | 'assignedOrders'> = {
    vehicleId: vehicle.vehicleId,
    licensePlate: vehicle.licensePlate,
    vehicleType: vehicle.vehicleType,
    conditionCode: vehicle.conditionCode,
    assignedOrders: vehicle.orders,
  };

  try {
    // Build PlanRequest from the resolved vehicle profile and assigned orders
    const planRequest: PlanRequest = {
      items: vehicle.orders,
      trailer: vehicle.profile.trailer,
      tractor: vehicle.profile.tractor,
      equipment: vehicle.profile.equipment,
      rules,
    };

    // Invoke the planning engine (synchronous, deterministic)
    // Using Promise.resolve to keep the async contract and allow future Web Worker migration
    const result: PlanResult = await Promise.resolve(generateLoadPlan(planRequest));

    // Classify the result status
    const status = classifyPlanStatus(result, vehicle.orders);

    return {
      ...baseEntry,
      status,
      planResult: result,
      error: status === 'failed' ? 'Planning engine produced no placements' : undefined,
    };
  } catch (error: unknown) {
    // Catch per-vehicle failures — record as 'failed' with error message (Req 4.3, 4.4)
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      ...baseEntry,
      status: 'failed',
      planResult: null,
      error: errorMessage,
    };
  }
}

// ─── Status Classification ───────────────────────────────────────────────────

/**
 * Classifies a plan result as 'success', 'partial', or 'failed'.
 *
 * - 'success': All items were placed successfully
 * - 'partial': Some items placed, some unplaced (Req 4.4)
 * - 'failed': No items were placed (planning engine failure or capacity exceeded)
 */
function classifyPlanStatus(
  result: PlanResult,
  assignedOrders: SteelOrderLineItem[]
): 'success' | 'partial' | 'failed' {
  if (result.placedFreight.length === 0 && assignedOrders.length > 0) {
    return 'failed';
  }

  if (result.unplacedItems.length > 0) {
    return 'partial';
  }

  return 'success';
}
