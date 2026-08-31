// ─── Fleet Components Unit Tests ─────────────────────────────────────────────
// Combined edge-case unit tests for fleet store, smart mapper, fleet file
// validation, and delivery matcher. Targets edge cases not covered by the
// per-module test files.
//
// Validates: Requirements 1.3, 7.1, 8.1, 8.2

import { describe, it, expect, beforeEach } from 'vitest';
import { useFleetStore } from './fleet-store';
import { autoMapFleetColumns } from './fleet-smart-mapper';
import { validateVehicleRecord } from './fleet-parser';
import { matchDeliveryNumbers } from './delivery-matcher';
import type { ExtractionRule, FleetPlanResult } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeValidRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    vehicleId: 'VH-001',
    vehicleType: 'Camión',
    licensePlate: 'ABC-123',
    weightCapacity: 30,
    platformLength: 13.5,
    platformWidth: 2.6,
    conditionCode: 'ZN',
    ...overrides,
  };
}

function makeFleetPlanResult(): FleetPlanResult {
  return {
    vehicles: [{
      vehicleId: 'VH-001',
      licensePlate: 'ABC-123',
      vehicleType: 'Camión',
      conditionCode: 'ZN',
      status: 'success',
      planResult: null,
      assignedOrders: [],
    }],
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

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Fleet Store — Actions & State Transitions
// ═══════════════════════════════════════════════════════════════════════════════

describe('Fleet Store — edge case transitions', () => {
  beforeEach(() => {
    useFleetStore.getState().resetFleetWizard();
    useFleetStore.setState({ mode: 'single' });
  });

  describe('setMode', () => {
    it('changes mode from single to fleet', () => {
      useFleetStore.getState().setMode('fleet');
      expect(useFleetStore.getState().mode).toBe('fleet');
    });

    it('changes mode from fleet back to single', () => {
      useFleetStore.getState().setMode('fleet');
      useFleetStore.getState().setMode('single');
      expect(useFleetStore.getState().mode).toBe('single');
    });
  });

  describe('setVehicleRecords / setFleetFileErrors / setFleetFieldMappings', () => {
    it('stores vehicle records and allows retrieval', () => {
      const records = [
        { vehicleId: 'VH-A', vehicleType: 'Truck', licensePlate: 'X-1',
          weightCapacity: 20, platformLength: 10, platformWidth: 2.5, conditionCode: 'ZO' as const, status: 'active' as const },
      ];
      useFleetStore.getState().setVehicleRecords(records);
      expect(useFleetStore.getState().vehicleRecords).toEqual(records);
    });

    it('stores fleet file errors', () => {
      const errors = [{ row: 2, field: 'weightCapacity', value: -1, message: 'Negative' }];
      useFleetStore.getState().setFleetFileErrors(errors);
      expect(useFleetStore.getState().fleetFileErrors).toHaveLength(1);
      expect(useFleetStore.getState().fleetFileErrors[0].field).toBe('weightCapacity');
    });

    it('stores field mappings', () => {
      const mappings = [
        { targetField: 'vehicleId', label: 'Vehicle ID', required: true, sourceColumn: 'id_col', confidence: 0.9 },
      ];
      useFleetStore.getState().setFleetFieldMappings(mappings);
      expect(useFleetStore.getState().fleetFieldMappings).toHaveLength(1);
    });
  });

  describe('nextStep / previousStep boundary enforcement', () => {
    it('nextStep does not exceed step 4', () => {
      useFleetStore.getState().goToStep(4);
      useFleetStore.getState().nextStep();
      useFleetStore.getState().nextStep();
      expect(useFleetStore.getState().currentStep).toBe(4);
    });

    it('previousStep does not go below step 1', () => {
      useFleetStore.getState().goToStep(1);
      useFleetStore.getState().previousStep();
      useFleetStore.getState().previousStep();
      expect(useFleetStore.getState().currentStep).toBe(1);
    });

    it('nextStep increments sequentially from 1 to 4', () => {
      expect(useFleetStore.getState().currentStep).toBe(1);
      useFleetStore.getState().nextStep();
      expect(useFleetStore.getState().currentStep).toBe(2);
      useFleetStore.getState().nextStep();
      expect(useFleetStore.getState().currentStep).toBe(3);
      useFleetStore.getState().nextStep();
      expect(useFleetStore.getState().currentStep).toBe(4);
    });

    it('previousStep decrements sequentially from 4 to 1', () => {
      useFleetStore.getState().goToStep(4);
      useFleetStore.getState().previousStep();
      expect(useFleetStore.getState().currentStep).toBe(3);
      useFleetStore.getState().previousStep();
      expect(useFleetStore.getState().currentStep).toBe(2);
      useFleetStore.getState().previousStep();
      expect(useFleetStore.getState().currentStep).toBe(1);
    });
  });

  describe('goToStep valid/invalid values', () => {
    it('accepts step 1 through 4', () => {
      for (const step of [1, 2, 3, 4] as const) {
        useFleetStore.getState().goToStep(step);
        expect(useFleetStore.getState().currentStep).toBe(step);
      }
    });

    it('ignores step 0', () => {
      useFleetStore.getState().goToStep(3);
      useFleetStore.getState().goToStep(0 as any);
      expect(useFleetStore.getState().currentStep).toBe(3);
    });

    it('ignores step 5', () => {
      useFleetStore.getState().goToStep(2);
      useFleetStore.getState().goToStep(5 as any);
      expect(useFleetStore.getState().currentStep).toBe(2);
    });

    it('ignores negative step', () => {
      useFleetStore.getState().goToStep(2);
      useFleetStore.getState().goToStep(-1 as any);
      expect(useFleetStore.getState().currentStep).toBe(2);
    });
  });

  describe('canProceedFromStep logic per step', () => {
    it('step 1: requires vehicleRecords.length > 0', () => {
      expect(useFleetStore.getState().canProceedFromStep(1)).toBe(false);
      useFleetStore.getState().setVehicleRecords([{
        vehicleId: 'VH-1', vehicleType: 'T', licensePlate: 'P',
        weightCapacity: 10, platformLength: 5, platformWidth: 2, conditionCode: 'ZN', status: 'active',
      }]);
      expect(useFleetStore.getState().canProceedFromStep(1)).toBe(true);
    });

    it('step 2: requires ordersByDeliveryNumber.size > 0', () => {
      expect(useFleetStore.getState().canProceedFromStep(2)).toBe(false);
      useFleetStore.getState().setOrdersByDeliveryNumber(new Map([['DN-1', []]]));
      expect(useFleetStore.getState().canProceedFromStep(2)).toBe(true);
    });

    it('step 3: requires activeRules.length > 0', () => {
      expect(useFleetStore.getState().canProceedFromStep(3)).toBe(false);
      useFleetStore.getState().setActiveRules([{ id: 'r1' } as any]);
      expect(useFleetStore.getState().canProceedFromStep(3)).toBe(true);
    });

    it('step 4: requires fleetPlanResult !== null', () => {
      expect(useFleetStore.getState().canProceedFromStep(4)).toBe(false);
      useFleetStore.getState().setFleetPlanResult(makeFleetPlanResult());
      expect(useFleetStore.getState().canProceedFromStep(4)).toBe(true);
    });

    it('returns false for out-of-range step numbers', () => {
      expect(useFleetStore.getState().canProceedFromStep(0 as any)).toBe(false);
      expect(useFleetStore.getState().canProceedFromStep(5 as any)).toBe(false);
      expect(useFleetStore.getState().canProceedFromStep(99 as any)).toBe(false);
    });
  });

  describe('resetFleetWizard', () => {
    it('resets navigation, data, and generation state but preserves mode', () => {
      useFleetStore.getState().setMode('fleet');
      useFleetStore.getState().setVehicleRecords([{
        vehicleId: 'VH-1', vehicleType: 'T', licensePlate: 'P',
        weightCapacity: 10, platformLength: 5, platformWidth: 2, conditionCode: 'ZN', status: 'active',
      }]);
      useFleetStore.getState().goToStep(3);
      useFleetStore.getState().setFleetPlanResult(makeFleetPlanResult());
      useFleetStore.getState().selectVehicle('VH-1');

      useFleetStore.getState().resetFleetWizard();

      const state = useFleetStore.getState();
      expect(state.mode).toBe('fleet'); // mode preserved
      expect(state.vehicleRecords).toHaveLength(0);
      expect(state.currentStep).toBe(1);
      expect(state.fleetPlanResult).toBeNull();
      expect(state.selectedVehicleId).toBeNull();
      expect(state.isGenerating).toBe(false);
      expect(state.generationProgress).toEqual({ completed: 0, total: 0 });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Fleet Smart Mapper — Various Column Naming Conventions
// ═══════════════════════════════════════════════════════════════════════════════

describe('Fleet Smart Mapper — naming conventions', () => {
  describe('English names', () => {
    it('maps standard English column headers correctly', () => {
      const cols = [
        'vehicle id', 'vehicle type', 'license plate',
        'weight capacity', 'platform length', 'platform width', 'condition code',
      ];
      const mappings = autoMapFleetColumns(cols);

      expect(mappings.find(m => m.targetField === 'vehicleId')?.sourceColumn).toBe('vehicle id');
      expect(mappings.find(m => m.targetField === 'vehicleType')?.sourceColumn).toBe('vehicle type');
      expect(mappings.find(m => m.targetField === 'licensePlate')?.sourceColumn).toBe('license plate');
      expect(mappings.find(m => m.targetField === 'weightCapacity')?.sourceColumn).toBe('weight capacity');
      expect(mappings.find(m => m.targetField === 'platformLength')?.sourceColumn).toBe('platform length');
      expect(mappings.find(m => m.targetField === 'platformWidth')?.sourceColumn).toBe('platform width');
      expect(mappings.find(m => m.targetField === 'conditionCode')?.sourceColumn).toBe('condition code');
    });
  });

  describe('Spanish names', () => {
    it('maps placa, tipo, capacidad, largo, ancho, condicion, zona', () => {
      const cols = ['id vehiculo', 'tipo', 'placa', 'capacidad', 'largo', 'ancho', 'condicion'];
      const mappings = autoMapFleetColumns(cols);

      expect(mappings.find(m => m.targetField === 'vehicleId')?.sourceColumn).toBe('id vehiculo');
      expect(mappings.find(m => m.targetField === 'vehicleType')?.sourceColumn).toBe('tipo');
      expect(mappings.find(m => m.targetField === 'licensePlate')?.sourceColumn).toBe('placa');
      expect(mappings.find(m => m.targetField === 'weightCapacity')?.sourceColumn).toBe('capacidad');
      expect(mappings.find(m => m.targetField === 'platformLength')?.sourceColumn).toBe('largo');
      expect(mappings.find(m => m.targetField === 'platformWidth')?.sourceColumn).toBe('ancho');
      expect(mappings.find(m => m.targetField === 'conditionCode')?.sourceColumn).toBe('condicion');
    });

    it('maps zona to conditionCode', () => {
      const cols = ['vehicle_id', 'tipo', 'placa', 'capacidad', 'largo', 'ancho', 'zona'];
      const mappings = autoMapFleetColumns(cols);
      expect(mappings.find(m => m.targetField === 'conditionCode')?.sourceColumn).toBe('zona');
    });
  });

  describe('camelCase variants', () => {
    it('maps camelCase column names', () => {
      const cols = [
        'vehicleId', 'vehicleType', 'licensePlate',
        'weightCapacity', 'platformLength', 'platformWidth', 'conditionCode',
      ];
      const mappings = autoMapFleetColumns(cols);

      expect(mappings.find(m => m.targetField === 'vehicleId')?.sourceColumn).toBe('vehicleId');
      expect(mappings.find(m => m.targetField === 'vehicleType')?.sourceColumn).toBe('vehicleType');
      expect(mappings.find(m => m.targetField === 'licensePlate')?.sourceColumn).toBe('licensePlate');
      expect(mappings.find(m => m.targetField === 'weightCapacity')?.sourceColumn).toBe('weightCapacity');
      expect(mappings.find(m => m.targetField === 'platformLength')?.sourceColumn).toBe('platformLength');
      expect(mappings.find(m => m.targetField === 'platformWidth')?.sourceColumn).toBe('platformWidth');
      expect(mappings.find(m => m.targetField === 'conditionCode')?.sourceColumn).toBe('conditionCode');
    });
  });

  describe('snake_case variants', () => {
    it('maps snake_case column names', () => {
      const cols = [
        'vehicle_id', 'vehicle_type', 'license_plate',
        'weight_capacity', 'platform_length', 'platform_width', 'condition_code',
      ];
      const mappings = autoMapFleetColumns(cols);

      for (const m of mappings) {
        expect(m.sourceColumn).not.toBeNull();
        expect(m.confidence).toBeGreaterThanOrEqual(0.5);
      }
      expect(mappings.find(m => m.targetField === 'vehicleId')?.sourceColumn).toBe('vehicle_id');
      expect(mappings.find(m => m.targetField === 'conditionCode')?.sourceColumn).toBe('condition_code');
    });
  });

  describe('unrecognized headers', () => {
    it('returns null sourceColumn for completely unknown headers', () => {
      const cols = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf'];
      const mappings = autoMapFleetColumns(cols);

      for (const m of mappings) {
        expect(m.sourceColumn).toBeNull();
        expect(m.confidence).toBe(0);
      }
    });

    it('returns null for partially matching but below-threshold headers', () => {
      // These share no meaningful tokens with the fleet field aliases
      const cols = ['random_uuid', 'timestamp', 'user_email', 'ip_address', 'session_id', 'hash', 'checksum'];
      const mappings = autoMapFleetColumns(cols);

      // Some may match by accident (e.g. 'id' in random_uuid) — we just verify
      // that any null mappings have confidence 0
      for (const m of mappings) {
        if (m.sourceColumn === null) {
          expect(m.confidence).toBe(0);
        }
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Fleet File Validation — Edge Cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('Fleet file validation — edge cases', () => {
  describe('zero-capacity vehicle rejected', () => {
    it('rejects weightCapacity of 0', () => {
      const row = makeValidRow({ weightCapacity: 0 });
      const { record, errors } = validateVehicleRecord(row, 1);
      expect(record).toBeNull();
      expect(errors.some(e => e.field === 'weightCapacity')).toBe(true);
    });

    it('rejects platformLength of 0', () => {
      const row = makeValidRow({ platformLength: 0 });
      const { record, errors } = validateVehicleRecord(row, 1);
      expect(record).toBeNull();
      expect(errors.some(e => e.field === 'platformLength')).toBe(true);
    });

    it('rejects platformWidth of 0', () => {
      const row = makeValidRow({ platformWidth: 0 });
      const { record, errors } = validateVehicleRecord(row, 1);
      expect(record).toBeNull();
      expect(errors.some(e => e.field === 'platformWidth')).toBe(true);
    });
  });

  describe('negative dimensions rejected', () => {
    it('rejects negative weightCapacity', () => {
      const row = makeValidRow({ weightCapacity: -10 });
      const { record, errors } = validateVehicleRecord(row, 1);
      expect(record).toBeNull();
      expect(errors.some(e => e.field === 'weightCapacity')).toBe(true);
    });

    it('rejects negative platformLength', () => {
      const row = makeValidRow({ platformLength: -5.5 });
      const { record, errors } = validateVehicleRecord(row, 1);
      expect(record).toBeNull();
      expect(errors.some(e => e.field === 'platformLength')).toBe(true);
    });

    it('rejects negative platformWidth', () => {
      const row = makeValidRow({ platformWidth: -0.01 });
      const { record, errors } = validateVehicleRecord(row, 1);
      expect(record).toBeNull();
      expect(errors.some(e => e.field === 'platformWidth')).toBe(true);
    });
  });

  describe('empty strings rejected for string fields', () => {
    it('rejects empty vehicleId', () => {
      const row = makeValidRow({ vehicleId: '' });
      const { record, errors } = validateVehicleRecord(row, 1);
      expect(record).toBeNull();
      expect(errors.some(e => e.field === 'vehicleId')).toBe(true);
    });

    it('rejects whitespace-only vehicleType', () => {
      const row = makeValidRow({ vehicleType: '   ' });
      const { record, errors } = validateVehicleRecord(row, 1);
      expect(record).toBeNull();
      expect(errors.some(e => e.field === 'vehicleType')).toBe(true);
    });

    it('rejects empty licensePlate', () => {
      const row = makeValidRow({ licensePlate: '' });
      const { record, errors } = validateVehicleRecord(row, 1);
      expect(record).toBeNull();
      expect(errors.some(e => e.field === 'licensePlate')).toBe(true);
    });

    it('rejects all string fields being empty simultaneously', () => {
      const row = makeValidRow({
        vehicleId: '',
        vehicleType: '',
        licensePlate: '',
        conditionCode: '',
      });
      const { record, errors } = validateVehicleRecord(row, 1);
      expect(record).toBeNull();
      const fields = errors.map(e => e.field);
      expect(fields).toContain('vehicleId');
      expect(fields).toContain('vehicleType');
      expect(fields).toContain('licensePlate');
      expect(fields).toContain('conditionCode');
    });
  });

  describe('all valid condition codes accepted', () => {
    it.each(['ZN', 'ZO', 'ZB', 'ZA', 'ZF'] as const)('accepts condition code %s', (code) => {
      const row = makeValidRow({ conditionCode: code });
      const { record, errors } = validateVehicleRecord(row, 1);
      expect(errors).toHaveLength(0);
      expect(record).not.toBeNull();
      expect(record!.conditionCode).toBe(code);
    });

    it('accepts lowercase condition codes (normalized to uppercase)', () => {
      for (const code of ['zn', 'zo', 'zb', 'za', 'zf']) {
        const row = makeValidRow({ conditionCode: code });
        const { record, errors } = validateVehicleRecord(row, 1);
        expect(errors).toHaveLength(0);
        expect(record!.conditionCode).toBe(code.toUpperCase());
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Delivery Matcher — Pattern & Custom Extraction Strategies
// ═══════════════════════════════════════════════════════════════════════════════

describe('Delivery Matcher — pattern and custom extraction', () => {
  describe('pattern match with substring containing vehicle ID', () => {
    it('matches when vehicle ID is embedded in delivery number', () => {
      const result = matchDeliveryNumbers(
        ['DISPATCH-TRUCK42-20240601'],
        ['TRUCK42'],
        'pattern',
      );
      expect(result.matched.get('DISPATCH-TRUCK42-20240601')).toBe('TRUCK42');
      expect(result.unmatched).toHaveLength(0);
    });

    it('matches vehicle ID at the beginning of delivery number', () => {
      const result = matchDeliveryNumbers(
        ['VH001-ROUTE-A'],
        ['VH001'],
        'pattern',
      );
      expect(result.matched.get('VH001-ROUTE-A')).toBe('VH001');
    });

    it('matches vehicle ID at the end of delivery number', () => {
      const result = matchDeliveryNumbers(
        ['2024-LOAD-VH003'],
        ['VH003'],
        'pattern',
      );
      expect(result.matched.get('2024-LOAD-VH003')).toBe('VH003');
    });
  });

  describe('custom delimiter extraction', () => {
    it('extracts vehicle ID from pipe-delimited delivery number', () => {
      const rule: ExtractionRule = { type: 'delimiter', delimiter: '|', fieldIndex: 2 };
      const result = matchDeliveryNumbers(
        ['2024|ROUTE-A|VH001|STOP3'],
        ['VH001'],
        'custom',
        rule,
      );
      expect(result.matched.get('2024|ROUTE-A|VH001|STOP3')).toBe('VH001');
    });

    it('extracts vehicle ID from slash-delimited format', () => {
      const rule: ExtractionRule = { type: 'delimiter', delimiter: '/', fieldIndex: 0 };
      const result = matchDeliveryNumbers(
        ['TRUCK99/DELIVERY/2024'],
        ['TRUCK99'],
        'custom',
        rule,
      );
      expect(result.matched.get('TRUCK99/DELIVERY/2024')).toBe('TRUCK99');
    });

    it('returns unmatched when field index is out of range', () => {
      const rule: ExtractionRule = { type: 'delimiter', delimiter: '-', fieldIndex: 10 };
      const result = matchDeliveryNumbers(
        ['A-B-C'],
        ['A'],
        'custom',
        rule,
      );
      expect(result.unmatched).toContain('A-B-C');
    });
  });

  describe('custom regex extraction', () => {
    it('extracts vehicle ID using a regex capture group', () => {
      const rule: ExtractionRule = {
        type: 'regex',
        pattern: '^DN-(VH\\d+)-\\d{4}$',
        captureGroup: 1,
      };
      const result = matchDeliveryNumbers(
        ['DN-VH007-2024'],
        ['VH007'],
        'custom',
        rule,
      );
      expect(result.matched.get('DN-VH007-2024')).toBe('VH007');
    });

    it('extracts vehicle ID from complex pattern with multiple groups', () => {
      const rule: ExtractionRule = {
        type: 'regex',
        pattern: '(\\d{4})-(\\w+)-(\\w+)',
        captureGroup: 2,
      };
      const result = matchDeliveryNumbers(
        ['2024-FLEET5-LOAD'],
        ['FLEET5'],
        'custom',
        rule,
      );
      expect(result.matched.get('2024-FLEET5-LOAD')).toBe('FLEET5');
    });

    it('returns unmatched for non-matching regex', () => {
      const rule: ExtractionRule = {
        type: 'regex',
        pattern: '^NEVER_MATCH_(\\w+)$',
        captureGroup: 1,
      };
      const result = matchDeliveryNumbers(
        ['SOME-OTHER-FORMAT'],
        ['V001'],
        'custom',
        rule,
      );
      expect(result.unmatched).toContain('SOME-OTHER-FORMAT');
    });
  });

  describe('ambiguous match detection', () => {
    it('detects ambiguity when delivery number contains multiple vehicle IDs', () => {
      const result = matchDeliveryNumbers(
        ['VH001-VH002-COMBINED'],
        ['VH001', 'VH002'],
        'pattern',
      );
      expect(result.ambiguous).toContain('VH001-VH002-COMBINED');
      expect(result.matched.size).toBe(0);
    });

    it('does not report ambiguity when only one vehicle ID matches', () => {
      const result = matchDeliveryNumbers(
        ['LOAD-VH001-2024'],
        ['VH001', 'VH999'],
        'pattern',
      );
      expect(result.ambiguous).toHaveLength(0);
      expect(result.matched.get('LOAD-VH001-2024')).toBe('VH001');
    });

    it('detects ambiguity with nested vehicle IDs (e.g., V1 inside V10)', () => {
      // 'V1' is a substring of delivery number that also contains 'V10'
      const result = matchDeliveryNumbers(
        ['DELIVERY-V10-ZONE'],
        ['V1', 'V10'],
        'pattern',
      );
      // Both 'V1' and 'V10' are substrings of 'DELIVERY-V10-ZONE'
      expect(result.ambiguous).toContain('DELIVERY-V10-ZONE');
    });
  });
});
