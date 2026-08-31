// ─── OptiFlow Flatbed Steel Load Planner — Multi-Load Manual Reassignment ───
// Provides logic for manually moving items between trailers in a multi-load set
// and recalculating weight metrics for all affected trailers.

import type {
  EquipmentCombination,
  PlacedFreight,
  TractorProfile,
  TrailerProfile,
} from './types';
import type { WeightMetrics } from './weight';
import { calculateWeightMetrics } from './weight';
import type { MultiLoadSummary, TrailerAssignment } from './multi-load';

// ─── Reassignment Types ──────────────────────────────────────────────────────

/** A single trailer's state in a multi-load set */
export interface TrailerLoadState {
  /** Zero-based trailer index */
  trailerIndex: number;
  /** Items currently placed on this trailer */
  placedFreight: PlacedFreight[];
  /** Weight metrics for this trailer's current load */
  weightMetrics: WeightMetrics;
}

/** The complete multi-load set state for reassignment purposes */
export interface MultiLoadSetState {
  /** States for each trailer in the set */
  trailers: TrailerLoadState[];
  /** Items not assigned to any trailer */
  unassignedItems: PlacedFreight[];
  /** The trailer profile (same for all trailers in the set) */
  trailer: TrailerProfile;
  /** The tractor profile */
  tractor: TractorProfile;
  /** The equipment combination */
  equipment: EquipmentCombination;
}

/** Result of a reassignment operation */
export interface ReassignmentResult {
  /** Whether the reassignment was successful */
  success: boolean;
  /** Updated trailer states (with recalculated metrics) */
  trailers: TrailerLoadState[];
  /** Updated unassigned items */
  unassignedItems: PlacedFreight[];
  /** Error message if the reassignment failed */
  error?: string;
  /** Indices of trailers whose metrics changed */
  affectedTrailerIndices: number[];
}

/** Describes a reassignment operation */
export interface ReassignmentAction {
  /** Order number of the item to move */
  itemId: string;
  /** Index of the source trailer (-1 for unassigned pool) */
  sourceTrailerIndex: number;
  /** Index of the destination trailer (-1 for unassigned pool) */
  destinationTrailerIndex: number;
}

// ─── Reassignment Logic ──────────────────────────────────────────────────────

/**
 * Finds which trailer an item is currently on (or -1 if unassigned).
 */
export function findItemTrailer(
  itemId: string,
  state: MultiLoadSetState
): number {
  for (const trailer of state.trailers) {
    if (trailer.placedFreight.some((pf) => pf.item.orderNumber === itemId)) {
      return trailer.trailerIndex;
    }
  }
  if (state.unassignedItems.some((pf) => pf.item.orderNumber === itemId)) {
    return -1;
  }
  return -1;
}

/**
 * Reassigns an item from one trailer to another in the multi-load set.
 *
 * After the reassignment, weight metrics are recalculated for ALL affected
 * trailers (both source and destination).
 *
 * @param action - The reassignment action describing what to move and where
 * @param state - The current multi-load set state
 * @returns Updated state with recalculated weight metrics for affected trailers
 */
export function reassignItem(
  action: ReassignmentAction,
  state: MultiLoadSetState
): ReassignmentResult {
  const { itemId, sourceTrailerIndex, destinationTrailerIndex } = action;

  // Validate: source and destination must be different
  if (sourceTrailerIndex === destinationTrailerIndex) {
    return {
      success: false,
      trailers: state.trailers,
      unassignedItems: state.unassignedItems,
      error: 'Source and destination trailers are the same.',
      affectedTrailerIndices: [],
    };
  }

  // Find the item to move
  let itemToMove: PlacedFreight | undefined;

  if (sourceTrailerIndex === -1) {
    // Item is in unassigned pool
    itemToMove = state.unassignedItems.find((pf) => pf.item.orderNumber === itemId);
  } else {
    // Item is on a trailer
    const sourceTrailer = state.trailers.find((t) => t.trailerIndex === sourceTrailerIndex);
    if (!sourceTrailer) {
      return {
        success: false,
        trailers: state.trailers,
        unassignedItems: state.unassignedItems,
        error: `Source trailer index ${sourceTrailerIndex} not found.`,
        affectedTrailerIndices: [],
      };
    }
    itemToMove = sourceTrailer.placedFreight.find((pf) => pf.item.orderNumber === itemId);
  }

  if (!itemToMove) {
    return {
      success: false,
      trailers: state.trailers,
      unassignedItems: state.unassignedItems,
      error: `Item "${itemId}" not found on source trailer ${sourceTrailerIndex}.`,
      affectedTrailerIndices: [],
    };
  }

  // Validate destination exists
  if (destinationTrailerIndex !== -1) {
    const destTrailer = state.trailers.find((t) => t.trailerIndex === destinationTrailerIndex);
    if (!destTrailer) {
      return {
        success: false,
        trailers: state.trailers,
        unassignedItems: state.unassignedItems,
        error: `Destination trailer index ${destinationTrailerIndex} not found.`,
        affectedTrailerIndices: [],
      };
    }
  }

  // Perform the reassignment
  const updatedTrailers = state.trailers.map((t) => ({
    ...t,
    placedFreight: [...t.placedFreight],
  }));
  let updatedUnassigned = [...state.unassignedItems];
  const affectedTrailerIndices: number[] = [];

  // Remove from source
  if (sourceTrailerIndex === -1) {
    updatedUnassigned = updatedUnassigned.filter((pf) => pf.item.orderNumber !== itemId);
  } else {
    const sourceIdx = updatedTrailers.findIndex((t) => t.trailerIndex === sourceTrailerIndex);
    updatedTrailers[sourceIdx] = {
      ...updatedTrailers[sourceIdx],
      placedFreight: updatedTrailers[sourceIdx].placedFreight.filter(
        (pf) => pf.item.orderNumber !== itemId
      ),
    };
    affectedTrailerIndices.push(sourceTrailerIndex);
  }

  // Add to destination
  if (destinationTrailerIndex === -1) {
    updatedUnassigned.push(itemToMove);
  } else {
    const destIdx = updatedTrailers.findIndex((t) => t.trailerIndex === destinationTrailerIndex);
    updatedTrailers[destIdx] = {
      ...updatedTrailers[destIdx],
      placedFreight: [...updatedTrailers[destIdx].placedFreight, itemToMove],
    };
    affectedTrailerIndices.push(destinationTrailerIndex);
  }

  // Recalculate weight metrics for ALL affected trailers
  const { trailer, tractor, equipment } = state;
  const recalculatedTrailers = updatedTrailers.map((t) => {
    if (affectedTrailerIndices.includes(t.trailerIndex)) {
      const newMetrics = calculateWeightMetrics(t.placedFreight, equipment, trailer, tractor);
      return { ...t, weightMetrics: newMetrics };
    }
    return t;
  });

  return {
    success: true,
    trailers: recalculatedTrailers,
    unassignedItems: updatedUnassigned,
    affectedTrailerIndices,
  };
}

/**
 * Performs a batch reassignment of multiple items between trailers.
 * Each action is applied sequentially, and metrics are recalculated after all moves.
 *
 * @param actions - Array of reassignment actions to perform
 * @param state - The current multi-load set state
 * @returns Final updated state with recalculated metrics for all affected trailers
 */
export function batchReassignItems(
  actions: ReassignmentAction[],
  state: MultiLoadSetState
): ReassignmentResult {
  if (actions.length === 0) {
    return {
      success: true,
      trailers: state.trailers,
      unassignedItems: state.unassignedItems,
      affectedTrailerIndices: [],
    };
  }

  let currentState = { ...state };
  const allAffectedIndices = new Set<number>();
  const errors: string[] = [];

  // Apply each action sequentially (without recalculating metrics between steps)
  for (const action of actions) {
    const { itemId, sourceTrailerIndex, destinationTrailerIndex } = action;

    if (sourceTrailerIndex === destinationTrailerIndex) {
      errors.push(`Item "${itemId}": source and destination are the same.`);
      continue;
    }

    // Find the item
    let itemToMove: PlacedFreight | undefined;

    if (sourceTrailerIndex === -1) {
      itemToMove = currentState.unassignedItems.find((pf) => pf.item.orderNumber === itemId);
    } else {
      const sourceTrailer = currentState.trailers.find((t) => t.trailerIndex === sourceTrailerIndex);
      itemToMove = sourceTrailer?.placedFreight.find((pf) => pf.item.orderNumber === itemId);
    }

    if (!itemToMove) {
      errors.push(`Item "${itemId}" not found on source trailer ${sourceTrailerIndex}.`);
      continue;
    }

    // Remove from source
    if (sourceTrailerIndex === -1) {
      currentState = {
        ...currentState,
        unassignedItems: currentState.unassignedItems.filter(
          (pf) => pf.item.orderNumber !== itemId
        ),
      };
    } else {
      currentState = {
        ...currentState,
        trailers: currentState.trailers.map((t) =>
          t.trailerIndex === sourceTrailerIndex
            ? { ...t, placedFreight: t.placedFreight.filter((pf) => pf.item.orderNumber !== itemId) }
            : t
        ),
      };
      allAffectedIndices.add(sourceTrailerIndex);
    }

    // Add to destination
    if (destinationTrailerIndex === -1) {
      currentState = {
        ...currentState,
        unassignedItems: [...currentState.unassignedItems, itemToMove],
      };
    } else {
      currentState = {
        ...currentState,
        trailers: currentState.trailers.map((t) =>
          t.trailerIndex === destinationTrailerIndex
            ? { ...t, placedFreight: [...t.placedFreight, itemToMove!] }
            : t
        ),
      };
      allAffectedIndices.add(destinationTrailerIndex);
    }
  }

  // Recalculate weight metrics for all affected trailers at once
  const { trailer, tractor, equipment } = state;
  const affectedArray = [...allAffectedIndices];

  const recalculatedTrailers = currentState.trailers.map((t) => {
    if (allAffectedIndices.has(t.trailerIndex)) {
      const newMetrics = calculateWeightMetrics(t.placedFreight, equipment, trailer, tractor);
      return { ...t, weightMetrics: newMetrics };
    }
    return t;
  });

  return {
    success: errors.length === 0,
    trailers: recalculatedTrailers,
    unassignedItems: currentState.unassignedItems,
    error: errors.length > 0 ? errors.join('; ') : undefined,
    affectedTrailerIndices: affectedArray,
  };
}

/**
 * Builds a MultiLoadSummary from the current multi-load set state.
 * Useful for generating the master summary view after reassignment.
 */
export function buildMultiLoadSummaryFromState(state: MultiLoadSetState): MultiLoadSummary {
  const assignments: TrailerAssignment[] = state.trailers.map((t) => ({
    trailerIndex: t.trailerIndex,
    items: t.placedFreight.map((pf) => pf.item),
    totalWeight: t.placedFreight.reduce(
      (sum, pf) => sum + pf.item.pieceWeight * pf.item.quantity,
      0
    ),
    estimatedDeckArea: t.placedFreight.reduce(
      (sum, pf) => sum + pf.geometry.boundingBox.length * pf.geometry.boundingBox.width,
      0
    ),
  }));

  const totalFreightWeight = state.trailers.reduce(
    (sum, t) => sum + t.placedFreight.reduce(
      (tSum, pf) => tSum + pf.item.pieceWeight * pf.item.quantity,
      0
    ),
    0
  ) + state.unassignedItems.reduce(
    (sum, pf) => sum + pf.item.pieceWeight * pf.item.quantity,
    0
  );

  // Determine stop integrity: check if any stop has items across multiple trailers
  const stopToTrailers = new Map<number, Set<number>>();
  for (const t of state.trailers) {
    for (const pf of t.placedFreight) {
      const stops = stopToTrailers.get(pf.item.deliveryStop) ?? new Set<number>();
      stops.add(t.trailerIndex);
      stopToTrailers.set(pf.item.deliveryStop, stops);
    }
  }

  const splitStops: number[] = [];
  for (const [stop, trailers] of stopToTrailers) {
    if (trailers.size > 1) {
      splitStops.push(stop);
    }
  }

  return {
    trailerCount: state.trailers.length,
    assignments,
    unplaceableItems: [],
    totalFreightWeight,
    stopIntegrityPreserved: splitStops.length === 0,
    splitStops,
  };
}
