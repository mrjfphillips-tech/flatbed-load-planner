// ─── Load Diagram Generator — Barrel Export ──────────────────────────────────
// Re-exports all load-diagram-generator types and utilities from a single
// entry point.

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  UnitSystem,
  DoorConfig,
  TrailerProfile,
  LoadItem,
  ItemOrientation,
  PlacedItem,
  LoadPlanStatus,
  LoadPlan,
  PackingResult,
  ValidationError,
  ExcelParseResult,
  ConstraintViolationType,
  ConstraintViolation,
  DiagramExportOptions,
} from './types';

// ─── Unit Conversion & Formatting ────────────────────────────────────────────
export {
  MM_PER_INCH,
  KG_PER_POUND,
  lengthFromCanonical,
  lengthToCanonical,
  weightFromCanonical,
  weightToCanonical,
  lengthUnitLabel,
  weightUnitLabel,
  formatLength,
  formatWeight,
} from './units';

// ─── Constants ─────────────────────────────────────────────────────────────────
export {
  UNIT_INDEPENDENT_COLUMNS,
  METRIC_DIMENSION_COLUMNS,
  IMPERIAL_DIMENSION_COLUMNS,
  EXCEL_DIMENSION_COLUMN_MAP,
  DEFAULT_STACKABILITY_CLASSES,
  TRAILER_TEMPLATES,
} from './constants';
export type { StackabilityClass } from './constants';

// ─── Packing Engine ────────────────────────────────────────────────────────────
export { computeLoadPlan, calculateAxleWeights } from './packing-engine';
export type { PackingConstraints } from './packing-engine';

// ─── Constraint Validator ──────────────────────────────────────────────────────
export {
  validateAllConstraints,
  validateSinglePlacement,
} from './constraint-validator';
export type { StackabilityMatrix } from './constraint-validator';
