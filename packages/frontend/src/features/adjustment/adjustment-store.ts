// ─── Manual Load Adjustment Zustand Store ────────────────────────────────────
// Manages drag-and-drop state, weight recalculation, and rule re-evaluation
// after manual adjustments to the load plan.

import { create } from 'zustand';
import type {
  PlacedFreight,
  TrailerProfile,
  TractorProfile,
  EquipmentCombination,
  Rule,
  RuleContext,
} from '@ptv-discovery-coach/shared';
import {
  calculateWeightMetrics,
  evaluateAllRules,
} from '@ptv-discovery-coach/shared';
import type {
  AdjustmentState,
  InteractionMode,
  SupervisorOverride,
} from './types';

// ─── Store Interface (State + Actions) ───────────────────────────────────────

export interface AdjustmentStore extends AdjustmentState {
  // Exposed config (so child components can access the trailer)
  _trailer: TrailerProfile | null;

  // Initialization
  initialize: (params: {
    placedFreight: PlacedFreight[];
    trailer: TrailerProfile;
    tractor: TractorProfile;
    equipment: EquipmentCombination;
    rules: Rule[];
  }) => void;

  // Mode control
  setMode: (mode: InteractionMode) => void;

  // Drag operations
  startDrag: (itemId: string, startPosition: { x: number; y: number }) => void;
  updateDrag: (currentPosition: { x: number; y: number }) => void;
  endDrag: (finalPosition: { x: number; y: number }) => void;
  cancelDrag: () => void;

  // Item operations
  moveItem: (itemId: string, newPosition: { x: number; y: number }) => void;
  toggleOrientation: (itemId: string) => void;
  swapItems: (itemIdA: string, itemIdB: string) => void;
  removeItem: (itemId: string) => void;
  restoreItem: (itemId: string) => void;

  // Swap mode
  selectForSwap: (itemId: string) => void;
  cancelSwap: () => void;

  // Selection
  selectItem: (itemId: string | null) => void;

  // Supervisor override
  addOverride: (override: SupervisorOverride) => void;

  // Internal
  _recalculate: () => void;
}

// ─── Configuration held outside state ────────────────────────────────────────

interface AdjustmentConfig {
  trailer: TrailerProfile | null;
  tractor: TractorProfile | null;
  equipment: EquipmentCombination | null;
  rules: Rule[];
}

let _config: AdjustmentConfig = {
  trailer: null,
  tractor: null,
  equipment: null,
  rules: [],
};

// ─── Recalculation debounce ──────────────────────────────────────────────────

let _recalcTimer: ReturnType<typeof setTimeout> | null = null;
const RECALC_DEBOUNCE_MS = 150; // recalc within 150ms for <2s guarantee

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAdjustmentStore = create<AdjustmentStore>()((set, get) => ({
  // Initial state
  _trailer: null,
  placedFreight: [],
  unassignedItems: [],
  mode: 'drag',
  dragState: null,
  swapSource: null,
  selectedItemId: null,
  weightMetrics: null,
  ruleResults: [],
  canApprove: true,
  overrides: [],
  isRecalculating: false,
  lastRecalculatedAt: null,

  // ── Initialization ───────────────────────────────────────────────────────

  initialize: ({ placedFreight, trailer, tractor, equipment, rules }) => {
    _config = { trailer, tractor, equipment, rules };
    set({
      _trailer: trailer,
      placedFreight: [...placedFreight],
      unassignedItems: [],
      mode: 'drag',
      dragState: null,
      swapSource: null,
      selectedItemId: null,
      weightMetrics: null,
      ruleResults: [],
      canApprove: true,
      overrides: [],
      isRecalculating: false,
      lastRecalculatedAt: null,
    });
    // Run initial calculation
    get()._recalculate();
  },

  // ── Mode ─────────────────────────────────────────────────────────────────

  setMode: (mode) => {
    set({ mode, swapSource: null, selectedItemId: null });
  },

  // ── Drag Operations ──────────────────────────────────────────────────────

  startDrag: (itemId, startPosition) => {
    const { placedFreight } = get();
    const item = placedFreight.find((p) => p.item.orderNumber === itemId);
    if (!item) return;

    set({
      dragState: {
        itemId,
        startPosition,
        currentPosition: startPosition,
        originalItemPosition: { ...item.position },
      },
    });
  },

  updateDrag: (currentPosition) => {
    const { dragState } = get();
    if (!dragState) return;
    set({
      dragState: { ...dragState, currentPosition },
    });
  },

  endDrag: (finalPosition) => {
    const { dragState } = get();
    if (!dragState) return;

    // Calculate the delta from start to end in SVG coordinates
    const dx = finalPosition.x - dragState.startPosition.x;
    const dy = finalPosition.y - dragState.startPosition.y;

    // Only move if there was meaningful displacement (> 5 inches)
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      const newX = dragState.originalItemPosition.x + dx;
      const newY = dragState.originalItemPosition.y + dy;
      get().moveItem(dragState.itemId, { x: newX, y: newY });
    }

    set({ dragState: null });
  },

  cancelDrag: () => {
    set({ dragState: null });
  },

  // ── Item Operations ──────────────────────────────────────────────────────

  moveItem: (itemId, newPosition) => {
    set((state) => ({
      placedFreight: state.placedFreight.map((p) =>
        p.item.orderNumber === itemId
          ? { ...p, position: { ...p.position, x: newPosition.x, y: newPosition.y } }
          : p
      ),
    }));
    get()._recalculate();
  },

  toggleOrientation: (itemId) => {
    set((state) => ({
      placedFreight: state.placedFreight.map((p) =>
        p.item.orderNumber === itemId
          ? {
              ...p,
              orientation: p.orientation === 'longitudinal' ? 'transverse' : 'longitudinal',
            }
          : p
      ),
    }));
    get()._recalculate();
  },

  swapItems: (itemIdA, itemIdB) => {
    set((state) => {
      const itemA = state.placedFreight.find((p) => p.item.orderNumber === itemIdA);
      const itemB = state.placedFreight.find((p) => p.item.orderNumber === itemIdB);
      if (!itemA || !itemB) return state;

      return {
        placedFreight: state.placedFreight.map((p) => {
          if (p.item.orderNumber === itemIdA) {
            return { ...p, position: { ...itemB.position } };
          }
          if (p.item.orderNumber === itemIdB) {
            return { ...p, position: { ...itemA.position } };
          }
          return p;
        }),
        swapSource: null,
        mode: 'drag' as InteractionMode,
      };
    });
    get()._recalculate();
  },

  removeItem: (itemId) => {
    const { placedFreight } = get();
    const item = placedFreight.find((p) => p.item.orderNumber === itemId);
    if (!item) return;

    set((state) => ({
      placedFreight: state.placedFreight.filter((p) => p.item.orderNumber !== itemId),
      unassignedItems: [...state.unassignedItems, item],
      selectedItemId: null,
    }));
    get()._recalculate();
  },

  restoreItem: (itemId) => {
    const { unassignedItems } = get();
    const item = unassignedItems.find((p) => p.item.orderNumber === itemId);
    if (!item) return;

    set((state) => ({
      unassignedItems: state.unassignedItems.filter((p) => p.item.orderNumber !== itemId),
      placedFreight: [...state.placedFreight, item],
    }));
    get()._recalculate();
  },

  // ── Swap Mode ────────────────────────────────────────────────────────────

  selectForSwap: (itemId) => {
    const { swapSource } = get();
    if (!swapSource) {
      set({ swapSource: itemId });
    } else if (swapSource !== itemId) {
      get().swapItems(swapSource, itemId);
    }
  },

  cancelSwap: () => {
    set({ swapSource: null });
  },

  // ── Selection ────────────────────────────────────────────────────────────

  selectItem: (itemId) => {
    set({ selectedItemId: itemId });
  },

  // ── Supervisor Override ──────────────────────────────────────────────────

  addOverride: (override) => {
    set((state) => ({
      overrides: [...state.overrides, override],
    }));
  },

  // ── Internal Recalculation ───────────────────────────────────────────────

  _recalculate: () => {
    if (_recalcTimer) {
      clearTimeout(_recalcTimer);
    }

    set({ isRecalculating: true });

    _recalcTimer = setTimeout(() => {
      const { placedFreight } = get();
      const { trailer, tractor, equipment, rules } = _config;

      if (!trailer || !tractor || !equipment) {
        set({ isRecalculating: false });
        return;
      }

      // Calculate weight metrics
      const weightMetrics = calculateWeightMetrics(placedFreight, equipment, trailer, tractor);

      // Build rule context and evaluate
      const ruleContext: RuleContext = {
        placedFreight,
        equipment,
        trailer,
        tractor,
        weightMetrics,
      };

      const { results, canApprove } = evaluateAllRules(rules, ruleContext);

      set({
        weightMetrics,
        ruleResults: results,
        canApprove,
        isRecalculating: false,
        lastRecalculatedAt: Date.now(),
      });
    }, RECALC_DEBOUNCE_MS);
  },
}));
