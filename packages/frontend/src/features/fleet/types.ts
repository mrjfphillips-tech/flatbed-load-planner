// ─── Fleet Planning Types ────────────────────────────────────────────────────
// Shared interfaces for the daily fleet load planning feature.
// All interfaces are additive; the existing planning engine types remain unchanged.

import type {
  SteelOrderLineItem,
  TrailerProfile,
  TractorProfile,
  EquipmentCombination,
  PlanResult,
} from '@ptv-discovery-coach/shared';

// ─── Fleet File Types ────────────────────────────────────────────────────────

/**
 * Classification code for a vehicle's zone/weight class.
 * Used to resolve vehicle profiles from the Peru regional presets catalog.
 */
export type ConditionCode = 'ZN' | 'ZO' | 'ZB' | 'ZA' | 'ZF';

/**
 * Vehicle availability status in the fleet manifest.
 * - 'active': available for planning today
 * - 'idle': on the master list but not available (maintenance, off-duty, etc.)
 */
export type VehicleStatus = 'active' | 'idle';

/**
 * A single row from the fleet manifest file, representing one vehicle.
 * All numeric values use metric units (tonnes for weight, metres for dimensions).
 */
export interface VehicleRecord {
  vehicleId: string;
  vehicleType: string;
  licensePlate: string;
  weightCapacity: number;    // tonnes
  platformLength: number;    // metres
  platformWidth: number;     // metres
  conditionCode: ConditionCode;
  status: VehicleStatus;     // 'active' = plan, 'idle' = skip
}

/** A per-row validation error from fleet file parsing */
export interface FleetFileValidationError {
  row: number;    // 1-based row index
  field: string;  // field name that failed validation
  value: unknown; // the invalid value provided
  message: string; // plain-language description of the problem
}

// ─── Profile Resolution Types ────────────────────────────────────────────────

/**
 * Resolved equipment profile for a vehicle, produced by mapping condition code
 * to a regional preset and applying fleet-file overrides for weight/dimensions.
 */
export interface ResolvedVehicleProfile {
  trailer: TrailerProfile;
  tractor: TractorProfile;
  equipment: EquipmentCombination;
}

/** Error produced when a vehicle cannot be resolved to a preset */
export interface ProfileResolutionError {
  vehicleId: string;
  reason: string;
}

// ─── Delivery Number Matching Types ──────────────────────────────────────────

/**
 * Custom rule for extracting a vehicle ID from a delivery number.
 * Supports substring (character positions), delimiter split (field index),
 * and regex (capture group) extraction strategies.
 */
export interface ExtractionRule {
  type: 'substring' | 'delimiter' | 'regex';
  /** Start character position (inclusive, 0-based) — used with type 'substring' */
  startPosition?: number;
  /** End character position (exclusive) — used with type 'substring' */
  endPosition?: number;
  /** Delimiter character — used with type 'delimiter' */
  delimiter?: string;
  /** Zero-based field index after split — used with type 'delimiter' */
  fieldIndex?: number;
  /** Regex pattern string — used with type 'regex' */
  pattern?: string;
  /** Capture group index (1-based) — used with type 'regex' */
  captureGroup?: number;
}

/** An order that could not be matched to any vehicle in the fleet */
export interface UnmatchedOrder {
  orderNumber: string;
  deliveryNumber: string;
  reason: 'no_vehicle_match' | 'ambiguous_match';
}

// ─── Fleet Plan Result Types ─────────────────────────────────────────────────

/**
 * One entry in the fleet plan result, representing the outcome
 * of planning for a single vehicle.
 */
export interface VehiclePlanEntry {
  vehicleId: string;
  licensePlate: string;
  vehicleType: string;
  conditionCode: ConditionCode;
  status: 'success' | 'partial' | 'failed' | 'pending';
  planResult: PlanResult | null;
  assignedOrders: SteelOrderLineItem[];
  error?: string;
}

/**
 * Aggregate output of the fleet planner: one result per vehicle
 * plus summary statistics and any unmatched orders.
 */
export interface FleetPlanResult {
  vehicles: VehiclePlanEntry[];
  unmatchedOrders: UnmatchedOrder[];
  summary: {
    totalVehicles: number;
    successCount: number;
    partialCount: number;
    failedCount: number;
    totalOrdersPlaced: number;
    totalOrdersUnplaced: number;
  };
}

// ─── Fleet Wizard Types ──────────────────────────────────────────────────────

/** Steps in the fleet planning wizard flow */
export type FleetWizardStep = 1 | 2 | 3 | 4;
