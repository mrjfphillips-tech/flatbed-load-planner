// ─── Fleet Store Unit Tests ──────────────────────────────────────────────────
// Tests for fleet store actions and state transitions.
// Validates: Requirements 6.1, 6.2, 5.3

import { describe, it, expect, beforeEach } from 'vitest';
import { useFleetStore } from './fleet-store';
import type { VehicleRecord, FleetFileValidationError, UnmatchedOrder, FleetPlanResult, ExtractionRule } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeVehicleRecord(overrides: Partial<VehicleRecord> = {}): VehicleRecord {
  return {
    vehicleId: 'VH-001',
    vehicleType: 'Camión',
    licensePlate: 'ABC-123',
    weightCapacity: 30,
    platformLength: 13.5,
    platformWidth: 2.6,
    conditionCode: 'ZN',
    status: 'active',
    ...overrides,
  };
}

function makeFleetPlanResult(): FleetPlanResult {
  return {
    vehicles: [
      {
        vehicleId: 'VH-001',
        licensePlate: 'ABC-123',
        vehicleType: 'Camión',
        conditionCode: 'ZN',
        status: 'success',
        planResult: null,
        assignedOrders: [],
      },
    ],
    unmatchedOrders: [],
    summary: {
      totalVehicles: 1,
      successCount: 1,
      partialCount: 0,
      failedCount: 0,
      totalOrdersPlaced: 5,
      totalOrdersUnplaced: 0,
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('fleet-store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useFleetStore.getState().resetFleetWizard();
    useFleetStore.setState({ mode: 'single' });
  });

  // ─── setMode ─────────────────────────────────────────────────────────────

  describe('setMode', () => {
    it('sets mode to fleet', () => {
      useFleetStore.getState().setMode('fleet');
      expect(useFleetStore.getState().mode).toBe('fleet');
    });

    it('sets mode to single', () => {
      useFleetStore.getState().setMode('fleet');
      useFleetStore.getState().setMode('single');
      expect(useFleetStore.getState().mode).toBe('single');
    });

    it('defaults to single mode', () => {
      expect(useFleetStore.getState().mode).toBe('single');
    });
  });

  // ─── setVehicleRecords ───────────────────────────────────────────────────

  describe('setVehicleRecords', () => {
    it('sets vehicle records array', () => {
      const records = [makeVehicleRecord(), makeVehicleRecord({ vehicleId: 'VH-002' })];
      useFleetStore.getState().setVehicleRecords(records);
      expect(useFleetStore.getState().vehicleRecords).toHaveLength(2);
      expect(useFleetStore.getState().vehicleRecords[0].vehicleId).toBe('VH-001');
      expect(useFleetStore.getState().vehicleRecords[1].vehicleId).toBe('VH-002');
    });

    it('replaces existing records', () => {
      useFleetStore.getState().setVehicleRecords([makeVehicleRecord()]);
      useFleetStore.getState().setVehicleRecords([makeVehicleRecord({ vehicleId: 'NEW' })]);
      expect(useFleetStore.getState().vehicleRecords).toHaveLength(1);
      expect(useFleetStore.getState().vehicleRecords[0].vehicleId).toBe('NEW');
    });

    it('can set an empty array', () => {
      useFleetStore.getState().setVehicleRecords([makeVehicleRecord()]);
      useFleetStore.getState().setVehicleRecords([]);
      expect(useFleetStore.getState().vehicleRecords).toHaveLength(0);
    });
  });

  // ─── Navigation: goToStep ────────────────────────────────────────────────

  describe('goToStep', () => {
    it('navigates to step 1', () => {
      useFleetStore.getState().goToStep(2);
      useFleetStore.getState().goToStep(1);
      expect(useFleetStore.getState().currentStep).toBe(1);
    });

    it('navigates to step 2', () => {
      useFleetStore.getState().goToStep(2);
      expect(useFleetStore.getState().currentStep).toBe(2);
    });

    it('navigates to step 3', () => {
      useFleetStore.getState().goToStep(3);
      expect(useFleetStore.getState().currentStep).toBe(3);
    });

    it('navigates to step 4', () => {
      useFleetStore.getState().goToStep(4);
      expect(useFleetStore.getState().currentStep).toBe(4);
    });

    it('ignores invalid step below range', () => {
      useFleetStore.getState().goToStep(2);
      useFleetStore.getState().goToStep(0 as any);
      expect(useFleetStore.getState().currentStep).toBe(2);
    });

    it('ignores invalid step above range', () => {
      useFleetStore.getState().goToStep(3);
      useFleetStore.getState().goToStep(5 as any);
      expect(useFleetStore.getState().currentStep).toBe(3);
    });
  });

  // ─── Navigation: nextStep ────────────────────────────────────────────────

  describe('nextStep', () => {
    it('advances from step 1 to step 2', () => {
      expect(useFleetStore.getState().currentStep).toBe(1);
      useFleetStore.getState().nextStep();
      expect(useFleetStore.getState().currentStep).toBe(2);
    });

    it('advances from step 2 to step 3', () => {
      useFleetStore.getState().goToStep(2);
      useFleetStore.getState().nextStep();
      expect(useFleetStore.getState().currentStep).toBe(3);
    });

    it('advances from step 3 to step 4', () => {
      useFleetStore.getState().goToStep(3);
      useFleetStore.getState().nextStep();
      expect(useFleetStore.getState().currentStep).toBe(4);
    });

    it('does not advance past step 4', () => {
      useFleetStore.getState().goToStep(4);
      useFleetStore.getState().nextStep();
      expect(useFleetStore.getState().currentStep).toBe(4);
    });
  });

  // ─── Navigation: previousStep ───────────────────────────────────────────

  describe('previousStep', () => {
    it('goes back from step 2 to step 1', () => {
      useFleetStore.getState().goToStep(2);
      useFleetStore.getState().previousStep();
      expect(useFleetStore.getState().currentStep).toBe(1);
    });

    it('goes back from step 4 to step 3', () => {
      useFleetStore.getState().goToStep(4);
      useFleetStore.getState().previousStep();
      expect(useFleetStore.getState().currentStep).toBe(3);
    });

    it('does not go below step 1', () => {
      expect(useFleetStore.getState().currentStep).toBe(1);
      useFleetStore.getState().previousStep();
      expect(useFleetStore.getState().currentStep).toBe(1);
    });
  });

  // ─── canProceedFromStep ──────────────────────────────────────────────────

  describe('canProceedFromStep', () => {
    it('cannot proceed from step 1 with no vehicle records', () => {
      expect(useFleetStore.getState().canProceedFromStep(1)).toBe(false);
    });

    it('can proceed from step 1 with at least one vehicle record', () => {
      useFleetStore.getState().setVehicleRecords([makeVehicleRecord()]);
      expect(useFleetStore.getState().canProceedFromStep(1)).toBe(true);
    });

    it('cannot proceed from step 2 with empty orders map', () => {
      expect(useFleetStore.getState().canProceedFromStep(2)).toBe(false);
    });

    it('can proceed from step 2 with orders by delivery number', () => {
      const ordersMap = new Map([['DN-001', []]]);
      useFleetStore.getState().setOrdersByDeliveryNumber(ordersMap);
      expect(useFleetStore.getState().canProceedFromStep(2)).toBe(true);
    });

    it('cannot proceed from step 3 with no active rules', () => {
      expect(useFleetStore.getState().canProceedFromStep(3)).toBe(false);
    });

    it('can proceed from step 3 with active rules', () => {
      useFleetStore.getState().setActiveRules([{ id: 'rule1' } as any]);
      expect(useFleetStore.getState().canProceedFromStep(3)).toBe(true);
    });

    it('cannot proceed from step 4 with no plan result', () => {
      expect(useFleetStore.getState().canProceedFromStep(4)).toBe(false);
    });

    it('can proceed from step 4 with plan result', () => {
      useFleetStore.getState().setFleetPlanResult(makeFleetPlanResult());
      expect(useFleetStore.getState().canProceedFromStep(4)).toBe(true);
    });

    it('returns false for invalid step numbers', () => {
      expect(useFleetStore.getState().canProceedFromStep(0 as any)).toBe(false);
      expect(useFleetStore.getState().canProceedFromStep(5 as any)).toBe(false);
    });
  });

  // ─── resetFleetWizard ────────────────────────────────────────────────────

  describe('resetFleetWizard', () => {
    it('resets all fleet wizard state to defaults', () => {
      // Set up some state
      useFleetStore.getState().setVehicleRecords([makeVehicleRecord()]);
      useFleetStore.getState().setFleetFileErrors([{ row: 1, field: 'vehicleId', value: '', message: 'Missing' }]);
      useFleetStore.getState().goToStep(3);
      useFleetStore.getState().setFleetPlanResult(makeFleetPlanResult());
      useFleetStore.getState().selectVehicle('VH-001');
      useFleetStore.getState().setDeliveryNumberMatchStrategy('pattern');

      // Reset
      useFleetStore.getState().resetFleetWizard();

      const state = useFleetStore.getState();
      expect(state.vehicleRecords).toHaveLength(0);
      expect(state.fleetFileErrors).toHaveLength(0);
      expect(state.fleetFieldMappings).toHaveLength(0);
      expect(state.ordersByDeliveryNumber.size).toBe(0);
      expect(state.unmatchedOrders).toHaveLength(0);
      expect(state.deliveryNumberMatchStrategy).toBe('exact');
      expect(state.customExtractionRule).toBeUndefined();
      expect(state.activeRules).toHaveLength(0);
      expect(state.fleetPlanResult).toBeNull();
      expect(state.selectedVehicleId).toBeNull();
      expect(state.isGenerating).toBe(false);
      expect(state.generationProgress).toEqual({ completed: 0, total: 0 });
      expect(state.currentStep).toBe(1);
    });

    it('does not reset mode', () => {
      useFleetStore.getState().setMode('fleet');
      useFleetStore.getState().resetFleetWizard();
      expect(useFleetStore.getState().mode).toBe('fleet');
    });
  });

  // ─── Other Actions ───────────────────────────────────────────────────────

  describe('other state actions', () => {
    it('setFleetFileErrors stores validation errors', () => {
      const errors: FleetFileValidationError[] = [
        { row: 1, field: 'vehicleId', value: '', message: 'Missing vehicle ID' },
        { row: 3, field: 'weightCapacity', value: -5, message: 'Must be positive' },
      ];
      useFleetStore.getState().setFleetFileErrors(errors);
      expect(useFleetStore.getState().fleetFileErrors).toHaveLength(2);
      expect(useFleetStore.getState().fleetFileErrors[0].row).toBe(1);
    });

    it('setUnmatchedOrders stores unmatched order list', () => {
      const unmatched: UnmatchedOrder[] = [
        { orderNumber: 'ORD-001', deliveryNumber: 'UNKNOWN', reason: 'no_vehicle_match' },
      ];
      useFleetStore.getState().setUnmatchedOrders(unmatched);
      expect(useFleetStore.getState().unmatchedOrders).toHaveLength(1);
      expect(useFleetStore.getState().unmatchedOrders[0].reason).toBe('no_vehicle_match');
    });

    it('setDeliveryNumberMatchStrategy updates strategy', () => {
      useFleetStore.getState().setDeliveryNumberMatchStrategy('custom');
      expect(useFleetStore.getState().deliveryNumberMatchStrategy).toBe('custom');
    });

    it('setCustomExtractionRule stores rule', () => {
      const rule: ExtractionRule = { type: 'delimiter', delimiter: '-', fieldIndex: 1 };
      useFleetStore.getState().setCustomExtractionRule(rule);
      expect(useFleetStore.getState().customExtractionRule).toEqual(rule);
    });

    it('selectVehicle sets selectedVehicleId', () => {
      useFleetStore.getState().selectVehicle('VH-002');
      expect(useFleetStore.getState().selectedVehicleId).toBe('VH-002');
    });

    it('setFleetPlanResult stores result and stops generating', () => {
      useFleetStore.getState().setIsGenerating(true);
      useFleetStore.getState().setFleetPlanResult(makeFleetPlanResult());
      expect(useFleetStore.getState().fleetPlanResult).not.toBeNull();
      expect(useFleetStore.getState().isGenerating).toBe(false);
    });

    it('setIsGenerating toggles generation flag', () => {
      useFleetStore.getState().setIsGenerating(true);
      expect(useFleetStore.getState().isGenerating).toBe(true);
      useFleetStore.getState().setIsGenerating(false);
      expect(useFleetStore.getState().isGenerating).toBe(false);
    });

    it('setGenerationProgress updates progress', () => {
      useFleetStore.getState().setGenerationProgress({ completed: 3, total: 10 });
      expect(useFleetStore.getState().generationProgress).toEqual({ completed: 3, total: 10 });
    });
  });
});
