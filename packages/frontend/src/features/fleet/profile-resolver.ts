// ─── Vehicle Profile Resolver ────────────────────────────────────────────────
// Maps a VehicleRecord → ResolvedVehicleProfile by looking up the Peru regional
// preset catalog via condition code, cloning the trailer/tractor profiles, and
// overriding weight capacity and platform dimensions from the fleet file.

import type { TrailerProfile, TractorProfile } from '@ptv-discovery-coach/shared';
import { calculateEquipmentCombination } from '@ptv-discovery-coach/shared';
import { REGIONAL_PRESETS } from '../equipment';
import type { RegionalPreset } from '../equipment';
import type {
  ConditionCode,
  VehicleRecord,
  ResolvedVehicleProfile,
  ProfileResolutionError,
} from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Conversion factor: 1 metric tonne = 2204.62 lbs */
const TONNES_TO_LBS = 2204.62;

/** Conversion factor: 1 metre = 3.28084 feet */
const METRES_TO_FEET = 3.28084;

/** Conversion factor: 1 metre = 39.3701 inches */
const METRES_TO_INCHES = 39.3701;

/**
 * Maps fleet condition codes to their corresponding Peru regional preset IDs.
 * Each condition code identifies a vehicle class/zone in the Peru fleet catalog.
 */
export const CONDITION_CODE_MAP: Record<ConditionCode, string> = {
  'ZN': 'pe-camion-zn',
  'ZO': 'pe-camion-zo',
  'ZB': 'pe-camion-zb',
  'ZA': 'pe-trailer-13m',
  'ZF': 'pe-camion-grua',
};

// ─── Unit Conversion Helpers ─────────────────────────────────────────────────

/** Convert tonnes to pounds */
export function tonnesToLbs(tonnes: number): number {
  return Math.round(tonnes * TONNES_TO_LBS);
}

/** Convert metres to feet (rounded to nearest integer) */
export function metresToFeet(metres: number): number {
  return Math.round(metres * METRES_TO_FEET);
}

/** Convert metres to inches (rounded to nearest integer) */
export function metresToInches(metres: number): number {
  return Math.round(metres * METRES_TO_INCHES);
}

// ─── Profile Resolution ──────────────────────────────────────────────────────

/**
 * Resolves a VehicleRecord into a complete equipment profile by:
 * 1. Looking up the preset via condition code using CONDITION_CODE_MAP
 * 2. Cloning the preset's trailer and tractor profiles
 * 3. Overriding weight capacity (tonnes → lbs) from the fleet file
 * 4. Overriding platform length (metres → feet) and width (metres → inches)
 * 5. Computing the EquipmentCombination from the resolved profiles
 *
 * Returns a ProfileResolutionError if the condition code is unrecognized
 * or if the mapped preset ID is not found in the regional presets catalog.
 */
export function resolveVehicleProfile(
  record: VehicleRecord
): ResolvedVehicleProfile | ProfileResolutionError {
  // Step 1: Map condition code to preset ID
  const presetId = CONDITION_CODE_MAP[record.conditionCode];
  if (!presetId) {
    return {
      vehicleId: record.vehicleId,
      reason: `Unrecognized condition code: "${record.conditionCode}". Expected one of: ZN, ZO, ZB, ZA, ZF.`,
    };
  }

  // Step 2: Look up the preset in the regional catalog
  const preset: RegionalPreset | undefined = REGIONAL_PRESETS.find(p => p.id === presetId);
  if (!preset) {
    return {
      vehicleId: record.vehicleId,
      reason: `No regional preset found for ID "${presetId}" (condition code: ${record.conditionCode}).`,
    };
  }

  // Step 3: Clone trailer and tractor profiles (deep clone to avoid mutation)
  const trailer: TrailerProfile = {
    ...preset.trailer,
    stakePockets: preset.trailer.stakePockets.map(p => ({ ...p })),
    anchorPoints: preset.trailer.anchorPoints.map(p => ({ ...p })),
    axlePositions: [...preset.trailer.axlePositions],
    axleWeightRatings: [...preset.trailer.axleWeightRatings],
  };

  const tractor: TractorProfile = { ...preset.tractor };

  // Step 4: Override weight capacity (convert tonnes → lbs)
  trailer.maxGrossWeight = tonnesToLbs(record.weightCapacity);

  // Step 5: Override platform dimensions (convert metres → imperial)
  trailer.lengthFt = metresToFeet(record.platformLength);
  trailer.deckWidthIn = metresToInches(record.platformWidth);

  // Step 6: Calculate equipment combination from resolved profiles
  const equipment = calculateEquipmentCombination(tractor, trailer);

  return { trailer, tractor, equipment };
}

// ─── Type Guard ──────────────────────────────────────────────────────────────

/** Type guard to check if a resolution result is an error */
export function isProfileResolutionError(
  result: ResolvedVehicleProfile | ProfileResolutionError
): result is ProfileResolutionError {
  return 'reason' in result && 'vehicleId' in result && !('trailer' in result);
}
