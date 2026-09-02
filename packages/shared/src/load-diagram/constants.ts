// ─── Load Diagram Generator — Constants ──────────────────────────────────────
// Feature: load-diagram-generator
//
// Excel column definitions (metric + imperial variants), default stackability
// classes, and pre-configured trailer templates for European and North
// American trailer types. All template dimensions are stored in canonical
// mm/kg; `displayUnitSystem` records the native display units.
// _Requirements: 2.2, 9.2, 10.1, 10.2_

import type { TrailerProfile, UnitSystem } from './types';
import { MM_PER_INCH, KG_PER_POUND } from './units';

// ─── Excel Column Definitions ────────────────────────────────────────────────

/** Columns that are independent of the unit system. */
export const UNIT_INDEPENDENT_COLUMNS = [
  'Item_ID',
  'Description',
  'Quantity',
  'Stackability_Class',
  'Delivery_Stop',
  'Temperature_Zone',
  'Floor_Only_Flag',
  // Optional: if present, identifies the fleet vehicle this load is for, so the
  // matching vehicle can be auto-assigned after upload.
  'Vehicle_ID',
] as const;

/** Metric dimension/weight columns. */
export const METRIC_DIMENSION_COLUMNS = [
  'Length_mm',
  'Width_mm',
  'Height_mm',
  'Weight_kg',
  'Max_Stack_Weight_kg',
] as const;

/** Imperial dimension/weight columns. */
export const IMPERIAL_DIMENSION_COLUMNS = [
  'Length_in',
  'Width_in',
  'Height_in',
  'Weight_lb',
  'Max_Stack_Weight_lb',
] as const;

/**
 * Maps a logical field to its Excel column name in each unit system. Used by
 * the Excel parser to locate columns and by the template generator to emit
 * headers.
 */
export const EXCEL_DIMENSION_COLUMN_MAP: Record<
  UnitSystem,
  { length: string; width: string; height: string; weight: string; maxStackWeight: string }
> = {
  metric: {
    length: 'Length_mm',
    width: 'Width_mm',
    height: 'Height_mm',
    weight: 'Weight_kg',
    maxStackWeight: 'Max_Stack_Weight_kg',
  },
  imperial: {
    length: 'Length_in',
    width: 'Width_in',
    height: 'Height_in',
    weight: 'Weight_lb',
    maxStackWeight: 'Max_Stack_Weight_lb',
  },
};

// ─── Fleet Vehicle Excel Columns ─────────────────────────────────────────────

/** Fleet columns that are independent of the unit system. */
export const FLEET_UNIT_INDEPENDENT_COLUMNS = [
  'Vehicle_ID',
  'Vehicle_Name',
  'Vehicle_Account',
  'License_Plate',
  'Cost_Per_Stop',
  'Fixed_Cost',
  'Cost_Per_Hour',
  'Cost_Per_Km',
] as const;

/** Fleet metric dimension/weight columns. */
export const FLEET_METRIC_COLUMNS = [
  'Max_Weight_kg',
  'Platform_Length_mm',
  'Platform_Width_mm',
  'Platform_Height_mm',
] as const;

/** Fleet imperial dimension/weight columns. */
export const FLEET_IMPERIAL_COLUMNS = [
  'Max_Weight_lb',
  'Platform_Length_in',
  'Platform_Width_in',
  'Platform_Height_in',
] as const;

/**
 * Maps a logical fleet field to its Excel column name in each unit system.
 * Used by the fleet parser and template generator.
 */
export const FLEET_DIMENSION_COLUMN_MAP: Record<
  UnitSystem,
  { maxWeight: string; platformLength: string; platformWidth: string; platformHeight: string }
> = {
  metric: {
    maxWeight: 'Max_Weight_kg',
    platformLength: 'Platform_Length_mm',
    platformWidth: 'Platform_Width_mm',
    platformHeight: 'Platform_Height_mm',
  },
  imperial: {
    maxWeight: 'Max_Weight_lb',
    platformLength: 'Platform_Length_in',
    platformWidth: 'Platform_Width_in',
    platformHeight: 'Platform_Height_in',
  },
};

// ─── Default Stackability Classes ────────────────────────────────────────────

/** Default stackability class identifiers. */
export const DEFAULT_STACKABILITY_CLASSES = [
  'standard', // may be stacked on and may be placed on others
  'fragile', // may not be stacked on
  'heavy', // may be placed on the floor only
  'no_stack', // may neither support nor be supported
] as const;

export type StackabilityClass = (typeof DEFAULT_STACKABILITY_CLASSES)[number];

// ─── Trailer Templates ───────────────────────────────────────────────────────
// Dimensions stored in canonical mm/kg. Imperial-native templates are derived
// from their nominal imperial dimensions using exact conversion factors.

const inch = (n: number): number => Math.round(n * MM_PER_INCH);
const pound = (n: number): number => Math.round(n * KG_PER_POUND);

/**
 * Pre-configured trailer templates. `id` values are stable identifiers used
 * for seeding; consumers may clone these into editable profiles.
 */
export const TRAILER_TEMPLATES: readonly TrailerProfile[] = [
  // ── European (metric-native) ──────────────────────────────────────────────
  {
    id: 'eu-standard-curtainsider-13600',
    name: 'Standard 13.6m Curtainsider',
    internalLength: 13600,
    internalWidth: 2480,
    internalHeight: 2700,
    maxPayloadWeight: 24000,
    axleCount: 3,
    axleWeightLimits: [8000, 8000, 8000],
    displayUnitSystem: 'metric',
    trailerType: 'curtainsider',
    doorConfig: { rear: true, sideLeft: true, sideRight: true },
    isTemplate: true,
  },
  {
    id: 'eu-box-trailer-13600',
    name: 'Box Trailer 13.6m',
    internalLength: 13600,
    internalWidth: 2480,
    internalHeight: 2700,
    maxPayloadWeight: 24000,
    axleCount: 3,
    axleWeightLimits: [8000, 8000, 8000],
    displayUnitSystem: 'metric',
    trailerType: 'enclosed',
    doorConfig: { rear: true, sideLeft: false, sideRight: false },
    isTemplate: true,
  },
  {
    id: 'eu-mega-trailer-13600',
    name: 'Mega Trailer 13.6m',
    internalLength: 13600,
    internalWidth: 2480,
    internalHeight: 3000,
    maxPayloadWeight: 24000,
    axleCount: 3,
    axleWeightLimits: [8000, 8000, 8000],
    displayUnitSystem: 'metric',
    trailerType: 'enclosed',
    doorConfig: { rear: true, sideLeft: false, sideRight: false },
    isTemplate: true,
  },

  // ── North American (imperial-native) ────────────────────────────────────────
  {
    id: 'na-dry-van-53ft',
    name: '53 ft Dry Van',
    internalLength: inch(636), // 53 ft
    internalWidth: inch(100), // ~100 in usable interior width
    internalHeight: inch(110), // ~110 in usable interior height
    maxPayloadWeight: pound(45000),
    axleCount: 2,
    axleWeightLimits: [pound(20000), pound(34000)],
    displayUnitSystem: 'imperial',
    trailerType: 'enclosed',
    doorConfig: { rear: true, sideLeft: false, sideRight: false },
    isTemplate: true,
  },
  {
    id: 'na-flatbed-48ft',
    name: '48 ft Flatbed',
    internalLength: inch(576), // 48 ft
    internalWidth: inch(102), // 102 in deck width
    internalHeight: inch(102), // nominal legal cargo height envelope
    maxPayloadWeight: pound(48000),
    axleCount: 2,
    axleWeightLimits: [pound(20000), pound(34000)],
    displayUnitSystem: 'imperial',
    trailerType: 'flatbed',
    doorConfig: { rear: true, sideLeft: true, sideRight: true },
    isTemplate: true,
  },
];
