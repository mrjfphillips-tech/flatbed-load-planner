// ─── Load Diagram Generator — Barrel Export ──────────────────────────────────
// Re-exports all load-diagram-generator types and utilities from a single
// entry point.

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  UnitSystem,
  TrailerType,
  DoorConfig,
  TrailerProfile,
  LoadItem,
  ItemOrientation,
  PlacedItem,
  LoadPlanStatus,
  LoadPlan,
  PackingResult,
  PackingWarningType,
  PackingWarning,
  ValidationError,
  ExcelParseResult,
  ConstraintViolationType,
  ConstraintViolation,
  DiagramExportOptions,
  FleetVehicle,
  Fleet,
  FleetVehicleParseResult,
} from './types';
export { DEFAULT_OPEN_PLATFORM_HEIGHT_MM, OPEN_TRAILER_TYPES } from './types';

// ─── Suggested Cargo Height ─────────────────────────────────────────────────────
export { suggestedCargoHeight } from './suggested-height';
export type { SuggestedHeightOptions, SuggestedHeightResult } from './suggested-height';

// ─── Rules Configuration ────────────────────────────────────────────────────────
export {
  DEFAULT_RULES_CONFIG,
  resolveRulesConfig,
  classCanCarry,
} from './rules-config';
export type {
  RulesConfig,
  UnloadMode,
  RuleSeverity,
  StackCompatibilityMatrix,
} from './rules-config';

// ─── Rules Engine ────────────────────────────────────────────────────────────
export {
  validate,
  assertValid,
  LoadRulesError,
  ruleCanonicalUnits,
  rulePlacementCompleteness,
  ruleVehicleEnvelope,
  ruleNoOverlap,
  ruleSupportContinuity,
  ruleFloorOnly,
  ruleMaxStackWeight,
  ruleStackClassCompatibility,
  ruleAxleAndCog,
} from './rules';
export type { RuleViolation, RuleCode, RulePlan, ValidationResult } from './rules';

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
  FLEET_UNIT_INDEPENDENT_COLUMNS,
  FLEET_METRIC_COLUMNS,
  FLEET_IMPERIAL_COLUMNS,
  FLEET_DIMENSION_COLUMN_MAP,
} from './constants';
export type { StackabilityClass } from './constants';

// ─── Packing Engine ────────────────────────────────────────────────────────────
export { computeLoadPlan, computeAndValidate, calculateAxleWeights, generateWarnings } from './packing-engine';
export type { PackingConstraints } from './packing-engine';

// ─── Constraint Validator ──────────────────────────────────────────────────────
export {
  validateAllConstraints,
  validateSinglePlacement,
} from './constraint-validator';
export type { StackabilityMatrix } from './constraint-validator';

// ─── Fleet Column Mapping & Flexible Units ──────────────────────────────────────
export {
  fleetLengthToCanonical,
  fleetWeightToCanonical,
  FLEET_LENGTH_UNITS,
  FLEET_WEIGHT_UNITS,
  FLEET_REQUIRED_FIELDS,
  FLEET_ALL_FIELDS,
  FLEET_FIELD_LABELS,
  autoMapFleetColumns,
  guessUnitsFromSamples,
  normalizeTrailerType,
} from './fleet-mapping';
export type {
  FleetLengthUnit,
  FleetWeightUnit,
  FleetField,
  FleetColumnMapping,
  GuessedUnits,
} from './fleet-mapping';
