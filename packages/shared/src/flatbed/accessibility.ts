// ─── OptiFlow Flatbed Steel Load Planner — Stop-Order Accessibility ─────────
// Pure functions for validating delivery stop accessibility constraints.
// Ensures freight at later stops doesn't block access to earlier-stop items
// based on the specified unloading method (crane, forklift side, forklift rear).

import type {
  HandlingMethod,
  PlacedFreight,
  TrailerProfile,
} from './types';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Supported unloading methods for accessibility validation */
export type UnloadingMethod = 'crane' | 'forklift_side' | 'forklift_rear' | 'magnet' | 'manual';

/** Maps handling method from order line to default unloading method */
export function handlingToUnloadingMethod(handling: HandlingMethod): UnloadingMethod {
  switch (handling) {
    case 'crane':
      return 'crane';
    case 'forklift':
      return 'forklift_side';
    case 'magnet':
      return 'magnet';
    case 'manual':
      return 'manual';
  }
}

/** A single accessibility conflict between freight items */
export interface AccessibilityConflict {
  /** The item whose access is blocked */
  blockedItem: string;
  /** The delivery stop of the blocked item */
  blockedStop: number;
  /** The item causing the blockage */
  blockingItem: string;
  /** The delivery stop of the blocking item */
  blockingStop: number;
  /** The type of access violation */
  violationType: 'vertical' | 'lateral' | 'rear';
  /** Human-readable description of the conflict */
  message: string;
  /** Suggested corrective action */
  suggestedAction: string;
}

/** Result of a full accessibility validation */
export interface AccessibilityResult {
  /** Whether all accessibility constraints are satisfied */
  isAccessible: boolean;
  /** List of all conflicts found */
  conflicts: AccessibilityConflict[];
  /** Summary message */
  summary: string;
}

/** Configuration for stop-based unloading methods (per-stop overrides) */
export interface StopUnloadingConfig {
  stop: number;
  method: UnloadingMethod;
}

// ─── Delivery Stop Assignment Validation ─────────────────────────────────────

/**
 * Validates that all placed freight items have valid delivery stop assignments.
 *
 * Checks:
 * - All items have a positive integer delivery stop
 * - Stop numbers form a valid sequence (no gaps isn't enforced, but all > 0)
 *
 * @param placedFreight - All freight items placed on the trailer
 * @returns Array of validation error messages (empty if valid)
 */
export function validateDeliveryStopAssignments(
  placedFreight: PlacedFreight[]
): string[] {
  const errors: string[] = [];

  for (const freight of placedFreight) {
    const stop = freight.item.deliveryStop;

    if (!Number.isInteger(stop) || stop < 1) {
      errors.push(
        `Item "${freight.item.orderNumber}" has an invalid delivery stop (${stop}). Delivery stops must be positive integers starting from 1.`
      );
    }
  }

  return errors;
}

// ─── Unloading Method Resolution ─────────────────────────────────────────────

/**
 * Resolves the effective unloading method for a placed freight item.
 * Uses the stop config override if provided, otherwise defaults to the
 * item's handling method.
 */
function resolveUnloadingMethod(
  freight: PlacedFreight,
  stopConfigMap?: Map<number, UnloadingMethod>
): UnloadingMethod {
  if (stopConfigMap) {
    const override = stopConfigMap.get(freight.item.deliveryStop);
    if (override) return override;
  }
  return handlingToUnloadingMethod(freight.item.handlingMethod);
}

// ─── XY Overlap Helper ───────────────────────────────────────────────────────

/**
 * Checks whether two placed freight items overlap in the X-Y plane (deck footprint).
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

  return aLeft < bRight && aRight > bLeft && aBottom < bTop && aTop > bBottom;
}

// ─── Overhead Crane Accessibility (Vertical Access) ──────────────────────────

/**
 * Validates that items for a given stop have vertical clearance — nothing from
 * a later stop is stacked above them. Crane unloading requires the item to be
 * liftable straight up without obstruction.
 *
 * A later-stop item (stop M > N) stacked above a stop-N item blocks crane access
 * because the later-stop item would need to remain on the trailer while the
 * earlier-stop item is being removed.
 *
 * @param placedFreight - All freight items placed on the trailer
 * @param stopConfigMap - Optional map of stop number to unloading method override
 * @returns Array of vertical accessibility conflicts
 */
export function validateCraneAccess(
  placedFreight: PlacedFreight[],
  stopConfigMap?: Map<number, UnloadingMethod>
): AccessibilityConflict[] {
  const conflicts: AccessibilityConflict[] = [];

  for (const item of placedFreight) {
    const itemStop = item.item.deliveryStop;

    // Only check items that use crane/magnet unloading
    const unloadMethod = resolveUnloadingMethod(item, stopConfigMap);
    if (unloadMethod !== 'crane' && unloadMethod !== 'magnet') continue;

    // Find items stacked above this one (higher z + XY overlap) that are for a later stop
    for (const other of placedFreight) {
      if (other === item) continue;
      if (other.item.deliveryStop <= itemStop) continue; // same or earlier stop won't block
      if (other.position.z <= item.position.z) continue; // not above

      // Check XY overlap — later-stop item is above earlier-stop item
      if (doItemsOverlapXY(item, other)) {
        conflicts.push({
          blockedItem: item.item.orderNumber,
          blockedStop: itemStop,
          blockingItem: other.item.orderNumber,
          blockingStop: other.item.deliveryStop,
          violationType: 'vertical',
          message: `Item "${other.item.orderNumber}" (stop ${other.item.deliveryStop}) is stacked above item "${item.item.orderNumber}" (stop ${itemStop}), blocking overhead crane access for the earlier delivery.`,
          suggestedAction: `Move item "${other.item.orderNumber}" to a position that does not overlap item "${item.item.orderNumber}" vertically, or place it at a lower layer.`,
        });
      }
    }
  }

  return conflicts;
}

// ─── Side Unloading Lateral Access ───────────────────────────────────────────

/**
 * Validates that items for a given stop have lateral access from a trailer edge.
 * Side unloading (forklift from side) requires the item to be positioned at or
 * near a trailer edge without later-stop freight blocking the lateral approach.
 *
 * An item has lateral access if it can be reached from the left or right side of
 * the trailer without a later-stop item between it and the nearest edge.
 *
 * @param placedFreight - All freight items placed on the trailer
 * @param trailer - The trailer profile (for deck width)
 * @param stopConfigMap - Optional map of stop number to unloading method override
 * @returns Array of lateral accessibility conflicts
 */
export function validateSideAccess(
  placedFreight: PlacedFreight[],
  trailer: TrailerProfile,
  stopConfigMap?: Map<number, UnloadingMethod>
): AccessibilityConflict[] {
  const conflicts: AccessibilityConflict[] = [];
  const halfWidth = trailer.deckWidthIn / 2;

  for (const item of placedFreight) {
    const itemStop = item.item.deliveryStop;

    // Only check items that use forklift_side unloading
    const unloadMethod = resolveUnloadingMethod(item, stopConfigMap);
    if (unloadMethod !== 'forklift_side') continue;

    // Check if blocked from the left side (negative y direction toward -halfWidth)
    const blockedFromLeft = isBlockedLaterally(item, placedFreight, 'left', halfWidth);

    // Check if blocked from the right side (positive y direction toward +halfWidth)
    const blockedFromRight = isBlockedLaterally(item, placedFreight, 'right', halfWidth);

    // If blocked from BOTH sides by later-stop items, it's a conflict
    if (blockedFromLeft && blockedFromRight) {
      const allBlockers = [...blockedFromLeft, ...blockedFromRight];
      const uniqueBlockers = [...new Set(allBlockers.map(b => b.item.orderNumber))];

      conflicts.push({
        blockedItem: item.item.orderNumber,
        blockedStop: itemStop,
        blockingItem: uniqueBlockers[0],
        blockingStop: allBlockers[0].item.deliveryStop,
        violationType: 'lateral',
        message: `Item "${item.item.orderNumber}" (stop ${itemStop}) is blocked from both sides by later-stop items (${uniqueBlockers.join(', ')}), preventing forklift side access.`,
        suggestedAction: `Reposition item "${item.item.orderNumber}" closer to a trailer edge, or move the blocking items to allow lateral access from at least one side.`,
      });
    }
  }

  return conflicts;
}

/**
 * Checks if an item is blocked from a given side by later-stop items.
 *
 * An item is blocked from a side if there is a later-stop item between it and the
 * trailer edge on that side, at the same longitudinal position and same height range.
 *
 * @returns Array of blocking items, or null if not blocked from this side
 */
function isBlockedLaterally(
  target: PlacedFreight,
  allFreight: PlacedFreight[],
  side: 'left' | 'right',
  halfWidth: number
): PlacedFreight[] | null {
  const targetStop = target.item.deliveryStop;
  const targetXStart = target.position.x;
  const targetXEnd = target.position.x + target.geometry.boundingBox.length;
  const targetYStart = target.position.y;
  const targetYEnd = target.position.y + target.geometry.boundingBox.width;
  const targetZ = target.position.z;
  const targetZTop = target.position.z + target.geometry.boundingBox.height;

  const blockers: PlacedFreight[] = [];

  for (const other of allFreight) {
    if (other === target) continue;
    if (other.item.deliveryStop <= targetStop) continue; // only later stops can block

    const otherXStart = other.position.x;
    const otherXEnd = other.position.x + other.geometry.boundingBox.length;
    const otherYStart = other.position.y;
    const otherYEnd = other.position.y + other.geometry.boundingBox.width;
    const otherZ = other.position.z;
    const otherZTop = other.position.z + other.geometry.boundingBox.height;

    // Must overlap longitudinally (same x range) to block lateral access
    const xOverlap = otherXStart < targetXEnd && otherXEnd > targetXStart;
    if (!xOverlap) continue;

    // Must overlap vertically (same height range) — a forklift approaches from the side at item height
    const zOverlap = otherZ < targetZTop && otherZTop > targetZ;
    if (!zOverlap) continue;

    // Check if the other item is between target and the edge on the specified side
    if (side === 'left') {
      // Blocking from the left: other item is to the left of target (lower y) AND
      // between target and the left edge (-halfWidth)
      if (otherYEnd <= targetYStart && otherYStart >= -halfWidth) {
        blockers.push(other);
      }
    } else {
      // Blocking from the right: other item is to the right of target (higher y) AND
      // between target and the right edge (+halfWidth)
      if (otherYStart >= targetYEnd && otherYEnd <= halfWidth) {
        blockers.push(other);
      }
    }
  }

  return blockers.length > 0 ? blockers : null;
}

// ─── Forklift-from-Rear Access ───────────────────────────────────────────────

/**
 * Validates that items for a given stop can be accessed from the rear of the trailer.
 * Forklift-from-rear unloading requires clear longitudinal access from the trailer's
 * rear end to the item, without later-stop items blocking the path.
 *
 * An item is accessible from the rear if there are no later-stop items between it
 * and the rear of the trailer (at the same lateral position and height).
 *
 * @param placedFreight - All freight items placed on the trailer
 * @param trailer - The trailer profile (for length)
 * @param stopConfigMap - Optional map of stop number to unloading method override
 * @returns Array of rear accessibility conflicts
 */
export function validateRearAccess(
  placedFreight: PlacedFreight[],
  _trailer: TrailerProfile,
  stopConfigMap?: Map<number, UnloadingMethod>
): AccessibilityConflict[] {
  const conflicts: AccessibilityConflict[] = [];

  for (const item of placedFreight) {
    const itemStop = item.item.deliveryStop;

    // Check items that use forklift_rear or manual unloading
    const unloadMethod = resolveUnloadingMethod(item, stopConfigMap);
    if (unloadMethod !== 'forklift_rear' && unloadMethod !== 'manual') continue;

    const itemXEnd = item.position.x + item.geometry.boundingBox.length;
    const itemYStart = item.position.y;
    const itemYEnd = item.position.y + item.geometry.boundingBox.width;
    const itemZ = item.position.z;
    const itemZTop = item.position.z + item.geometry.boundingBox.height;

    // Find later-stop items that are between this item and the rear of the trailer
    const blockers: PlacedFreight[] = [];

    for (const other of placedFreight) {
      if (other === item) continue;
      if (other.item.deliveryStop <= itemStop) continue; // only later stops block

      const otherXStart = other.position.x;
      const otherYStart = other.position.y;
      const otherYEnd = other.position.y + other.geometry.boundingBox.width;
      const otherZ = other.position.z;
      const otherZTop = other.position.z + other.geometry.boundingBox.height;

      // The blocking item must be behind the target item (higher x = toward rear)
      if (otherXStart < itemXEnd) continue;

      // Must overlap laterally (same y range) — forklift path is the item's width
      const yOverlap = otherYStart < itemYEnd && otherYEnd > itemYStart;
      if (!yOverlap) continue;

      // Must overlap vertically (forklift approaches at item height)
      const zOverlap = otherZ < itemZTop && otherZTop > itemZ;
      if (!zOverlap) continue;

      blockers.push(other);
    }

    if (blockers.length > 0) {
      const blockerNames = [...new Set(blockers.map(b => b.item.orderNumber))];
      conflicts.push({
        blockedItem: item.item.orderNumber,
        blockedStop: itemStop,
        blockingItem: blockerNames[0],
        blockingStop: blockers[0].item.deliveryStop,
        violationType: 'rear',
        message: `Item "${item.item.orderNumber}" (stop ${itemStop}) cannot be reached from the rear because later-stop items (${blockerNames.join(', ')}) are positioned behind it.`,
        suggestedAction: `Move item "${item.item.orderNumber}" closer to the rear of the trailer, or reposition blocking items (${blockerNames.join(', ')}) forward.`,
      });
    }
  }

  return conflicts;
}

// ─── Combined Accessibility Validation ───────────────────────────────────────

/**
 * Performs comprehensive stop-order accessibility validation for all placed freight.
 *
 * This is the main entry point that checks all unloading methods:
 * - Overhead crane: vertical clearance (nothing stacked above from a later stop)
 * - Side forklift: lateral access from at least one trailer edge
 * - Rear forklift: clear path from the rear of the trailer
 * - General: no later-stop item blocks access to earlier-stop item (basic layer check)
 *
 * The function uses each item's handling method to determine which accessibility
 * check applies, but also performs the general stacking check for all items.
 *
 * @param placedFreight - All freight items placed on the trailer
 * @param trailer - The trailer profile
 * @param stopConfigs - Optional per-stop unloading method overrides
 * @returns Complete accessibility validation result
 */
export function validateStopOrderAccessibility(
  placedFreight: PlacedFreight[],
  trailer: TrailerProfile,
  stopConfigs?: StopUnloadingConfig[]
): AccessibilityResult {
  if (placedFreight.length === 0) {
    return {
      isAccessible: true,
      conflicts: [],
      summary: 'No freight items to validate.',
    };
  }

  // Validate delivery stop assignments first
  const assignmentErrors = validateDeliveryStopAssignments(placedFreight);
  if (assignmentErrors.length > 0) {
    return {
      isAccessible: false,
      conflicts: assignmentErrors.map(msg => ({
        blockedItem: '',
        blockedStop: 0,
        blockingItem: '',
        blockingStop: 0,
        violationType: 'vertical' as const,
        message: msg,
        suggestedAction: 'Assign valid delivery stop numbers to all items.',
      })),
      summary: `${assignmentErrors.length} item(s) have invalid delivery stop assignments.`,
    };
  }

  // Check if there are multiple stops (single-stop loads always pass)
  const stops = new Set(placedFreight.map(f => f.item.deliveryStop));
  if (stops.size <= 1) {
    return {
      isAccessible: true,
      conflicts: [],
      summary: 'Single delivery stop — no accessibility conflicts possible.',
    };
  }

  // Build stop config map for method resolution
  const stopConfigMap = stopConfigs
    ? new Map(stopConfigs.map(c => [c.stop, c.method]))
    : undefined;

  const allConflicts: AccessibilityConflict[] = [];

  // 1. General vertical accessibility (applies to ALL items regardless of handling)
  //    This catches any later-stop item stacked above an earlier-stop item.
  const generalVerticalConflicts = validateGeneralVerticalAccess(placedFreight);
  allConflicts.push(...generalVerticalConflicts);

  // 2. Crane-specific validation (overhead vertical clearance)
  const craneConflicts = validateCraneAccess(placedFreight, stopConfigMap);
  // Only add conflicts not already captured by the general check
  for (const conflict of craneConflicts) {
    if (!isDuplicateConflict(allConflicts, conflict)) {
      allConflicts.push(conflict);
    }
  }

  // 3. Side unloading validation
  const sideConflicts = validateSideAccess(placedFreight, trailer, stopConfigMap);
  allConflicts.push(...sideConflicts);

  // 4. Rear access validation
  const rearConflicts = validateRearAccess(placedFreight, trailer, stopConfigMap);
  allConflicts.push(...rearConflicts);

  const isAccessible = allConflicts.length === 0;
  const summary = isAccessible
    ? 'All delivery stops have proper unloading access.'
    : `${allConflicts.length} accessibility conflict(s) found across ${countAffectedStops(allConflicts)} delivery stop(s).`;

  return {
    isAccessible,
    conflicts: allConflicts,
    summary,
  };
}

// ─── General Vertical Access (All Items) ─────────────────────────────────────

/**
 * Validates that no later-stop item is stacked above an earlier-stop item.
 * This is the basic accessibility check that applies to all items regardless
 * of their specific unloading method.
 *
 * @param placedFreight - All freight items placed on the trailer
 * @returns Array of general vertical accessibility conflicts
 */
function validateGeneralVerticalAccess(
  placedFreight: PlacedFreight[]
): AccessibilityConflict[] {
  const conflicts: AccessibilityConflict[] = [];

  for (const item of placedFreight) {
    const itemStop = item.item.deliveryStop;

    for (const other of placedFreight) {
      if (other === item) continue;
      if (other.item.deliveryStop <= itemStop) continue; // same or earlier stop is fine
      if (other.position.z <= item.position.z) continue; // not above

      // Check XY overlap
      if (doItemsOverlapXY(item, other)) {
        conflicts.push({
          blockedItem: item.item.orderNumber,
          blockedStop: itemStop,
          blockingItem: other.item.orderNumber,
          blockingStop: other.item.deliveryStop,
          violationType: 'vertical',
          message: `Item "${other.item.orderNumber}" (stop ${other.item.deliveryStop}) is stacked above item "${item.item.orderNumber}" (stop ${itemStop}), blocking access for the earlier delivery.`,
          suggestedAction: `Rearrange items so that stop ${itemStop} freight is not covered by stop ${other.item.deliveryStop} freight. Move "${other.item.orderNumber}" to a separate deck position or a lower layer.`,
        });
      }
    }
  }

  return conflicts;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Checks if a conflict is already present in the list (same blocked/blocking pair) */
function isDuplicateConflict(
  existing: AccessibilityConflict[],
  candidate: AccessibilityConflict
): boolean {
  return existing.some(
    c =>
      c.blockedItem === candidate.blockedItem &&
      c.blockingItem === candidate.blockingItem &&
      c.violationType === candidate.violationType
  );
}

/** Counts the number of unique affected stops across all conflicts */
function countAffectedStops(conflicts: AccessibilityConflict[]): number {
  const stops = new Set(conflicts.map(c => c.blockedStop));
  return stops.size;
}
