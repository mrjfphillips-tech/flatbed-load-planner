// ─── Fleet Planning Module — Barrel Export ───────────────────────────────────
// Central entry point for the daily fleet load planning feature.

export type {
  ConditionCode,
  VehicleStatus,
  VehicleRecord,
  FleetFileValidationError,
  ResolvedVehicleProfile,
  ProfileResolutionError,
  ExtractionRule,
  UnmatchedOrder,
  VehiclePlanEntry,
  FleetPlanResult,
  FleetWizardStep,
} from './types';

export {
  FLEET_REQUIRED_FIELDS,
  FLEET_FIELD_ALIASES,
  autoMapFleetColumns,
} from './fleet-smart-mapper';

export {
  parseFleetFile,
  validateVehicleRecord,
} from './fleet-parser';
export type { FleetParseResult } from './fleet-parser';

export {
  CONDITION_CODE_MAP,
  resolveVehicleProfile,
  isProfileResolutionError,
  tonnesToLbs,
  metresToFeet,
  metresToInches,
} from './profile-resolver';

export { useFleetStore } from './fleet-store';
export type { FleetPlannerState } from './fleet-store';

export { matchDeliveryNumbers, groupOrdersByDeliveryNumber } from './delivery-matcher';
export type { MatchResult } from './delivery-matcher';

export { generateFleetPlan } from './fleet-planner';
export type { FleetPlanRequest, FleetPlanVehicle, FleetPlanProgressCallback } from './fleet-planner';

export { ModeSelector } from './ModeSelector';
export type { ModeSelectorProps } from './ModeSelector';

export { FleetWizardNav } from './FleetWizardNav';
export type { FleetWizardNavProps } from './FleetWizardNav';

export { FleetWizardShell } from './FleetWizardShell';
export type { FleetWizardShellProps } from './FleetWizardShell';

export { FleetFileUploadStep } from './steps/FleetFileUploadStep';
export { OrdersFileUploadStep } from './steps/OrdersFileUploadStep';

export { RulesReviewStep } from './steps/RulesReviewStep';

export { FleetGenerateStep } from './steps/FleetGenerateStep';

export { FleetSummaryDashboard } from './FleetSummaryDashboard';

export { VehiclePlanView } from './VehiclePlanView';
export type { VehiclePlanViewProps } from './VehiclePlanView';

export { isManifestFormat, parseManifestWorkbook } from './manifest-parser';
export type { ManifestParseResult } from './manifest-parser';
