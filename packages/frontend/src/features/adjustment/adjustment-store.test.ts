// ─── Adjustment Store Unit Tests ─────────────────────────────────────────────
// Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
// Tests for the drag-and-drop adjustment interface logic including:
// - Drag-to-reposition in top-down view
// - Orientation toggle (longitudinal/transverse)
// - Position swap between two items
// - Item removal to unassigned list
// - Weight recalculation within 2 seconds of any adjustment
// - Rule re-evaluation and violation display
// - Hard constraint violation warnings with supervisor override

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import type {
  PlacedFreight,
  TrailerProfile,
  TractorProfile,
  EquipmentCombination,
  Rule,
  RuleResult,
} from '@ptv-discovery-coach/shared';
import { useAdjustmentStore } from './adjustment-store';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@ptv-discovery-coach/shared', async () => {
  const actual = await vi.importActual('@ptv-discovery-coach/shared');
  return {
    ...actual,
    calculateWeightMetrics: vi.fn(() => ({
      steerWeight: 12000,
      driveWeight: 28000,
      trailerWeight: 30000,
      totalGross: 70000,
      cgLongitudinal: 280,
      cgLateral: 0,
      maxConcentratedLoad: 350,
      perAxlePercentage: { steer: 60, drive: 82, trailer: 88 },
    })),
    evaluateAllRules: vi.fn(() => ({
      results: [],
      canApprove: true,
    })),
  };
});

import {
  calculateWeightMetrics,
  evaluateAllRules,
} from '@ptv-discovery-coach/shared';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function createTestTrailer(): TrailerProfile {
  return {
    id: 'trailer-1',
    name: 'Standard 53ft Flatbed',
    lengthFt: 53,
    deckWidthIn: 102,
    deckHeightIn: 60,
    maxGrossWeight: 80000,
    tareWeight: 15000,
    axleCount: 2,
    axlePositions: [480, 528],
    axleWeightRatings: [34000, 34000],
    kingpinPosition: 36,
    rearOverhangLimit: 48,
    deckMaterial: 'steel',
    stakePockets: [{ x: 48, y: -51 }, { x: 48, y: 51 }],
    anchorPoints: [{ x: 96, y: -48 }, { x: 96, y: 48 }],
    maxConcentratedLoadPSF: 500,
  };
}

function createTestTractor(): TractorProfile {
  return {
    id: 'tractor-1',
    name: 'Day Cab',
    steerAxleRating: 12000,
    driveAxleRating: 34000,
    fifthWheelPosition: 180,
    tareWeight: 18000,
    driveAxleCount: 2,
  };
}

function createTestEquipment(): EquipmentCombination {
  return {
    tractorId: 'tractor-1',
    trailerId: 'trailer-1',
    availablePayload: 47000,
    totalLegalGross: 80000,
    perAxleLimits: { steer: 12000, drive: 34000, trailer: 34000 },
  };
}

function createPlacedFreight(
  orderNumber: string,
  x: number,
  y: number,
  orientation: 'longitudinal' | 'transverse' = 'longitudinal'
): PlacedFreight {
  return {
    item: {
      orderNumber,
      customerName: 'Test Customer',
      deliveryStop: 1,
      productType: 'plate',
      quantity: 1,
      pieceWeight: 10000,
      dimensions: { length: 120, width: 48, height: 12 },
      totalLineWeight: 10000,
      handlingMethod: 'crane',
      stackPermission: 'yes',
      maxStackHeight: 60,
      maxStackWeight: 40000,
      orientationRequirement: 'any',
      dunnageRequired: false,
      specialNotes: '',
    },
    geometry: {
      type: 'rectangular',
      boundingBox: { length: 120, width: 48, height: 12 },
      contactFootprint: { area: 5760, shape: 'rectangle' },
      centerOfMass: { x: 60, y: 0, z: 6 },
    },
    position: { x, y, z: 0 },
    orientation,
    supportMethod: 'direct_to_deck',
    layer: 0,
  };
}

function createTestRules(): Rule[] {
  return [
    {
      id: 'axle-overweight',
      name: 'Axle Weight Limit',
      description: 'No axle group exceeds its legal weight rating',
      type: 'hard_constraint',
      isApplicable: () => true,
      evaluate: () => ({ passed: true, ruleId: 'axle-overweight', ruleType: 'hard_constraint', message: '', affectedItems: [], severity: 'error' }),
    },
    {
      id: 'cg-position',
      name: 'CG Position',
      description: 'CG between 40-50% of trailer length',
      type: 'soft_preference',
      isApplicable: () => true,
      evaluate: () => ({ passed: true, ruleId: 'cg-position', ruleType: 'soft_preference', message: '', affectedItems: [], severity: 'warning' }),
    },
  ];
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  // Reset store state
  useAdjustmentStore.setState({
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
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Helper: Initialize Store ────────────────────────────────────────────────

function initStore(items?: PlacedFreight[]) {
  const freight = items ?? [
    createPlacedFreight('ORD-001', 100, 0),
    createPlacedFreight('ORD-002', 250, -20),
  ];

  act(() => {
    useAdjustmentStore.getState().initialize({
      placedFreight: freight,
      trailer: createTestTrailer(),
      tractor: createTestTractor(),
      equipment: createTestEquipment(),
      rules: createTestRules(),
    });
  });

  // Flush the debounce timer for initial calculation
  act(() => { vi.advanceTimersByTime(200); });
}

// ─── Test Suite: Store Initialization ────────────────────────────────────────

describe('AdjustmentStore - Initialization', () => {
  it('sets placed freight and trailer on initialize', () => {
    initStore();
    const state = useAdjustmentStore.getState();

    expect(state.placedFreight).toHaveLength(2);
    expect(state._trailer).not.toBeNull();
    expect(state._trailer!.id).toBe('trailer-1');
  });

  it('resets all transient state on initialize', () => {
    initStore();
    const state = useAdjustmentStore.getState();

    expect(state.unassignedItems).toHaveLength(0);
    expect(state.mode).toBe('drag');
    expect(state.dragState).toBeNull();
    expect(state.swapSource).toBeNull();
    expect(state.selectedItemId).toBeNull();
    expect(state.overrides).toHaveLength(0);
  });

  it('triggers initial weight calculation and rule evaluation', () => {
    initStore();

    expect(calculateWeightMetrics).toHaveBeenCalled();
    expect(evaluateAllRules).toHaveBeenCalled();
  });

  it('sets weightMetrics after initial calculation completes', () => {
    initStore();
    const state = useAdjustmentStore.getState();

    expect(state.weightMetrics).not.toBeNull();
    expect(state.weightMetrics!.totalGross).toBe(70000);
  });
});

// ─── Test Suite: Drag-to-Reposition (Requirement 11.1) ──────────────────────

describe('AdjustmentStore - Drag-to-reposition', () => {
  it('startDrag sets dragState with item info and start position', () => {
    initStore();

    act(() => {
      useAdjustmentStore.getState().startDrag('ORD-001', { x: 100, y: 0 });
    });

    const state = useAdjustmentStore.getState();
    expect(state.dragState).not.toBeNull();
    expect(state.dragState!.itemId).toBe('ORD-001');
    expect(state.dragState!.startPosition).toEqual({ x: 100, y: 0 });
    expect(state.dragState!.originalItemPosition).toEqual({ x: 100, y: 0, z: 0 });
  });

  it('updateDrag updates currentPosition in dragState', () => {
    initStore();

    act(() => {
      useAdjustmentStore.getState().startDrag('ORD-001', { x: 100, y: 0 });
    });
    act(() => {
      useAdjustmentStore.getState().updateDrag({ x: 150, y: 10 });
    });

    const state = useAdjustmentStore.getState();
    expect(state.dragState!.currentPosition).toEqual({ x: 150, y: 10 });
  });

  it('endDrag moves item when displacement exceeds threshold (>5 inches)', () => {
    initStore();

    act(() => {
      useAdjustmentStore.getState().startDrag('ORD-001', { x: 100, y: 0 });
    });
    act(() => {
      useAdjustmentStore.getState().endDrag({ x: 130, y: 15 });
    });

    const state = useAdjustmentStore.getState();
    expect(state.dragState).toBeNull(); // drag ended
    const item = state.placedFreight.find((p) => p.item.orderNumber === 'ORD-001');
    // New position: original (100,0) + delta (30, 15)
    expect(item!.position.x).toBe(130);
    expect(item!.position.y).toBe(15);
  });

  it('endDrag does NOT move item when displacement is below threshold (≤5 inches)', () => {
    initStore();

    act(() => {
      useAdjustmentStore.getState().startDrag('ORD-001', { x: 100, y: 0 });
    });
    act(() => {
      useAdjustmentStore.getState().endDrag({ x: 103, y: 2 });
    });

    const state = useAdjustmentStore.getState();
    const item = state.placedFreight.find((p) => p.item.orderNumber === 'ORD-001');
    expect(item!.position.x).toBe(100); // unchanged
    expect(item!.position.y).toBe(0); // unchanged
  });

  it('cancelDrag clears dragState without moving item', () => {
    initStore();

    act(() => {
      useAdjustmentStore.getState().startDrag('ORD-001', { x: 100, y: 0 });
    });
    act(() => {
      useAdjustmentStore.getState().updateDrag({ x: 200, y: 30 });
    });
    act(() => {
      useAdjustmentStore.getState().cancelDrag();
    });

    const state = useAdjustmentStore.getState();
    expect(state.dragState).toBeNull();
    const item = state.placedFreight.find((p) => p.item.orderNumber === 'ORD-001');
    expect(item!.position.x).toBe(100); // unchanged
    expect(item!.position.y).toBe(0);
  });

  it('moveItem directly repositions an item at specified coordinates', () => {
    initStore();

    act(() => {
      useAdjustmentStore.getState().moveItem('ORD-002', { x: 300, y: 10 });
    });

    const state = useAdjustmentStore.getState();
    const item = state.placedFreight.find((p) => p.item.orderNumber === 'ORD-002');
    expect(item!.position.x).toBe(300);
    expect(item!.position.y).toBe(10);
  });

  it('startDrag does nothing for non-existent item', () => {
    initStore();

    act(() => {
      useAdjustmentStore.getState().startDrag('NON-EXISTENT', { x: 0, y: 0 });
    });

    expect(useAdjustmentStore.getState().dragState).toBeNull();
  });
});

// ─── Test Suite: Orientation Toggle (Requirement 11.2) ───────────────────────

describe('AdjustmentStore - Orientation toggle', () => {
  it('toggleOrientation switches from longitudinal to transverse', () => {
    initStore();

    const initialOrientation = useAdjustmentStore.getState()
      .placedFreight.find((p) => p.item.orderNumber === 'ORD-001')!.orientation;
    expect(initialOrientation).toBe('longitudinal');

    act(() => {
      useAdjustmentStore.getState().toggleOrientation('ORD-001');
    });

    const item = useAdjustmentStore.getState()
      .placedFreight.find((p) => p.item.orderNumber === 'ORD-001');
    expect(item!.orientation).toBe('transverse');
  });

  it('toggleOrientation switches from transverse back to longitudinal', () => {
    const freight = [createPlacedFreight('ORD-T1', 100, 0, 'transverse')];
    initStore(freight);

    act(() => {
      useAdjustmentStore.getState().toggleOrientation('ORD-T1');
    });

    const item = useAdjustmentStore.getState()
      .placedFreight.find((p) => p.item.orderNumber === 'ORD-T1');
    expect(item!.orientation).toBe('longitudinal');
  });

  it('toggleOrientation triggers recalculation', () => {
    initStore();
    vi.clearAllMocks();

    act(() => {
      useAdjustmentStore.getState().toggleOrientation('ORD-001');
    });
    act(() => { vi.advanceTimersByTime(200); });

    expect(calculateWeightMetrics).toHaveBeenCalled();
    expect(evaluateAllRules).toHaveBeenCalled();
  });
});

// ─── Test Suite: Position Swap (Requirement 11.3) ────────────────────────────

describe('AdjustmentStore - Position swap', () => {
  it('swapItems exchanges positions of two items', () => {
    initStore();

    const beforeA = useAdjustmentStore.getState()
      .placedFreight.find((p) => p.item.orderNumber === 'ORD-001')!.position;
    const beforeB = useAdjustmentStore.getState()
      .placedFreight.find((p) => p.item.orderNumber === 'ORD-002')!.position;

    act(() => {
      useAdjustmentStore.getState().swapItems('ORD-001', 'ORD-002');
    });

    const afterA = useAdjustmentStore.getState()
      .placedFreight.find((p) => p.item.orderNumber === 'ORD-001')!.position;
    const afterB = useAdjustmentStore.getState()
      .placedFreight.find((p) => p.item.orderNumber === 'ORD-002')!.position;

    expect(afterA.x).toBe(beforeB.x);
    expect(afterA.y).toBe(beforeB.y);
    expect(afterB.x).toBe(beforeA.x);
    expect(afterB.y).toBe(beforeA.y);
  });

  it('swapItems clears swapSource and resets mode to drag', () => {
    initStore();

    act(() => { useAdjustmentStore.getState().setMode('swap'); });
    act(() => { useAdjustmentStore.getState().selectForSwap('ORD-001'); });
    act(() => { useAdjustmentStore.getState().selectForSwap('ORD-002'); });

    const state = useAdjustmentStore.getState();
    expect(state.swapSource).toBeNull();
    expect(state.mode).toBe('drag');
  });

  it('selectForSwap sets swapSource on first selection', () => {
    initStore();

    act(() => { useAdjustmentStore.getState().setMode('swap'); });
    act(() => { useAdjustmentStore.getState().selectForSwap('ORD-001'); });

    expect(useAdjustmentStore.getState().swapSource).toBe('ORD-001');
  });

  it('selectForSwap triggers swap on second selection with different item', () => {
    initStore();

    act(() => { useAdjustmentStore.getState().setMode('swap'); });
    act(() => { useAdjustmentStore.getState().selectForSwap('ORD-001'); });
    act(() => { useAdjustmentStore.getState().selectForSwap('ORD-002'); });

    // Positions should be swapped
    const a = useAdjustmentStore.getState()
      .placedFreight.find((p) => p.item.orderNumber === 'ORD-001');
    expect(a!.position.x).toBe(250); // ORD-002's original position
  });

  it('selectForSwap does nothing when selecting same item twice', () => {
    initStore();

    act(() => { useAdjustmentStore.getState().setMode('swap'); });
    act(() => { useAdjustmentStore.getState().selectForSwap('ORD-001'); });
    act(() => { useAdjustmentStore.getState().selectForSwap('ORD-001'); });

    // swapSource should still be set (no swap executed)
    expect(useAdjustmentStore.getState().swapSource).toBe('ORD-001');
  });

  it('cancelSwap clears swapSource', () => {
    initStore();

    act(() => { useAdjustmentStore.getState().setMode('swap'); });
    act(() => { useAdjustmentStore.getState().selectForSwap('ORD-001'); });
    act(() => { useAdjustmentStore.getState().cancelSwap(); });

    expect(useAdjustmentStore.getState().swapSource).toBeNull();
  });
});

// ─── Test Suite: Item Removal (Requirement 11.4) ─────────────────────────────

describe('AdjustmentStore - Item removal to unassigned list', () => {
  it('removeItem moves item from placedFreight to unassignedItems', () => {
    initStore();

    act(() => {
      useAdjustmentStore.getState().removeItem('ORD-001');
    });

    const state = useAdjustmentStore.getState();
    expect(state.placedFreight).toHaveLength(1);
    expect(state.unassignedItems).toHaveLength(1);
    expect(state.unassignedItems[0].item.orderNumber).toBe('ORD-001');
  });

  it('removeItem clears selectedItemId', () => {
    initStore();

    act(() => { useAdjustmentStore.getState().selectItem('ORD-001'); });
    act(() => { useAdjustmentStore.getState().removeItem('ORD-001'); });

    expect(useAdjustmentStore.getState().selectedItemId).toBeNull();
  });

  it('removeItem preserves all item properties in unassigned list', () => {
    initStore();

    const originalItem = useAdjustmentStore.getState()
      .placedFreight.find((p) => p.item.orderNumber === 'ORD-001')!;

    act(() => {
      useAdjustmentStore.getState().removeItem('ORD-001');
    });

    const unassigned = useAdjustmentStore.getState().unassignedItems[0];
    expect(unassigned.item).toEqual(originalItem.item);
    expect(unassigned.geometry).toEqual(originalItem.geometry);
    expect(unassigned.orientation).toEqual(originalItem.orientation);
  });

  it('restoreItem moves item back from unassigned to placedFreight', () => {
    initStore();

    act(() => { useAdjustmentStore.getState().removeItem('ORD-001'); });
    act(() => { useAdjustmentStore.getState().restoreItem('ORD-001'); });

    const state = useAdjustmentStore.getState();
    expect(state.placedFreight).toHaveLength(2);
    expect(state.unassignedItems).toHaveLength(0);
  });

  it('removeItem does nothing for non-existent item', () => {
    initStore();

    act(() => {
      useAdjustmentStore.getState().removeItem('NON-EXISTENT');
    });

    const state = useAdjustmentStore.getState();
    expect(state.placedFreight).toHaveLength(2);
    expect(state.unassignedItems).toHaveLength(0);
  });

  it('restoreItem does nothing for non-existent item', () => {
    initStore();

    act(() => {
      useAdjustmentStore.getState().restoreItem('NON-EXISTENT');
    });

    const state = useAdjustmentStore.getState();
    expect(state.placedFreight).toHaveLength(2);
    expect(state.unassignedItems).toHaveLength(0);
  });
});

// ─── Test Suite: Weight Recalculation (Requirement 11.5) ─────────────────────

describe('AdjustmentStore - Weight recalculation within 2 seconds', () => {
  it('sets isRecalculating=true immediately after an adjustment', () => {
    initStore();
    vi.clearAllMocks();

    act(() => {
      useAdjustmentStore.getState().moveItem('ORD-001', { x: 200, y: 10 });
    });

    // Before timer fires, isRecalculating should be true
    expect(useAdjustmentStore.getState().isRecalculating).toBe(true);
  });

  it('completes recalculation within debounce period (150ms << 2s)', () => {
    initStore();
    vi.clearAllMocks();

    act(() => {
      useAdjustmentStore.getState().moveItem('ORD-001', { x: 200, y: 10 });
    });

    act(() => { vi.advanceTimersByTime(150); });

    const state = useAdjustmentStore.getState();
    expect(state.isRecalculating).toBe(false);
    expect(state.lastRecalculatedAt).not.toBeNull();
    expect(calculateWeightMetrics).toHaveBeenCalled();
  });

  it('debounces rapid successive adjustments', () => {
    initStore();
    vi.clearAllMocks();

    // Perform multiple adjustments in quick succession
    act(() => { useAdjustmentStore.getState().moveItem('ORD-001', { x: 110, y: 0 }); });
    act(() => { vi.advanceTimersByTime(50); });
    act(() => { useAdjustmentStore.getState().moveItem('ORD-001', { x: 120, y: 0 }); });
    act(() => { vi.advanceTimersByTime(50); });
    act(() => { useAdjustmentStore.getState().moveItem('ORD-001', { x: 130, y: 0 }); });

    // Only the last timer should fire
    act(() => { vi.advanceTimersByTime(150); });

    // calculateWeightMetrics should have been called only once after final debounce
    // (3 calls scheduled, but debounced to 1)
    expect(calculateWeightMetrics).toHaveBeenCalledTimes(1);
  });

  it('recalculation triggers on removeItem', () => {
    initStore();
    vi.clearAllMocks();

    act(() => { useAdjustmentStore.getState().removeItem('ORD-001'); });
    act(() => { vi.advanceTimersByTime(200); });

    expect(calculateWeightMetrics).toHaveBeenCalled();
  });

  it('recalculation triggers on swapItems', () => {
    initStore();
    vi.clearAllMocks();

    act(() => { useAdjustmentStore.getState().swapItems('ORD-001', 'ORD-002'); });
    act(() => { vi.advanceTimersByTime(200); });

    expect(calculateWeightMetrics).toHaveBeenCalled();
  });

  it('recalculation triggers on restoreItem', () => {
    initStore();
    act(() => { useAdjustmentStore.getState().removeItem('ORD-001'); });
    act(() => { vi.advanceTimersByTime(200); });
    vi.clearAllMocks();

    act(() => { useAdjustmentStore.getState().restoreItem('ORD-001'); });
    act(() => { vi.advanceTimersByTime(200); });

    expect(calculateWeightMetrics).toHaveBeenCalled();
  });
});

// ─── Test Suite: Rule Re-evaluation (Requirement 11.6) ───────────────────────

describe('AdjustmentStore - Rule re-evaluation after adjustment', () => {
  it('evaluates all rules after a move adjustment', () => {
    initStore();
    vi.clearAllMocks();

    act(() => { useAdjustmentStore.getState().moveItem('ORD-001', { x: 500, y: 0 }); });
    act(() => { vi.advanceTimersByTime(200); });

    expect(evaluateAllRules).toHaveBeenCalled();
  });

  it('stores rule results in state', () => {
    const mockResults: RuleResult[] = [
      {
        passed: false,
        ruleId: 'cg-position',
        ruleType: 'soft_preference',
        severity: 'warning',
        message: 'Center of gravity is outside optimal range (52% from kingpin)',
        affectedItems: ['ORD-001'],
        suggestedAction: 'Move heavy items toward center of trailer',
      },
    ];
    vi.mocked(evaluateAllRules).mockReturnValueOnce({ results: mockResults, canApprove: true });

    initStore();
    vi.clearAllMocks();

    vi.mocked(evaluateAllRules).mockReturnValueOnce({ results: mockResults, canApprove: true });

    act(() => { useAdjustmentStore.getState().moveItem('ORD-001', { x: 500, y: 0 }); });
    act(() => { vi.advanceTimersByTime(200); });

    const state = useAdjustmentStore.getState();
    expect(state.ruleResults).toHaveLength(1);
    expect(state.ruleResults[0].ruleId).toBe('cg-position');
    expect(state.ruleResults[0].message).toContain('Center of gravity');
  });

  it('updates canApprove based on rule evaluation', () => {
    initStore();
    vi.clearAllMocks();

    vi.mocked(evaluateAllRules).mockReturnValueOnce({
      results: [{
        passed: false,
        ruleId: 'axle-overweight',
        ruleType: 'hard_constraint',
        severity: 'error',
        message: 'Trailer axle group exceeds rating by 2,000 lbs',
        affectedItems: ['ORD-001'],
      }],
      canApprove: false,
    });

    act(() => { useAdjustmentStore.getState().moveItem('ORD-001', { x: 600, y: 0 }); });
    act(() => { vi.advanceTimersByTime(200); });

    expect(useAdjustmentStore.getState().canApprove).toBe(false);
  });
});

// ─── Test Suite: Supervisor Override (Requirement 11.7) ──────────────────────

describe('AdjustmentStore - Hard constraint violation supervisor override', () => {
  it('addOverride appends to overrides list', () => {
    initStore();

    act(() => {
      useAdjustmentStore.getState().addOverride({
        ruleId: 'axle-overweight',
        acknowledgedBy: 'John Supervisor',
        acknowledgedAt: new Date('2024-01-15T10:00:00Z'),
        reason: 'Load will travel short distance on private road',
      });
    });

    const state = useAdjustmentStore.getState();
    expect(state.overrides).toHaveLength(1);
    expect(state.overrides[0].ruleId).toBe('axle-overweight');
    expect(state.overrides[0].acknowledgedBy).toBe('John Supervisor');
    expect(state.overrides[0].reason).toContain('private road');
  });

  it('multiple overrides can be accumulated', () => {
    initStore();

    act(() => {
      useAdjustmentStore.getState().addOverride({
        ruleId: 'axle-overweight',
        acknowledgedBy: 'Supervisor A',
        acknowledgedAt: new Date(),
        reason: 'Reason 1',
      });
    });
    act(() => {
      useAdjustmentStore.getState().addOverride({
        ruleId: 'concentrated-load',
        acknowledgedBy: 'Supervisor B',
        acknowledgedAt: new Date(),
        reason: 'Reason 2',
      });
    });

    expect(useAdjustmentStore.getState().overrides).toHaveLength(2);
  });
});

// ─── Test Suite: Mode Switching ──────────────────────────────────────────────

describe('AdjustmentStore - Mode control', () => {
  it('setMode changes interaction mode', () => {
    initStore();

    act(() => { useAdjustmentStore.getState().setMode('swap'); });
    expect(useAdjustmentStore.getState().mode).toBe('swap');

    act(() => { useAdjustmentStore.getState().setMode('select'); });
    expect(useAdjustmentStore.getState().mode).toBe('select');

    act(() => { useAdjustmentStore.getState().setMode('drag'); });
    expect(useAdjustmentStore.getState().mode).toBe('drag');
  });

  it('setMode clears swapSource and selectedItemId', () => {
    initStore();

    act(() => { useAdjustmentStore.getState().setMode('swap'); });
    act(() => { useAdjustmentStore.getState().selectForSwap('ORD-001'); });
    act(() => { useAdjustmentStore.getState().setMode('drag'); });

    const state = useAdjustmentStore.getState();
    expect(state.swapSource).toBeNull();
    expect(state.selectedItemId).toBeNull();
  });
});

// ─── Test Suite: Selection ───────────────────────────────────────────────────

describe('AdjustmentStore - Selection', () => {
  it('selectItem sets selectedItemId', () => {
    initStore();

    act(() => { useAdjustmentStore.getState().selectItem('ORD-001'); });
    expect(useAdjustmentStore.getState().selectedItemId).toBe('ORD-001');
  });

  it('selectItem with null clears selection', () => {
    initStore();

    act(() => { useAdjustmentStore.getState().selectItem('ORD-001'); });
    act(() => { useAdjustmentStore.getState().selectItem(null); });
    expect(useAdjustmentStore.getState().selectedItemId).toBeNull();
  });
});
