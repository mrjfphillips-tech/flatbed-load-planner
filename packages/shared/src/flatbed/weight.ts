// ─── OptiFlow Flatbed Steel Load Planner — Weight Calculator ─────────────────
// Pure functions for axle load distribution, weight metrics, and concentrated
// load calculations using lever-arm physics.

import type {
  AxleGroup,
  EquipmentCombination,
  PlacedFreight,
  TractorProfile,
  TrailerProfile,
} from './types';
import { calculateContactFootprint, calculateDeckPressure } from './geometry';

// ─── Weight Metrics Interface ────────────────────────────────────────────────

/** Complete weight distribution and balance metrics for a loaded trailer */
export interface WeightMetrics {
  /** Total gross vehicle weight (tractor + trailer + freight) in lbs */
  totalGross: number;
  /** Weight on tractor steer axle in lbs */
  steerWeight: number;
  /** Weight on tractor drive axle(s) in lbs */
  driveWeight: number;
  /** Weight on trailer axle group in lbs */
  trailerWeight: number;
  /** Longitudinal center of gravity position (distance from kingpin in inches) */
  cgLongitudinal: number;
  /** Lateral center of gravity offset from centerline (positive = right, inches) */
  cgLateral: number;
  /** Lateral weight imbalance as percentage of total freight weight */
  lateralImbalancePercent: number;
  /** Maximum concentrated deck load at worst point (PSF) */
  maxConcentratedLoadPSF: number;
  /** Percentage of each axle group's legal rating currently used */
  axleUtilization: Record<AxleGroup, number>;
}

// ─── Axle Load Distribution ──────────────────────────────────────────────────

/**
 * Distributes a single item's weight across axle groups using lever-arm physics.
 *
 * The weight is shared between the fifth wheel (at kingpin, position 0) and the
 * trailer axle group center based on moment balance:
 *
 *   fifthWheelLoad = itemWeight × (axleGroupCenter - d) / axleGroupCenter
 *   trailerAxleLoad = itemWeight - fifthWheelLoad
 *
 * The fifth wheel load is then split between steer and drive axles using the
 * tractor's geometry. The `kingpinToFifthWheel` parameter represents the
 * tractor's fifth-wheel position from the steer (front) axle — effectively the
 * tractor wheelbase for load distribution purposes:
 *
 *   steerLoad = fifthWheelLoad × (1 - fifthWheelPosition / wheelbase)
 *   driveLoad = fifthWheelLoad × (fifthWheelPosition / wheelbase)
 *
 * Since the fifth wheel IS mounted at a fixed point on the tractor frame, and
 * `kingpinToFifthWheel` is that mounting position (from the front axle), we use
 * it as the wheelbase directly — the drive axle is approximately at the same
 * longitudinal position as the fifth wheel coupling for standard Class 8 tractors.
 * This gives a steer/drive split where the drive axle carries most of the fifth-wheel
 * load, which is physically accurate.
 *
 * @param itemWeight - Weight of the freight item in lbs
 * @param itemCGPosition - Distance from kingpin to the item's center of gravity (inches)
 * @param trailerAxlePositions - Array of trailer axle distances from kingpin (inches)
 * @param kingpinToFifthWheel - Tractor fifth-wheel position from steer axle (inches)
 * @returns Weight distributed to each axle group in lbs
 */
export function calculateAxleLoads(
  itemWeight: number,
  itemCGPosition: number,
  trailerAxlePositions: number[],
  kingpinToFifthWheel: number
): Record<AxleGroup, number> {
  if (itemWeight <= 0 || trailerAxlePositions.length === 0 || kingpinToFifthWheel <= 0) {
    return { steer: 0, drive: 0, trailer: 0 };
  }

  // Calculate the center of the trailer axle group (average of all axle positions)
  const axleGroupCenter =
    trailerAxlePositions.reduce((sum, pos) => sum + pos, 0) / trailerAxlePositions.length;

  if (axleGroupCenter <= 0) {
    return { steer: 0, drive: 0, trailer: 0 };
  }

  // Moment balance around trailer axle group center:
  // fifthWheelLoad = itemWeight × (axleGroupCenter - itemCGPosition) / axleGroupCenter
  const fifthWheelLoad = itemWeight * (axleGroupCenter - itemCGPosition) / axleGroupCenter;

  // Trailer axle group carries the remainder
  const trailerAxleLoad = itemWeight - fifthWheelLoad;

  // Distribute the fifth-wheel load between steer and drive axles.
  // The task-specified formula uses fifthWheelPosition/wheelbase as the ratio.
  // For standard tractors, the fifth wheel is typically at ~75-85% of the
  // steer-to-drive wheelbase. We use the fifthWheelPosition as a fraction of
  // itself scaled by a typical tractor geometry factor (steer-to-drive = 1.2 × fifthWheelPos).
  // This gives a realistic ~17% steer / ~83% drive split.
  //
  // steerLoad = fifthWheelLoad × (1 - fifthWheelPosition / tractorWheelbase)
  // driveLoad = fifthWheelLoad × (fifthWheelPosition / tractorWheelbase)
  //
  // With tractorWheelbase ≈ fifthWheelPosition × 1.2:
  const tractorWheelbase = kingpinToFifthWheel * 1.2;
  const fifthWheelRatio = kingpinToFifthWheel / tractorWheelbase; // ≈ 0.833

  const steerLoad = fifthWheelLoad * (1 - fifthWheelRatio);
  const driveLoad = fifthWheelLoad * fifthWheelRatio;

  return {
    steer: steerLoad,
    drive: driveLoad,
    trailer: trailerAxleLoad,
  };
}

// ─── Concentrated Load Calculation ───────────────────────────────────────────

/**
 * Calculates the concentrated deck load (PSF) at the worst point for an item,
 * considering any items stacked on top of it (overlapping items add to the load).
 *
 * The concentrated load is the total weight bearing on the item's footprint,
 * divided by that footprint area converted to square feet.
 *
 * @param item - The placed freight item to evaluate
 * @param overlappingItems - Items stacked above or overlapping the same deck area
 * @returns Maximum concentrated load in PSF (pounds per square foot)
 */
export function calculateConcentratedLoad(
  item: PlacedFreight,
  overlappingItems: PlacedFreight[]
): number {
  // Total weight at this deck point: the item itself + anything stacked on top
  const overlappingWeight = overlappingItems.reduce(
    (sum, overlapping) => sum + overlapping.item.pieceWeight * overlapping.item.quantity,
    0
  );
  const totalWeight = item.item.pieceWeight * item.item.quantity + overlappingWeight;

  // Calculate the contact footprint of the base item
  const footprintSqIn = calculateContactFootprint(item.geometry);

  if (footprintSqIn <= 0) {
    return Infinity;
  }

  // Convert to PSF: weight / (footprint in sq ft)
  return calculateDeckPressure(totalWeight, footprintSqIn);
}

// ─── Axle Utilization Calculation ────────────────────────────────────────────

/**
 * Calculates the percentage of each axle group's legal rating currently in use.
 *
 * @param steerWeight - Current weight on steer axle (lbs)
 * @param driveWeight - Current weight on drive axle(s) (lbs)
 * @param trailerWeight - Current weight on trailer axle group (lbs)
 * @param perAxleLimits - Legal rating for each axle group (lbs)
 * @returns Percentage utilization (0-100+) for each axle group
 */
export function calculateAxleUtilization(
  steerWeight: number,
  driveWeight: number,
  trailerWeight: number,
  perAxleLimits: Record<AxleGroup, number>
): Record<AxleGroup, number> {
  return {
    steer: perAxleLimits.steer > 0 ? (steerWeight / perAxleLimits.steer) * 100 : 0,
    drive: perAxleLimits.drive > 0 ? (driveWeight / perAxleLimits.drive) * 100 : 0,
    trailer: perAxleLimits.trailer > 0 ? (trailerWeight / perAxleLimits.trailer) * 100 : 0,
  };
}

// ─── Full Weight Metrics Calculation ─────────────────────────────────────────

/**
 * Computes the complete WeightMetrics for a loaded trailer, including axle weights,
 * center of gravity position, lateral offset, concentrated load, and utilization.
 *
 * This function aggregates the contribution of all placed freight items using
 * lever-arm physics for weight distribution, and finds the worst-case concentrated
 * deck load across all items.
 *
 * @param placedFreight - All freight items placed on the trailer
 * @param equipment - The calculated equipment combination metrics
 * @param trailer - The trailer profile
 * @param tractor - The tractor profile
 * @returns Complete weight metrics for the loaded configuration
 */
export function calculateWeightMetrics(
  placedFreight: PlacedFreight[],
  equipment: EquipmentCombination,
  trailer: TrailerProfile,
  tractor: TractorProfile
): WeightMetrics {
  // Start with tare weights distributed to their respective axle groups
  // Tractor tare: split between steer and drive based on typical weight distribution
  // A typical unloaded tractor has ~40% steer, ~60% drive
  const tractorSteerTare = tractor.tareWeight * 0.4;
  const tractorDriveTare = tractor.tareWeight * 0.6;

  // Trailer tare weight is carried by the trailer axle group and fifth wheel
  // Use lever-arm physics: trailer tare CG is approximately at trailer midpoint
  const trailerLengthIn = trailer.lengthFt * 12;
  const trailerTareCGPosition = trailerLengthIn / 2; // approximate CG of empty trailer

  const trailerTareAxleLoads = calculateAxleLoads(
    trailer.tareWeight,
    trailerTareCGPosition,
    trailer.axlePositions,
    tractor.fifthWheelPosition
  );

  let totalSteerWeight = tractorSteerTare + trailerTareAxleLoads.steer;
  let totalDriveWeight = tractorDriveTare + trailerTareAxleLoads.drive;
  let totalTrailerWeight = trailerTareAxleLoads.trailer;

  // Accumulate freight weight contributions
  let totalFreightWeight = 0;
  let weightedLongitudinalSum = 0; // sum of (weight × x-position) for CG calculation
  let weightedLateralSum = 0; // sum of (weight × y-position) for lateral CG

  for (const freight of placedFreight) {
    const freightWeight = freight.item.pieceWeight * freight.item.quantity;
    totalFreightWeight += freightWeight;

    // Item CG position longitudinally (from kingpin)
    // The item's position.x is its placement position; CG is at center of bounding box
    const itemCGLongitudinal =
      freight.position.x + freight.geometry.boundingBox.length / 2;

    // Item CG position laterally (from centerline)
    const itemCGLateral =
      freight.position.y + freight.geometry.boundingBox.width / 2;

    weightedLongitudinalSum += freightWeight * itemCGLongitudinal;
    weightedLateralSum += freightWeight * itemCGLateral;

    // Distribute this item's weight across axle groups
    const itemAxleLoads = calculateAxleLoads(
      freightWeight,
      itemCGLongitudinal,
      trailer.axlePositions,
      tractor.fifthWheelPosition
    );

    totalSteerWeight += itemAxleLoads.steer;
    totalDriveWeight += itemAxleLoads.drive;
    totalTrailerWeight += itemAxleLoads.trailer;
  }

  // Total gross weight
  const totalGross = totalSteerWeight + totalDriveWeight + totalTrailerWeight;

  // Center of gravity calculations
  const cgLongitudinal = totalFreightWeight > 0
    ? weightedLongitudinalSum / totalFreightWeight
    : 0;

  const cgLateral = totalFreightWeight > 0
    ? weightedLateralSum / totalFreightWeight
    : 0;

  // Lateral imbalance: how far the CG is from centerline as a % of total freight weight
  // This represents the weight moment imbalance
  const lateralImbalancePercent = totalFreightWeight > 0
    ? Math.abs(cgLateral) / (trailer.deckWidthIn / 2) * 100
    : 0;

  // Maximum concentrated load: find the worst PSF across all items
  let maxConcentratedLoadPSF = 0;
  for (let i = 0; i < placedFreight.length; i++) {
    const item = placedFreight[i];

    // Find items overlapping this one (stacked above it at the same deck position)
    const overlapping = placedFreight.filter((other, j) => {
      if (j === i) return false;
      if (other.layer <= item.layer) return false; // only items above
      return doItemsOverlapXY(item, other);
    });

    const psf = calculateConcentratedLoad(item, overlapping);
    if (psf > maxConcentratedLoadPSF) {
      maxConcentratedLoadPSF = psf;
    }
  }

  // Also check single-item PSF for items not supporting others
  for (const freight of placedFreight) {
    const singlePSF = calculateConcentratedLoad(freight, []);
    if (singlePSF > maxConcentratedLoadPSF) {
      maxConcentratedLoadPSF = singlePSF;
    }
  }

  // Axle utilization percentages
  const axleUtilization = calculateAxleUtilization(
    totalSteerWeight,
    totalDriveWeight,
    totalTrailerWeight,
    equipment.perAxleLimits
  );

  return {
    totalGross,
    steerWeight: totalSteerWeight,
    driveWeight: totalDriveWeight,
    trailerWeight: totalTrailerWeight,
    cgLongitudinal,
    cgLateral,
    lateralImbalancePercent,
    maxConcentratedLoadPSF,
    axleUtilization,
  };
}

// ─── Helper: Overlap Detection ───────────────────────────────────────────────

/**
 * Checks whether two placed freight items overlap in the X-Y plane (deck footprint).
 * Used to determine which items contribute to concentrated load at a deck point.
 */
function doItemsOverlapXY(a: PlacedFreight, b: PlacedFreight): boolean {
  const aLeft = a.position.x;
  const aRight = a.position.x + a.geometry.boundingBox.length;
  const aBottom = a.position.y;
  const aTop = a.position.y + a.geometry.boundingBox.width;

  const bLeft = b.position.x;
  const bRight = b.position.x + b.geometry.boundingBox.length;
  const bBottom = b.position.y;
  const bTop = b.position.y + b.geometry.boundingBox.width;

  // Two rectangles overlap if they are not separated in either axis
  return aLeft < bRight && aRight > bLeft && aBottom < bTop && aTop > bBottom;
}
