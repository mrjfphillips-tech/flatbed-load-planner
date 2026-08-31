// ─── Fleet Smart Mapper Tests ────────────────────────────────────────────────
// Unit tests for the fleet column auto-mapping logic.
// Validates: Requirements 7.1, 7.2

import { describe, it, expect } from 'vitest';
import {
  autoMapFleetColumns,
  FLEET_REQUIRED_FIELDS,
  FLEET_FIELD_ALIASES,
} from './fleet-smart-mapper';

describe('autoMapFleetColumns', () => {
  it('maps exact English column names', () => {
    const sourceColumns = [
      'vehicle id', 'vehicle type', 'license plate',
      'weight capacity', 'platform length', 'platform width', 'condition code', 'status',
    ];
    const mappings = autoMapFleetColumns(sourceColumns);

    expect(mappings).toHaveLength(FLEET_REQUIRED_FIELDS.length);
    expect(mappings.find(m => m.targetField === 'vehicleId')?.sourceColumn).toBe('vehicle id');
    expect(mappings.find(m => m.targetField === 'vehicleType')?.sourceColumn).toBe('vehicle type');
    expect(mappings.find(m => m.targetField === 'licensePlate')?.sourceColumn).toBe('license plate');
    expect(mappings.find(m => m.targetField === 'weightCapacity')?.sourceColumn).toBe('weight capacity');
    expect(mappings.find(m => m.targetField === 'platformLength')?.sourceColumn).toBe('platform length');
    expect(mappings.find(m => m.targetField === 'platformWidth')?.sourceColumn).toBe('platform width');
    expect(mappings.find(m => m.targetField === 'conditionCode')?.sourceColumn).toBe('condition code');

    // All should have high confidence
    for (const m of mappings) {
      expect(m.confidence).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('maps Spanish column names (placa, tipo, capacidad, largo, ancho, condicion, zona)', () => {
    const sourceColumns = [
      'ID Vehiculo', 'Tipo', 'Placa',
      'Capacidad', 'Largo', 'Ancho', 'Condicion',
    ];
    const mappings = autoMapFleetColumns(sourceColumns);

    expect(mappings.find(m => m.targetField === 'vehicleId')?.sourceColumn).toBe('ID Vehiculo');
    expect(mappings.find(m => m.targetField === 'vehicleType')?.sourceColumn).toBe('Tipo');
    expect(mappings.find(m => m.targetField === 'licensePlate')?.sourceColumn).toBe('Placa');
    expect(mappings.find(m => m.targetField === 'weightCapacity')?.sourceColumn).toBe('Capacidad');
    expect(mappings.find(m => m.targetField === 'platformLength')?.sourceColumn).toBe('Largo');
    expect(mappings.find(m => m.targetField === 'platformWidth')?.sourceColumn).toBe('Ancho');
    expect(mappings.find(m => m.targetField === 'conditionCode')?.sourceColumn).toBe('Condicion');
  });

  it('maps "zona" to conditionCode', () => {
    const sourceColumns = [
      'vehicle_id', 'tipo', 'placa',
      'capacidad', 'largo', 'ancho', 'zona',
    ];
    const mappings = autoMapFleetColumns(sourceColumns);

    expect(mappings.find(m => m.targetField === 'conditionCode')?.sourceColumn).toBe('zona');
  });

  it('maps snake_case column names', () => {
    const sourceColumns = [
      'vehicle_id', 'vehicle_type', 'license_plate',
      'weight_capacity', 'platform_length', 'platform_width', 'condition_code', 'status',
    ];
    const mappings = autoMapFleetColumns(sourceColumns);

    for (const m of mappings) {
      expect(m.sourceColumn).not.toBeNull();
      expect(m.confidence).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('maps camelCase-like column names via normalization', () => {
    const sourceColumns = [
      'vehicleId', 'vehicleType', 'licensePlate',
      'weightCapacity', 'platformLength', 'platformWidth', 'conditionCode',
    ];
    const mappings = autoMapFleetColumns(sourceColumns);

    // camelCase normalizes to single token, matching the alias "vehicleid" etc.
    expect(mappings.find(m => m.targetField === 'vehicleId')?.sourceColumn).toBe('vehicleId');
    expect(mappings.find(m => m.targetField === 'conditionCode')?.sourceColumn).toBe('conditionCode');
  });

  it('returns null sourceColumn for unrecognized headers', () => {
    const sourceColumns = ['foo', 'bar', 'baz', 'qux', 'quux', 'corge', 'grault'];
    const mappings = autoMapFleetColumns(sourceColumns);

    for (const m of mappings) {
      expect(m.sourceColumn).toBeNull();
      expect(m.confidence).toBe(0);
    }
  });

  it('marks all fields as required', () => {
    const mappings = autoMapFleetColumns([]);
    for (const m of mappings) {
      if (m.targetField === 'status') {
        expect(m.required).toBe(false);
      } else {
        expect(m.required).toBe(true);
      }
    }
  });

  it('does not reuse a source column for multiple target fields', () => {
    // "type" could match vehicleType or other fields — ensure only one mapping claims it
    const sourceColumns = [
      'truck id', 'type', 'plate',
      'capacity', 'length', 'width', 'condition',
    ];
    const mappings = autoMapFleetColumns(sourceColumns);

    const usedColumns = mappings
      .filter(m => m.sourceColumn !== null)
      .map(m => m.sourceColumn);
    const uniqueColumns = new Set(usedColumns);
    expect(uniqueColumns.size).toBe(usedColumns.length);
  });

  it('handles mixed-case headers gracefully', () => {
    const sourceColumns = [
      'VEHICLE ID', 'Vehicle Type', 'LICENSE PLATE',
      'Weight Capacity', 'PLATFORM LENGTH', 'Platform Width', 'Condition Code', 'status',
    ];
    const mappings = autoMapFleetColumns(sourceColumns);

    for (const m of mappings) {
      expect(m.sourceColumn).not.toBeNull();
    }
  });

  it('produces correct labels for all fields', () => {
    const mappings = autoMapFleetColumns([]);

    expect(mappings.find(m => m.targetField === 'vehicleId')?.label).toBe('Vehicle ID');
    expect(mappings.find(m => m.targetField === 'vehicleType')?.label).toBe('Vehicle Type');
    expect(mappings.find(m => m.targetField === 'licensePlate')?.label).toBe('License Plate');
    expect(mappings.find(m => m.targetField === 'weightCapacity')?.label).toBe('Weight Capacity');
    expect(mappings.find(m => m.targetField === 'platformLength')?.label).toBe('Platform Length');
    expect(mappings.find(m => m.targetField === 'platformWidth')?.label).toBe('Platform Width');
    expect(mappings.find(m => m.targetField === 'conditionCode')?.label).toBe('Condition Code');
  });
});

  // ─── Mixed Naming Conventions ──────────────────────────────────────────────

  describe('mixed naming conventions', () => {
    it('maps a mix of Spanish and English headers', () => {
      const sourceColumns = [
        'vehicle_id', 'Tipo', 'license plate',
        'Capacidad', 'platform_length', 'Ancho', 'condition_code',
      ];
      const mappings = autoMapFleetColumns(sourceColumns);

      expect(mappings.find(m => m.targetField === 'vehicleId')?.sourceColumn).toBe('vehicle_id');
      expect(mappings.find(m => m.targetField === 'vehicleType')?.sourceColumn).toBe('Tipo');
      expect(mappings.find(m => m.targetField === 'licensePlate')?.sourceColumn).toBe('license plate');
      expect(mappings.find(m => m.targetField === 'weightCapacity')?.sourceColumn).toBe('Capacidad');
      expect(mappings.find(m => m.targetField === 'platformLength')?.sourceColumn).toBe('platform_length');
      expect(mappings.find(m => m.targetField === 'platformWidth')?.sourceColumn).toBe('Ancho');
      expect(mappings.find(m => m.targetField === 'conditionCode')?.sourceColumn).toBe('condition_code');
    });

    it('maps a mix of camelCase and snake_case headers', () => {
      const sourceColumns = [
        'vehicleId', 'vehicle_type', 'licensePlate',
        'weight_capacity', 'platformLength', 'platform_width', 'conditionCode',
      ];
      const mappings = autoMapFleetColumns(sourceColumns);

      expect(mappings.find(m => m.targetField === 'vehicleId')?.sourceColumn).toBe('vehicleId');
      expect(mappings.find(m => m.targetField === 'vehicleType')?.sourceColumn).toBe('vehicle_type');
      expect(mappings.find(m => m.targetField === 'licensePlate')?.sourceColumn).toBe('licensePlate');
      expect(mappings.find(m => m.targetField === 'weightCapacity')?.sourceColumn).toBe('weight_capacity');
      expect(mappings.find(m => m.targetField === 'platformLength')?.sourceColumn).toBe('platformLength');
      expect(mappings.find(m => m.targetField === 'platformWidth')?.sourceColumn).toBe('platform_width');
      expect(mappings.find(m => m.targetField === 'conditionCode')?.sourceColumn).toBe('conditionCode');
    });

    it('maps alternate Spanish aliases (peso maximo, longitud, matricula, clasificacion)', () => {
      const sourceColumns = [
        'codigo vehiculo', 'clase', 'matricula',
        'peso maximo', 'longitud', 'anchura', 'clasificacion',
      ];
      const mappings = autoMapFleetColumns(sourceColumns);

      expect(mappings.find(m => m.targetField === 'vehicleId')?.sourceColumn).toBe('codigo vehiculo');
      expect(mappings.find(m => m.targetField === 'vehicleType')?.sourceColumn).toBe('clase');
      expect(mappings.find(m => m.targetField === 'licensePlate')?.sourceColumn).toBe('matricula');
      expect(mappings.find(m => m.targetField === 'weightCapacity')?.sourceColumn).toBe('peso maximo');
      expect(mappings.find(m => m.targetField === 'platformLength')?.sourceColumn).toBe('longitud');
      expect(mappings.find(m => m.targetField === 'platformWidth')?.sourceColumn).toBe('anchura');
      expect(mappings.find(m => m.targetField === 'conditionCode')?.sourceColumn).toBe('clasificacion');
    });

    it('maps headers with parenthetical units stripped (e.g., "Capacidad (t)")', () => {
      const sourceColumns = [
        'vehicle id', 'vehicle type', 'license plate',
        'capacity (t)', 'length (m)', 'width (m)', 'condition',
      ];
      const mappings = autoMapFleetColumns(sourceColumns);

      // Parentheses are stripped during normalization
      expect(mappings.find(m => m.targetField === 'weightCapacity')?.sourceColumn).toBe('capacity (t)');
      expect(mappings.find(m => m.targetField === 'platformLength')?.sourceColumn).toBe('length (m)');
      expect(mappings.find(m => m.targetField === 'platformWidth')?.sourceColumn).toBe('width (m)');
    });

    it('maps hyphenated headers (e.g., "vehicle-id")', () => {
      const sourceColumns = [
        'vehicle-id', 'vehicle-type', 'license-plate',
        'weight-capacity', 'platform-length', 'platform-width', 'condition-code', 'status',
      ];
      const mappings = autoMapFleetColumns(sourceColumns);

      // Hyphens normalize to spaces, matching aliases like 'vehicle id'
      for (const m of mappings) {
        expect(m.sourceColumn).not.toBeNull();
        expect(m.confidence).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

describe('FLEET_FIELD_ALIASES', () => {
  it('contains aliases for all required fields', () => {
    const targetFields = new Set(Object.values(FLEET_FIELD_ALIASES));
    for (const field of FLEET_REQUIRED_FIELDS) {
      expect(targetFields.has(field)).toBe(true);
    }
  });

  it('includes Spanish aliases: placa, tipo, capacidad, largo, ancho, condicion, zona', () => {
    expect(FLEET_FIELD_ALIASES['placa']).toBe('licensePlate');
    expect(FLEET_FIELD_ALIASES['tipo']).toBe('vehicleType');
    expect(FLEET_FIELD_ALIASES['capacidad']).toBe('weightCapacity');
    expect(FLEET_FIELD_ALIASES['largo']).toBe('platformLength');
    expect(FLEET_FIELD_ALIASES['ancho']).toBe('platformWidth');
    expect(FLEET_FIELD_ALIASES['condicion']).toBe('conditionCode');
    expect(FLEET_FIELD_ALIASES['zona']).toBe('conditionCode');
  });
});
