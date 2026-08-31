// ─── Multi-Load Manual Reassignment Zustand Store ───────────────────────────
// Manages state for reassigning items between trailers in a multi-load set.
// Recalculates weight metrics for all affected trailers on each reassignment.

import { create } from 'zustand';
import type {
  EquipmentCombination,
  PlacedFreight,
  Rule,
  RuleResult,
  TractorProfile,
  TrailerProfile,
  RuleContext,
  MultiLoadSummary,
  TrailerLoadState,
  MultiLoadSetState,
  ReassignmentAction,
  ReassignmentResult,
} from '@ptv-discovery-coach/shared';
import {
  reassignItem,
  batchReassignItems,
  buildMultiLoadSummaryFromState,
  calculateWeightMetrics,
  evaluateAllRules,
} from '@ptv-discovery-coach/shared';

// ─── Store State ─────────────────────────────────────────────────────────────

export interface MultiLoadStoreState {
  /** All trailers in the multi-load set with their current freight and metrics */
  trailers: TrailerLoadState[];
  /** Items not assigned to any trailer */
  unassignedItems: PlacedFreight[];
  /** The currently selected/focused trailer index */
  activeTrailerIndex: number;
  /** Master summary of the multi-load set */
  summary: MultiLoadSummary | null;
  /** Whether a recalculation is in progress */
  isRecalculating: boolean;
  /** Rule evaluation results per trailer */
  ruleResultsByTrailer: Map<number, RuleResult[]>;
  /** Whether each trailer can be approved */
  canApproveByTrailer: Map<number, boolean>;
  /** History of reassignment actions for undo support */
  reassignmentHistory: ReassignmentAction[];
  /** Error from last reassignment attempt */
  lastError: string | null;
}

// ─── Store Actions ───────────────────────────────────────────────────────────

export interface MultiLoadStoreActions {
  /** Initialize the store with a multi-load plan result */
  initialize: (params: {
    trailerStates: TrailerLoadState[];
    unassignedItems: PlacedFreight[];
    trailer: TrailerProfile;
    tractor: TractorProfile;
    equipment: EquipmentCombination;
    rules: Rule[];
  }) => void;

  /** Set the currently focused trailer */
  setActiveTrailer: (trailerIndex: number) => void;

  /** Reassign a single item between trailers */
  reassignItemToTrailer: (
    itemId: string,
    sourceTrailerIndex: number,
    destinationTrailerIndex: number
  ) => ReassignmentResult;

  /** Reassign multiple items in batch */
  batchReassign: (actions: ReassignmentAction[]) => ReassignmentResult;

  /** Move an item from a trailer to the unassigned pool */
  unassignItem: (itemId: string, sourceTrailerIndex: number) => void;

  /** Move an item from the unassigned pool to a trailer */
  assignItem: (itemId: string, destinationTrailerIndex: number) => void;

  /** Clear error state */
  clearError: () => void;

  /** Get the current multi-load set state (for passing to shared logic) */
  getMultiLoadSetState: () => MultiLoadSetState | null;
}

export type MultiLoadStore = MultiLoadStoreState & MultiLoadStoreActions;

// ─── Configuration held outside state ────────────────────────────────────────

interface MultiLoadConfig {
  trailer: TrailerProfile | null;
  tractor: TractorProfile | null;
  equipment: EquipmentCombination | null;
  rules: Rule[];
}

let _multiLoadConfig: MultiLoadConfig = {
  trailer: null,
  tractor: null,
  equipment: null,
  rules: [],
};

// ─── Store Implementation ────────────────────────────────────────────────────

export const useMultiLoadStore = create<MultiLoadStore>()((set, get) => ({
  // Initial state
  trailers: [],
  unassignedItems: [],
  activeTrailerIndex: 0,
  summary: null,
  isRecalculating: false,
  ruleResultsByTrailer: new Map(),
  canApproveByTrailer: new Map(),
  reassignmentHistory: [],
  lastError: null,

  // ── Initialization ───────────────────────────────────────────────────────

  initialize: ({ trailerStates, unassignedItems, trailer, tractor, equipment, rules }) => {
    _multiLoadConfig = { trailer, tractor, equipment, rules };

    // Calculate initial weight metrics and rule evaluations for each trailer
    const ruleResultsByTrailer = new Map<number, RuleResult[]>();
    const canApproveByTrailer = new Map<number, boolean>();

    const initializedTrailers = trailerStates.map((t) => {
      const metrics = calculateWeightMetrics(t.placedFreight, equipment, trailer, tractor);

      // Evaluate rules for this trailer
      const context: RuleContext = {
        placedFreight: t.placedFreight,
        equipment,
        trailer,
        tractor,
        weightMetrics: metrics,
      };
      const { results, canApprove } = evaluateAllRules(rules, context);
      ruleResultsByTrailer.set(t.trailerIndex, results);
      canApproveByTrailer.set(t.trailerIndex, canApprove);

      return { ...t, weightMetrics: metrics };
    });

    const state: MultiLoadSetState = {
      trailers: initializedTrailers,
      unassignedItems,
      trailer,
      tractor,
      equipment,
    };

    const summary = buildMultiLoadSummaryFromState(state);

    set({
      trailers: initializedTrailers,
      unassignedItems,
      activeTrailerIndex: 0,
      summary,
      isRecalculating: false,
      ruleResultsByTrailer,
      canApproveByTrailer,
      reassignmentHistory: [],
      lastError: null,
    });
  },

  // ── Active Trailer ───────────────────────────────────────────────────────

  setActiveTrailer: (trailerIndex) => {
    set({ activeTrailerIndex: trailerIndex });
  },

  // ── Reassignment Operations ──────────────────────────────────────────────

  reassignItemToTrailer: (itemId, sourceTrailerIndex, destinationTrailerIndex) => {
    const currentState = get().getMultiLoadSetState();
    if (!currentState) {
      const failResult: ReassignmentResult = {
        success: false,
        trailers: get().trailers,
        unassignedItems: get().unassignedItems,
        error: 'Store not initialized.',
        affectedTrailerIndices: [],
      };
      return failResult;
    }

    const action: ReassignmentAction = { itemId, sourceTrailerIndex, destinationTrailerIndex };
    const result = reassignItem(action, currentState);

    if (result.success) {
      // Re-evaluate rules for affected trailers
      const { rules } = _multiLoadConfig;
      const ruleResultsByTrailer = new Map(get().ruleResultsByTrailer);
      const canApproveByTrailer = new Map(get().canApproveByTrailer);

      for (const idx of result.affectedTrailerIndices) {
        const trailer = result.trailers.find((t) => t.trailerIndex === idx);
        if (trailer && _multiLoadConfig.trailer && _multiLoadConfig.tractor && _multiLoadConfig.equipment) {
          const context: RuleContext = {
            placedFreight: trailer.placedFreight,
            equipment: _multiLoadConfig.equipment,
            trailer: _multiLoadConfig.trailer,
            tractor: _multiLoadConfig.tractor,
            weightMetrics: trailer.weightMetrics,
          };
          const { results, canApprove } = evaluateAllRules(rules, context);
          ruleResultsByTrailer.set(idx, results);
          canApproveByTrailer.set(idx, canApprove);
        }
      }

      // Build updated summary
      const updatedState: MultiLoadSetState = {
        trailers: result.trailers,
        unassignedItems: result.unassignedItems,
        trailer: _multiLoadConfig.trailer!,
        tractor: _multiLoadConfig.tractor!,
        equipment: _multiLoadConfig.equipment!,
      };
      const summary = buildMultiLoadSummaryFromState(updatedState);

      set({
        trailers: result.trailers,
        unassignedItems: result.unassignedItems,
        summary,
        ruleResultsByTrailer,
        canApproveByTrailer,
        reassignmentHistory: [...get().reassignmentHistory, action],
        lastError: null,
      });
    } else {
      set({ lastError: result.error ?? 'Reassignment failed.' });
    }

    return result;
  },

  batchReassign: (actions) => {
    const currentState = get().getMultiLoadSetState();
    if (!currentState) {
      const failResult: ReassignmentResult = {
        success: false,
        trailers: get().trailers,
        unassignedItems: get().unassignedItems,
        error: 'Store not initialized.',
        affectedTrailerIndices: [],
      };
      return failResult;
    }

    const result = batchReassignItems(actions, currentState);

    if (result.success || result.affectedTrailerIndices.length > 0) {
      // Re-evaluate rules for affected trailers
      const { rules } = _multiLoadConfig;
      const ruleResultsByTrailer = new Map(get().ruleResultsByTrailer);
      const canApproveByTrailer = new Map(get().canApproveByTrailer);

      for (const idx of result.affectedTrailerIndices) {
        const trailer = result.trailers.find((t) => t.trailerIndex === idx);
        if (trailer && _multiLoadConfig.trailer && _multiLoadConfig.tractor && _multiLoadConfig.equipment) {
          const context: RuleContext = {
            placedFreight: trailer.placedFreight,
            equipment: _multiLoadConfig.equipment,
            trailer: _multiLoadConfig.trailer,
            tractor: _multiLoadConfig.tractor,
            weightMetrics: trailer.weightMetrics,
          };
          const { results, canApprove } = evaluateAllRules(rules, context);
          ruleResultsByTrailer.set(idx, results);
          canApproveByTrailer.set(idx, canApprove);
        }
      }

      const updatedState: MultiLoadSetState = {
        trailers: result.trailers,
        unassignedItems: result.unassignedItems,
        trailer: _multiLoadConfig.trailer!,
        tractor: _multiLoadConfig.tractor!,
        equipment: _multiLoadConfig.equipment!,
      };
      const summary = buildMultiLoadSummaryFromState(updatedState);

      set({
        trailers: result.trailers,
        unassignedItems: result.unassignedItems,
        summary,
        ruleResultsByTrailer,
        canApproveByTrailer,
        reassignmentHistory: [...get().reassignmentHistory, ...actions],
        lastError: result.error ?? null,
      });
    } else {
      set({ lastError: result.error ?? 'Batch reassignment failed.' });
    }

    return result;
  },

  unassignItem: (itemId, sourceTrailerIndex) => {
    get().reassignItemToTrailer(itemId, sourceTrailerIndex, -1);
  },

  assignItem: (itemId, destinationTrailerIndex) => {
    get().reassignItemToTrailer(itemId, -1, destinationTrailerIndex);
  },

  // ── Utilities ────────────────────────────────────────────────────────────

  clearError: () => {
    set({ lastError: null });
  },

  getMultiLoadSetState: (): MultiLoadSetState | null => {
    const { trailer, tractor, equipment } = _multiLoadConfig;
    if (!trailer || !tractor || !equipment) return null;

    const { trailers, unassignedItems } = get();
    return { trailers, unassignedItems, trailer, tractor, equipment };
  },
}));
