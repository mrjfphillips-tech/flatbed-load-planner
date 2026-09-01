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
}

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
  errors: ValidationError[];
  summary: {
    totalItems: number;
    /** Total weight in canonical kg. */
    totalWeight: number;
    /** Total volume in canonical cubic mm. */
    totalVolume: number;
  };
}

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
