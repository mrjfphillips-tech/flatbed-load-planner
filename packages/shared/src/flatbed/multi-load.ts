// ─── OptiFlow Flatbed Steel Load Planner — Multi-Load Splitting ──────────────
// Detects when freight exceeds single-trailer capacity and splits across multiple
// load plans preserving delivery stop integrity.

import type {
  EquipmentCombination,
  SteelOrderLineItem,
  TrailerProfile,
} from './types';
import type { PlanRequest, PlanResult } from './planner';
import { generateLoadPlan } from './planner';

// ─── Multi-Load Types ────────────────────────────────────────────────────────

/** Reason an item could not be placed on any trailer */
export interface UnplaceableReason {
  /** The item that could not be placed */
  item: SteelOrderLineItem;
  /** The specific constraint that prevented placement */
  constraint: string;
  /** Human-readable explanation of why placement failed */
  explanation: string;
  /** Suggested corrective actions */
  suggestions: string[];
}

/** Assignment of items to a specific trailer/load */
export interface TrailerAssignment {
  /** Zero-based trailer index within the multi-load set */
  trailerIndex: number;
  /** Items assigned to this trailer */
  items: SteelOrderLineItem[];
  /** Total weight of items assigned to this trailer */
  totalWeight: number;
  /** Estimated deck area usage in square inches */
  estimatedDeckArea: number;
}

/** Master summary showing item-to-trailer assignments */
export interface MultiLoadSummary {
  /** Total number of trailers needed */
  trailerCount: number;
  /** Per-trailer assignment details */
  assignments: TrailerAssignment[];
  /** Items that could not be placed on any trailer */
  unplaceableItems: UnplaceableReason[];
  /** Total weight across all trailers */
  totalFreightWeight: number;
  /** Whether stop integrity was fully preserved (all items for each stop on same trailer) */
  stopIntegrityPreserved: boolean;
  /** Stops that had to be split across trailers (when physically impossible to keep together) */
  splitStops: number[];
}

/** Result of multi-load plan generation */
export interface MultiLoadResult {
  /** Whether at least one load was successfully generated */
  success: boolean;
  /** Individual load plans (one per trailer) */
  loads: PlanResult[];
  /** Master summary of assignments */
  summary: MultiLoadSummary;
  /** Whether the freight required splitting (false = single trailer was sufficient) */
  wasSplit: boolean;
}

// ─── Capacity Detection ──────────────────────────────────────────────────────

/**
 * Determines whether the given freight exceeds a single trailer's capacity.
 *
 * Checks both weight and volume (deck area) constraints:
 * - Weight: total freight weight > available payload
 * - Volume: estimated deck area > available deck area
 *
 * @param items - All freight items to check
 * @param equipment - The tractor-trailer combination
 * @param trailer - The trailer profile
 * @returns Object indicating whether splitting is needed and the reason
 */
export function detectCapacityExceedance(
  items: SteelOrderLineItem[],
  equipment: EquipmentCombination,
  trailer: TrailerProfile
): { exceedsCapacity: boolean; weightExceeded: boolean; volumeExceeded: boolean; totalWeight: number; availablePayload: number; totalArea: number; availableArea: number } {
  const totalWeight = items.reduce(
    (sum, item) => sum + item.pieceWeight * item.quantity,
    0
  );

  const availablePayload = equipment.availablePayload;

  // Estimate deck area needed: sum of each item's footprint (length × width)
  // This is a rough estimate — actual placement may be more or less efficient
  const totalArea = items.reduce(
    (sum, item) => sum + item.dimensions.length * item.dimensions.width,
    0
  );

  const availableArea = trailer.lengthFt * 12 * trailer.deckWidthIn;

  return {
    exceedsCapacity: totalWeight > availablePayload || totalArea > availableArea,
    weightExceeded: totalWeight > availablePayload,
    volumeExceeded: totalArea > availableArea,
    totalWeight,
    availablePayload,
    totalArea,
    availableArea,
  };
}

// ─── Stop-Based Item Grouping ────────────────────────────────────────────────

/**
 * Groups items by their delivery stop number.
 * Items for the same stop should stay on the same trailer when possible.
 *
 * @param items - All freight items
 * @returns Map of stop number to items for that stop
 */
export function groupItemsByStop(items: SteelOrderLineItem[]): Map<number, SteelOrderLineItem[]> {
  const groups = new Map<number, SteelOrderLineItem[]>();

  for (const item of items) {
    const existing = groups.get(item.deliveryStop) ?? [];
    existing.push(item);
    groups.set(item.deliveryStop, existing);
  }

  return groups;
}

/**
 * Calculates the total weight of a group of items.
 */
function groupWeight(items: SteelOrderLineItem[]): number {
  return items.reduce((sum, item) => sum + item.pieceWeight * item.quantity, 0);
}

/**
 * Calculates the estimated deck area for a group of items.
 */
function groupArea(items: SteelOrderLineItem[]): number {
  return items.reduce(
    (sum, item) => sum + item.dimensions.length * item.dimensions.width,
    0
  );
}

// ─── Splitting Algorithm ─────────────────────────────────────────────────────

/**
 * Checks if a single item exceeds trailer capacity on its own.
 * Such items are unplaceable regardless of load splitting.
 */
function isItemUnplaceable(
  item: SteelOrderLineItem,
  equipment: EquipmentCombination,
  trailer: TrailerProfile
): UnplaceableReason | null {
  const itemWeight = item.pieceWeight * item.quantity;
  const itemArea = item.dimensions.length * item.dimensions.width;
  const availableArea = trailer.lengthFt * 12 * trailer.deckWidthIn;

  if (itemWeight > equipment.availablePayload) {
    return {
      item,
      constraint: 'weight_exceeds_payload',
      explanation: `Item ${item.orderNumber} weighs ${itemWeight} lbs which exceeds the trailer's available payload of ${equipment.availablePayload} lbs.`,
      suggestions: [
        'Use a trailer with higher payload capacity',
        'Split the quantity across multiple line items',
        'Reduce item quantity if possible',
      ],
    };
  }

  if (item.dimensions.length > trailer.lengthFt * 12) {
    return {
      item,
      constraint: 'length_exceeds_trailer',
      explanation: `Item ${item.orderNumber} is ${item.dimensions.length}" long which exceeds the trailer length of ${trailer.lengthFt * 12}".`,
      suggestions: [
        'Use a longer trailer (53-foot)',
        'Check if item can be oriented transversely',
        'Consider specialized over-length transport',
      ],
    };
  }

  if (item.dimensions.width > trailer.deckWidthIn) {
    return {
      item,
      constraint: 'width_exceeds_deck',
      explanation: `Item ${item.orderNumber} is ${item.dimensions.width}" wide which exceeds the deck width of ${trailer.deckWidthIn}".`,
      suggestions: [
        'Check if item can be oriented longitudinally',
        'Use a wider trailer or specialized transport',
      ],
    };
  }

  if (itemArea > availableArea) {
    return {
      item,
      constraint: 'area_exceeds_deck',
      explanation: `Item ${item.orderNumber} footprint (${itemArea} sq in) exceeds available deck area (${availableArea} sq in).`,
      suggestions: [
        'Use a larger trailer',
        'Check if item can be placed with a different orientation',
      ],
    };
  }

  return null;
}

/**
 * Splits freight into multiple trailer loads using a first-fit-decreasing bin-packing
 * approach that respects delivery stop integrity.
 *
 * Algorithm:
 * 1. Filter out individually unplaceable items
 * 2. Group remaining items by delivery stop
 * 3. Sort stop groups by weight (heaviest first — first-fit-decreasing)
 * 4. For each stop group, try to fit it on an existing trailer
 * 5. If it doesn't fit, open a new trailer
 * 6. If a stop group itself exceeds capacity, split it by individual items
 *
 * @param items - All freight items to distribute
 * @param equipment - The tractor-trailer combination
 * @param trailer - The trailer profile (assumed same for all trailers)
 * @returns Array of item groups (one per trailer) plus unplaceable items
 */
export function splitFreightAcrossTrailers(
  items: SteelOrderLineItem[],
  equipment: EquipmentCombination,
  trailer: TrailerProfile
): { trailerLoads: SteelOrderLineItem[][]; unplaceable: UnplaceableReason[]; splitStops: number[] } {
  const unplaceable: UnplaceableReason[] = [];
  const placeableItems: SteelOrderLineItem[] = [];

  // Step 1: Filter out individually unplaceable items
  for (const item of items) {
    const reason = isItemUnplaceable(item, equipment, trailer);
    if (reason) {
      unplaceable.push(reason);
    } else {
      placeableItems.push(item);
    }
  }

  // Step 2: Group by delivery stop
  const stopGroups = groupItemsByStop(placeableItems);

  // Step 3: Sort stop groups by total weight (heaviest first for better bin packing)
  const sortedStops = [...stopGroups.entries()].sort(
    (a, b) => groupWeight(b[1]) - groupWeight(a[1])
  );

  // Step 4: Bin-packing with stop integrity
  const trailerLoads: SteelOrderLineItem[][] = [];
  const trailerWeights: number[] = [];
  const trailerAreas: number[] = [];
  const splitStops: number[] = [];

  const maxPayload = equipment.availablePayload;
  const maxArea = trailer.lengthFt * 12 * trailer.deckWidthIn;

  // Use conservative capacity limits (85% of max) to account for placement inefficiency
  const effectivePayload = maxPayload * 0.85;
  const effectiveArea = maxArea * 0.85;

  for (const [stopNum, stopItems] of sortedStops) {
    const stopWeight = groupWeight(stopItems);
    const stopArea = groupArea(stopItems);

    // Check if the whole stop group exceeds single-trailer capacity
    if (stopWeight > effectivePayload || stopArea > effectiveArea) {
      // Must split this stop's items across trailers
      splitStops.push(stopNum);

      // Sort items within the stop by weight descending for better packing
      const sortedItems = [...stopItems].sort(
        (a, b) => (b.pieceWeight * b.quantity) - (a.pieceWeight * a.quantity)
      );

      for (const item of sortedItems) {
        const itemWeight = item.pieceWeight * item.quantity;
        const itemArea = item.dimensions.length * item.dimensions.width;
        let placed = false;

        // Try to fit on existing trailers
        for (let t = 0; t < trailerLoads.length; t++) {
          if (
            trailerWeights[t] + itemWeight <= effectivePayload &&
            trailerAreas[t] + itemArea <= effectiveArea
          ) {
            trailerLoads[t].push(item);
            trailerWeights[t] += itemWeight;
            trailerAreas[t] += itemArea;
            placed = true;
            break;
          }
        }

        // Open new trailer if no existing one has room
        if (!placed) {
          trailerLoads.push([item]);
          trailerWeights.push(itemWeight);
          trailerAreas.push(itemArea);
        }
      }
    } else {
      // Try to fit the whole stop group on an existing trailer
      let placed = false;

      for (let t = 0; t < trailerLoads.length; t++) {
        if (
          trailerWeights[t] + stopWeight <= effectivePayload &&
          trailerAreas[t] + stopArea <= effectiveArea
        ) {
          trailerLoads[t].push(...stopItems);
          trailerWeights[t] += stopWeight;
          trailerAreas[t] += stopArea;
          placed = true;
          break;
        }
      }

      // Open new trailer if no existing one has room
      if (!placed) {
        trailerLoads.push([...stopItems]);
        trailerWeights.push(stopWeight);
        trailerAreas.push(stopArea);
      }
    }
  }

  return { trailerLoads, unplaceable, splitStops };
}

// ─── Multi-Load Plan Generation ──────────────────────────────────────────────

/**
 * Generates a multi-load plan when freight exceeds single-trailer capacity.
 *
 * This is the main entry point for multi-load splitting. It:
 * 1. Detects whether splitting is needed
 * 2. If not needed, delegates to single-load generateLoadPlan
 * 3. If needed, splits freight across trailers preserving stop integrity
 * 4. Generates individual load plans for each trailer
 * 5. Produces a master summary with item-to-trailer assignments
 * 6. Reports unplaceable items with constraint details and suggestions
 *
 * @param request - The plan request (same as generateLoadPlan)
 * @returns MultiLoadResult with individual plans and master summary
 */
export function generateMultiLoadPlan(request: PlanRequest): MultiLoadResult {
  const { items, trailer, tractor, equipment, rules, patternOverride } = request;

  // Check if splitting is needed
  const capacityCheck = detectCapacityExceedance(items, equipment, trailer);

  if (!capacityCheck.exceedsCapacity) {
    // Single trailer is sufficient — use the standard planner
    const singlePlan = generateLoadPlan(request);

    // If the single plan has unplaced items, we might still need splitting
    if (singlePlan.unplacedItems.length === 0) {
      return {
        success: singlePlan.success,
        loads: [singlePlan],
        summary: buildSummary([singlePlan], items, []),
        wasSplit: false,
      };
    }

    // Some items didn't fit even though capacity wasn't exceeded on paper —
    // this can happen due to geometric constraints. Fall through to splitting.
  }

  // Split freight across trailers
  const { trailerLoads, unplaceable, splitStops } = splitFreightAcrossTrailers(
    items,
    equipment,
    trailer
  );

  // Generate a load plan for each trailer
  const loads: PlanResult[] = [];
  const additionalUnplaceable: UnplaceableReason[] = [];

  for (const loadItems of trailerLoads) {
    const loadRequest: PlanRequest = {
      items: loadItems,
      trailer,
      tractor,
      equipment,
      rules,
      patternOverride,
    };

    const plan = generateLoadPlan(loadRequest);
    loads.push(plan);

    // If this sub-plan still has unplaced items, report them
    for (const unplacedItem of plan.unplacedItems) {
      additionalUnplaceable.push({
        item: unplacedItem,
        constraint: 'placement_failed',
        explanation: `Item ${unplacedItem.orderNumber} could not be placed due to geometric or stacking constraints even after load splitting.`,
        suggestions: [
          'Try a different orientation for this item',
          'Check if stacking permissions can be relaxed',
          'Consider using a larger trailer',
          'Review items at the same stop for conflicts',
        ],
      });
    }
  }

  const allUnplaceable = [...unplaceable, ...additionalUnplaceable];

  // Build the master summary
  const summary = buildSummaryFromSplit(
    loads,
    trailerLoads,
    allUnplaceable,
    items,
    splitStops
  );

  return {
    success: loads.some((plan) => plan.success),
    loads,
    summary,
    wasSplit: loads.length > 1,
  };
}

// ─── Summary Builders ────────────────────────────────────────────────────────

/**
 * Builds a master summary for a single-load (non-split) result.
 */
function buildSummary(
  loads: PlanResult[],
  originalItems: SteelOrderLineItem[],
  unplaceable: UnplaceableReason[]
): MultiLoadSummary {
  const assignments: TrailerAssignment[] = loads.map((plan, idx) => ({
    trailerIndex: idx,
    items: plan.placedFreight.map((pf) => pf.item),
    totalWeight: plan.placedFreight.reduce(
      (sum, pf) => sum + pf.item.pieceWeight * pf.item.quantity,
      0
    ),
    estimatedDeckArea: plan.placedFreight.reduce(
      (sum, pf) => sum + pf.geometry.boundingBox.length * pf.geometry.boundingBox.width,
      0
    ),
  }));

  const totalFreightWeight = originalItems.reduce(
    (sum, item) => sum + item.pieceWeight * item.quantity,
    0
  );

  return {
    trailerCount: loads.length,
    assignments,
    unplaceableItems: unplaceable,
    totalFreightWeight,
    stopIntegrityPreserved: true,
    splitStops: [],
  };
}

/**
 * Builds a master summary for a multi-load (split) result.
 */
function buildSummaryFromSplit(
  _loads: PlanResult[],
  trailerLoads: SteelOrderLineItem[][],
  unplaceable: UnplaceableReason[],
  originalItems: SteelOrderLineItem[],
  splitStops: number[]
): MultiLoadSummary {
  const assignments: TrailerAssignment[] = trailerLoads.map((loadItems, idx) => ({
    trailerIndex: idx,
    items: loadItems,
    totalWeight: groupWeight(loadItems),
    estimatedDeckArea: groupArea(loadItems),
  }));

  const totalFreightWeight = originalItems.reduce(
    (sum, item) => sum + item.pieceWeight * item.quantity,
    0
  );

  return {
    trailerCount: trailerLoads.length,
    assignments,
    unplaceableItems: unplaceable,
    totalFreightWeight,
    stopIntegrityPreserved: splitStops.length === 0,
    splitStops,
  };
}
