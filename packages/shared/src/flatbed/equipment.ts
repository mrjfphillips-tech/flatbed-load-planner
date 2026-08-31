// ─── OptiFlow Flatbed Steel Load Planner — Equipment Validation ──────────────
// Pure validation functions for tractor/trailer profiles and equipment combinations.

import type {
  AxleGroup,
  EquipmentCombination,
  TractorProfile,
  TrailerProfile,
} from './types';

// ─── Validation Result Types ─────────────────────────────────────────────────

/** Result of a validation operation */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ─── Trailer Profile Validation ──────────────────────────────────────────────

/**
 * Validates a trailer profile by checking that the sum of axle weight ratings
 * is at least (maxGrossWeight − tareWeight). This ensures the axles can
 * support the maximum intended cargo payload.
 *
 * @param trailer - The trailer profile to validate
 * @returns ValidationResult indicating whether the profile is valid
 */
export function validateTrailerProfile(trailer: TrailerProfile): ValidationResult {
  const errors: string[] = [];

  const axleRatingsSum = trailer.axleWeightRatings.reduce((sum, rating) => sum + rating, 0);
  const requiredCapacity = trailer.maxGrossWeight - trailer.tareWeight;

  if (axleRatingsSum < requiredCapacity) {
    errors.push(
      `Axle weight ratings sum (${axleRatingsSum} lbs) is less than required capacity ` +
      `(maxGross ${trailer.maxGrossWeight} − tare ${trailer.tareWeight} = ${requiredCapacity} lbs). ` +
      `Axles cannot support the rated payload.`
    );
  }

  return { valid: errors.length === 0, errors };
}

// ─── Tractor Profile Validation ──────────────────────────────────────────────

/**
 * Validates a tractor profile by verifying all weight ratings and tare weight
 * are positive values.
 *
 * @param tractor - The tractor profile to validate
 * @returns ValidationResult indicating whether the profile is valid
 */
export function validateTractorProfile(tractor: TractorProfile): ValidationResult {
  const errors: string[] = [];

  if (tractor.steerAxleRating <= 0) {
    errors.push(`Steer axle rating must be positive, got ${tractor.steerAxleRating} lbs.`);
  }

  if (tractor.driveAxleRating <= 0) {
    errors.push(`Drive axle rating must be positive, got ${tractor.driveAxleRating} lbs.`);
  }

  if (tractor.tareWeight <= 0) {
    errors.push(`Tractor tare weight must be positive, got ${tractor.tareWeight} lbs.`);
  }

  return { valid: errors.length === 0, errors };
}

// ─── Equipment Combination Calculation ───────────────────────────────────────

/**
 * Computes the equipment combination metrics for a tractor-trailer pair.
 * Calculates available payload, total legal gross weight, and per-axle limits.
 *
 * The total legal gross is determined by the minimum of:
 * - The trailer's max gross weight
 * - The sum of all axle ratings (steer + drive + trailer axles)
 *
 * Available payload = totalLegalGross − tractor tare − trailer tare.
 *
 * @param tractor - The tractor profile
 * @param trailer - The trailer profile
 * @returns The calculated EquipmentCombination
 */
export function calculateEquipmentCombination(
  tractor: TractorProfile,
  trailer: TrailerProfile
): EquipmentCombination {
  const trailerAxleRatingsSum = trailer.axleWeightRatings.reduce(
    (sum, rating) => sum + rating,
    0
  );

  // Total legal gross is limited by the trailer's rated max gross and by axle capacity
  const axleBasedGross = tractor.steerAxleRating + tractor.driveAxleRating + trailerAxleRatingsSum;
  const totalLegalGross = Math.min(trailer.maxGrossWeight, axleBasedGross);

  const availablePayload = totalLegalGross - tractor.tareWeight - trailer.tareWeight;

  const perAxleLimits: Record<AxleGroup, number> = {
    steer: tractor.steerAxleRating,
    drive: tractor.driveAxleRating,
    trailer: trailerAxleRatingsSum,
  };

  return {
    tractorId: tractor.id,
    trailerId: trailer.id,
    availablePayload,
    totalLegalGross,
    perAxleLimits,
  };
}

// ─── Payload Validity Check ──────────────────────────────────────────────────

/**
 * Checks whether an equipment combination has a valid (non-negative) payload.
 * Combinations with negative payload indicate that the tractor and trailer tare
 * weights exceed the legal gross limit, making the combination unusable.
 *
 * @param combination - The equipment combination to check
 * @returns true if the payload is valid (>= 0), false if negative
 */
export function isPayloadValid(combination: EquipmentCombination): boolean {
  return combination.availablePayload >= 0;
}
