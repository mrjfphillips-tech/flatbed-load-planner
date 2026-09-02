// ─── Load Diagram Generator — Shared Types ───────────────────────────────────
// Feature: load-diagram-generator
//
// Canonical internal units are ALWAYS millimeters (length) and kilograms
// (weight). The UnitSystem is a property of input (Excel/UI entry) and output
// (display/export) only — never of computation or storage.
// _Requirements: 2.1, 2.2, 9.2, 10.1_

// ─── Unit System ─────────────────────────────────────────────────────────────

/** The system of measurement used for entering and displaying values. */
export type UnitSystem = 'metric' | 'imperial';

// ─── Trailer Configuration ───────────────────────────────────────────────────

/**
 * The kind of vehicle/trailer, which drives packing rules:
 * - `flatbed`      — open deck, no roof or sides; keep items flat/long lying down,
 *                    height is a soft cap (flag, not a wall).
 * - `curtainsider` — flatbed-like packing with soft sides; same soft-height behavior.
 * - `enclosed`     — box/van; the roof is a hard height ceiling and vertical
 *                    stacking is expected.
 */
export type TrailerType = 'flatbed' | 'curtainsider' | 'enclosed';

/** Trailer types whose height is a soft, advisory cap rather than a hard wall. */
export const OPEN_TRAILER_TYPES: TrailerType[] = ['flatbed', 'curtainsider'];

/** Loading door configuration for a trailer. */
export interface DoorConfig {
  rear: boolean;
  sideLeft: boolean;
  sideRight: boolean;
  /** Distance from the front of the trailer, in canonical mm. */
  sideLeftPosition?: number;
  sideRightPosition?: number;
}

/** A trailer profile. All dimensions/weights are stored in canonical mm/kg. */
export interface TrailerProfile {
  id: string;
  name: string;
  /** Internal length in canonical mm. */
  internalLength: number;
  /** Internal width in canonical mm. */
  internalWidth: number;
  /** Internal height in canonical mm. */
  internalHeight: number;
  /** Maximum payload weight in canonical kg. */
  maxPayloadWeight: number;
  axleCount: number;
  /** Weight limit per axle, in canonical kg. */
  axleWeightLimits: number[];
  /** Preferred display units for this profile. */
  displayUnitSystem: UnitSystem;
  /** Vehicle type driving packing rules (defaults to flatbed for open decks). */
  trailerType: TrailerType;
  /** How the vehicle is unloaded (side crane vs. rear doors). Optional; the
   *  LIFO rule uses it when present and defaults to the config unloadMode. */
  unloadMode?: 'side' | 'rear';
  /** Whether the vehicle supports multiple temperature compartments. */
  multiTemp?: boolean;
  doorConfig: DoorConfig;
  isTemplate: boolean;
}

// ─── Load Items ──────────────────────────────────────────────────────────────

/** A single physical unit to be loaded. Dimensions/weights in canonical mm/kg. */
export interface LoadItem {
  id: string;
  /** Item identifier from the source Excel file. */
  itemId: string;
  description?: string;
  /** Length in canonical mm. */
  length: number;
  /** Width in canonical mm. */
  width: number;
  /** Height in canonical mm. */
  height: number;
  /** Weight in canonical kg. */
  weight: number;
  quantity: number;
  stackabilityClass?: string;
  /** Maximum weight allowed on top, in canonical kg. */
  maxStackWeight?: number;
  deliveryStop?: number;
  temperatureZone?: string;
  floorOnly: boolean;
  topLoadProhibited: boolean;
  // ── Optional operational metadata (drive metadata-dependent rules; each rule
  //    is gated on its field being present and fails closed on partial data) ──
  /** OptiFlow plan layer code, e.g. "P0_L3" — authoritative stacking order. */
  planLayer?: string;
  /** Side hint for lateral placement. */
  loadSide?: LoadSide;
  /** Whether the item may be rotated 90° in plan (opt-in; default false). */
  rotatable?: boolean;
  /** Trip identifier — one trip per load (a second lap is a separate load). */
  trip?: string;
}

/** Lateral placement hint for the LOAD_SIDE rule. */
export type LoadSide = 'left' | 'right' | 'centre_full_width';

/** The six axis-aligned orientations an item may be rotated into. */
export type ItemOrientation = 'LWH' | 'WLH' | 'LHW' | 'WHL' | 'HLW' | 'HWL';

/** A load item that has been assigned a placement within the trailer. */
export interface PlacedItem extends LoadItem {
  /** Placement origin (front-left-floor corner), in canonical mm. */
  placedX: number;
  placedY: number;
  placedZ: number;
  placedOrientation: ItemOrientation;
  /** Physical loading order (1 = loaded first). */
  loadSequence: number;
}

// ─── Load Plan ───────────────────────────────────────────────────────────────

export type LoadPlanStatus = 'draft' | 'computed' | 'reviewed' | 'finalized';

/** A computed loading plan for a single trailer. */
export interface LoadPlan {
  id: string;
  trailerProfile: TrailerProfile;
  items: PlacedItem[];
  /** Total placed weight in canonical kg. */
  totalWeight: number;
  volumeUtilization: number;
  /** Computed weight per axle, in canonical kg. */
  axleWeights: number[];
  /** Unit system the source data was uploaded in. */
  sourceUnitSystem: UnitSystem;
  /** Unit system used for display and export. */
  displayUnitSystem: UnitSystem;
  status: LoadPlanStatus;
  /** Items that could not be placed within the trailer. */
  overflowItems?: LoadItem[];
  /** Advisory warnings about unusual placements. */
  warnings?: PackingWarning[];
  /** Full rules-engine result (errors + warnings) for the UI to surface. */
  ruleValidation?: import('./rules').ValidationResult;
}

/** The kind of advisory packing warning (review-worthy, not a hard failure). */
export type PackingWarningType =
  | 'flat_item_on_edge' // a flat/sheet-like item stood on its edge
  | 'long_item_upright' // a long item stood vertically instead of lengthwise
  | 'exceeds_suggested_height'; // a stack is taller than the suggested cap

/** An advisory warning attached to a placed item — flags unusual practice. */
export interface PackingWarning {
  type: PackingWarningType;
  message: string;
  /** The `id` of the affected placed item. */
  itemId: string;
}

/** The raw result of a packing computation. */
export interface PackingResult {
  placedItems: PlacedItem[];
  overflowItems: LoadItem[];
  volumeUtilization: number;
  /** Total placed weight in canonical kg. */
  totalWeight: number;
  /** Computed weight per axle, in canonical kg. */
  axleWeights: number[];
  /** Advisory warnings about unusual placements (never block the plan). */
  warnings: PackingWarning[];
  /**
   * Items that could not be placed, reported as infeasible (never hidden or
   * resized). Mirrors overflowItems with an explicit feasibility flag/reason.
   */
  unplaced?: { item: LoadItem; feasible: false; reason: string }[];
  computeTimeMs: number;
}

// ─── Excel Parsing ───────────────────────────────────────────────────────────

/** A row/column-level validation error from Excel parsing. */
export interface ValidationError {
  row: number;
  column: string;
  message: string;
  value?: string;
}

/** The result of parsing an uploaded Excel file. */
export interface ExcelParseResult {
  /** Parsed items with dimensions/weights converted to canonical mm/kg. */
  items: LoadItem[];
  /** Unit system detected from the uploaded file. */
  detectedUnitSystem: UnitSystem;
  /**
   * Vehicle identifier read from an optional Vehicle_ID column, when the sheet
   * consistently names one vehicle. Used to auto-assign a fleet vehicle.
   */
  detectedVehicleId?: string;
  errors: ValidationError[];
  summary: {
    totalItems: number;
    /** Total weight in canonical kg. */
    totalWeight: number;
    /** Total volume in canonical cubic mm. */
    totalVolume: number;
  };
}

// ─── Fleet & Vehicles ────────────────────────────────────────────────────────

/**
 * A single fleet vehicle. Dimensions/weights are stored in canonical mm/kg;
 * cost fields are plain numbers (currency-agnostic) and all optional. Vehicles
 * can be created by Excel upload or built manually with the same fields.
 */
export interface FleetVehicle {
  id: string;
  /** Business identifier from the source data (e.g. unit number). */
  vehicleId: string;
  vehicleName: string;
  /** Vehicle type — the source of truth that drives packing rules. */
  trailerType: TrailerType;
  /** Optional owning account / customer reference. */
  vehicleAccount?: string;
  licensePlate?: string;
  /** Maximum payload weight in canonical kg. */
  maxWeight: number;
  /** Platform (deck) length in canonical mm. */
  platformLength: number;
  /** Platform (deck) width in canonical mm. */
  platformWidth: number;
  /**
   * Optional platform / load height limit in canonical mm. When absent the
   * vehicle is treated as an open flatbed with a large default height bound.
   */
  platformHeight?: number;
  // ── Optional cost attributes (currency-agnostic) ──
  costPerStop?: number;
  fixedCost?: number;
  costPerHour?: number;
  costPerKm?: number;
}

/** A named collection of fleet vehicles (e.g. "Customer Fleet"). */
export interface Fleet {
  id: string;
  name: string;
  /** Preferred display units for this fleet. */
  displayUnitSystem: UnitSystem;
  vehicles: FleetVehicle[];
}

/** The result of parsing a fleet vehicle Excel file. */
export interface FleetVehicleParseResult {
  vehicles: FleetVehicle[];
  /** Unit system detected from the uploaded file. */
  detectedUnitSystem: UnitSystem;
  errors: ValidationError[];
  summary: {
    totalVehicles: number;
    /** Sum of vehicle max weights, in canonical kg. */
    totalMaxWeight: number;
  };
}

/** Default platform height (mm) used for open flatbeds when none is provided. */
export const DEFAULT_OPEN_PLATFORM_HEIGHT_MM = 4000;

// ─── Constraint Validation ───────────────────────────────────────────────────

/** The kind of constraint that was violated. */
export type ConstraintViolationType =
  | 'out_of_bounds'
  | 'overlap'
  | 'floor_only'
  | 'unsupported'
  | 'top_load_prohibited'
  | 'stackability_class'
  | 'max_stack_weight'
  | 'temperature_zone'
  | 'axle_weight_limit'
  | 'max_payload';

/** A single constraint violation, referencing the affected item(s). */
export interface ConstraintViolation {
  type: ConstraintViolationType;
  /** Human-readable description of the conflict. */
  message: string;
  /** The `id` of the item whose placement caused the violation. */
  itemId: string;
  /** `id`s of other items involved in the conflict (e.g. the item below). */
  relatedItemIds?: string[];
  /** For axle violations, the axle index (0-based). */
  axleIndex?: number;
}

// ─── Diagram Export ──────────────────────────────────────────────────────────

/** Options controlling PDF/diagram export. */
export interface DiagramExportOptions {
  format: 'pdf' | 'png';
  paperSize: 'A3' | 'A4';
  /** Unit system for all dimensions/weights rendered in the export. */
  unitSystem: UnitSystem;
  includeChecklist: boolean;
  includeSummary: boolean;
  views: ('topDown' | 'sideView' | 'rearView')[];
}
