// ─── OptiFlow Flatbed Steel Load Planner — Barrel Export ─────────────────────
// Re-exports all flatbed load planner types from a single entry point.

export type {
  // Primitive geometry
  Position2D,
  Position3D,
  FreightDimensions,

  // Enums and union types
  AxleGroup,
  LoadPattern,
  RuleType,
  HandlingMethod,
  StackPermission,
  Orientation,
  OrientationRequirement,
  DeckMaterial,
  SupportMethod,

  // Steel product types
  SteelProductType,

  // Geometric modeling
  GeometricType,
  FreightGeometry,

  // Equipment
  TrailerProfile,
  TractorProfile,
  EquipmentCombination,

  // Steel orders
  SteelOrderLineItem,

  // Placement
  PlacedFreight,
} from './types';

// ─── Equipment Validation ────────────────────────────────────────────────────
export type { ValidationResult } from './equipment';
export {
  validateTrailerProfile,
  validateTractorProfile,
  calculateEquipmentCombination,
  isPayloadValid,
} from './equipment';

// ─── Geometric Modeler ───────────────────────────────────────────────────────
export {
  assignGeometricType,
  calculateContactFootprint,
  calculateDeckPressure,
  calculateCradleAngle,
  calculateChockDimensions,
} from './geometry';

// ─── Weight Calculator ───────────────────────────────────────────────────────
export type { WeightMetrics } from './weight';
export {
  calculateAxleLoads,
  calculateWeightMetrics,
  calculateConcentratedLoad,
  calculateAxleUtilization,
} from './weight';

// ─── Rules Engine ────────────────────────────────────────────────────────────
export type { Rule, RuleContext, RuleResult, RuleEvaluationResult } from './rules';
export {
  evaluateAllRules,
  defaultRules,
  axleOverweightRule,
  grossWeightRule,
  concentratedLoadRule,
  stopOrderAccessibilityRule,
  antiRollSecurementRule,
  boundaryViolationRule,
  heavierItemsLowerRule,
  cgPositionRule,
  lateralImbalanceRule,
  dissimilarMetalsDunnageRule,
} from './rules';

// ─── Securement Planner ─────────────────────────────────────────────────────
export type {
  SecurementType,
  TieDown,
  SecurementPlan,
  SecurementAssignment,
} from './securement';
export {
  CHAIN_WLL,
  STRAP_WLL,
  calculateMinTieDowns,
  calculateRequiredWLL,
  recommendPrimarySecurement,
  recommendAdditionalSecurement,
  isCoilProduct,
  generateCoilSecurementNotes,
  generateItemSecurementPlan,
  assignAnchorPoints,
  assignSecurement,
} from './securement';

// ─── Rule Management ─────────────────────────────────────────────────────────
export type {
  CustomRule,
  RuleClassificationChange,
  RuleSummary,
  RuleSet,
  CreateCustomRuleParams,
} from './rule-management';
export {
  createRuleSet,
  createCustomRule,
  removeCustomRule,
  updateRuleClassification,
  getRuleSummary,
  acknowledgeRules,
  getAllRules,
} from './rule-management';

// ─── Planning Engine ─────────────────────────────────────────────────────────
export type { PlanRequest, PlanResult } from './planner';
export { generateLoadPlan, detectLoadPattern } from './planner';

// ─── Multi-Load Splitting ────────────────────────────────────────────────────
export type {
  UnplaceableReason,
  TrailerAssignment,
  MultiLoadSummary,
  MultiLoadResult,
} from './multi-load';
export {
  detectCapacityExceedance,
  groupItemsByStop,
  splitFreightAcrossTrailers,
  generateMultiLoadPlan,
} from './multi-load';

// ─── Multi-Load Manual Reassignment ─────────────────────────────────────────
export type {
  TrailerLoadState,
  MultiLoadSetState,
  ReassignmentResult,
  ReassignmentAction,
} from './multi-load-reassignment';
export {
  findItemTrailer,
  reassignItem,
  batchReassignItems,
  buildMultiLoadSummaryFromState,
} from './multi-load-reassignment';

// ─── Stacking & Support Rules ────────────────────────────────────────────────
export type {
  StackingRuleViolation,
  SupportPoint,
  LongProductSupport,
  EdgeProtection,
  DunnageInsertion,
  StackingRuleEvaluation,
} from './stacking-rules';
export {
  enforceNoStackRule,
  canPlaceAbove,
  enforceMaxStackWeight,
  enforceMaxStackHeight,
  isStackingWithinLimits,
  enforceCoilAntiRoll,
  requiresAntiRollSecurement,
  requiresDunnageBetween,
  enforceDissimilarHardnessDunnage,
  isLongProduct,
  calculateLongProductSupport,
  enforceLongProductSupport,
  requiresEdgeProtection,
  calculateEdgeProtection,
  enforcePlateEdgeProtection,
  evaluateStackingRules,
  DEFAULT_MAX_UNSUPPORTED_SPAN,
  MIN_SUPPORT_POINTS,
  STANDARD_DUNNAGE_THICKNESS,
  LEGAL_MAX_STACK_HEIGHT,
} from './stacking-rules';

// ─── Loading & Unloading Instructions ────────────────────────────────────────
export type {
  LoadingStep,
  UnloadingInstruction,
  InstructionView,
  FormattedInstructions,
} from './instructions';
export {
  generateLoadingSequence,
  generateUnloadingInstructions,
  formatInstructions,
} from './instructions';

// ─── Stop-Order Accessibility ────────────────────────────────────────────────
export type {
  UnloadingMethod,
  AccessibilityConflict,
  AccessibilityResult,
  StopUnloadingConfig,
} from './accessibility';
export {
  handlingToUnloadingMethod,
  validateDeliveryStopAssignments,
  validateCraneAccess,
  validateSideAccess,
  validateRearAccess,
  validateStopOrderAccessibility,
} from './accessibility';

// ─── Handling Defaults (Soft Constraints) ────────────────────────────────────
export type { HandlingDefault } from './handling-defaults';
export {
  HANDLING_DEFAULTS,
  getHandlingDefault,
  getMaxStackWeightLbs,
  applyHandlingDefaults,
} from './handling-defaults';
