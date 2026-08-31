// ─── Fleet File Parser Unit Tests ────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { parseFleetFile, validateVehicleRecord } from './fleet-parser';
import type { FieldMapping } from '../import/smartMapper';

// ─── Test Helpers ────────────────────────────────────────────────────────────

/** Build standard field mappings where source columns match target field names */
function makeDirectMappings(): FieldMapping[] {
  return [
    { targetField: 'vehicleId', label: 'Vehicle ID', required: true, sourceColumn: 'vehicleId', confidence: 1 },
    { targetField: 'vehicleType', label: 'Vehicle Type', required: true, sourceColumn: 'vehicleType', confidence: 1 },
    { targetField: 'licensePlate', label: 'License Plate', required: true, sourceColumn: 'licensePlate', confidence: 1 },
    { targetField: 'weightCapacity', label: 'Weight Capacity', required: true, sourceColumn: 'weightCapacity', confidence: 1 },
    { targetField: 'platformLength', label: 'Platform Length', required: true, sourceColumn: 'platformLength', confidence: 1 },
    { targetField: 'platformWidth', label: 'Platform Width', required: true, sourceColumn: 'platformWidth', confidence: 1 },
    { targetField: 'conditionCode', label: 'Condition Code', required: true, sourceColumn: 'conditionCode', confidence: 1 },
  ];
}

/** Build a valid raw row */
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

// ─── validateVehicleRecord Tests ─────────────────────────────────────────────

describe('validateVehicleRecord', () => {
  it('returns a valid VehicleRecord for a complete, correct row', () => {
    const row = makeValidRow();
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(errors).toHaveLength(0);
    expect(record).not.toBeNull();
    expect(record!.vehicleId).toBe('VH-001');
    expect(record!.vehicleType).toBe('Camión');
    expect(record!.licensePlate).toBe('ABC-123');
    expect(record!.weightCapacity).toBe(30);
    expect(record!.platformLength).toBe(13.5);
    expect(record!.platformWidth).toBe(2.6);
    expect(record!.conditionCode).toBe('ZN');
  });

  it('reports error for missing vehicleId', () => {
    const row = makeValidRow({ vehicleId: '' });
    const { record, errors } = validateVehicleRecord(row, 3);

    expect(record).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0].row).toBe(3);
    expect(errors[0].field).toBe('vehicleId');
  });

  it('reports error for undefined vehicleId', () => {
    const row = makeValidRow();
    delete row['vehicleId'];
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(record).toBeNull();
    expect(errors.some(e => e.field === 'vehicleId')).toBe(true);
  });

  it('reports error for missing vehicleType', () => {
    const row = makeValidRow({ vehicleType: '   ' });
    const { record, errors } = validateVehicleRecord(row, 2);

    expect(record).toBeNull();
    expect(errors.some(e => e.field === 'vehicleType')).toBe(true);
  });

  it('reports error for missing licensePlate', () => {
    const row = makeValidRow({ licensePlate: '' });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(record).toBeNull();
    expect(errors.some(e => e.field === 'licensePlate')).toBe(true);
  });

  it('reports error for zero weight capacity', () => {
    const row = makeValidRow({ weightCapacity: 0 });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(record).toBeNull();
    expect(errors.some(e => e.field === 'weightCapacity')).toBe(true);
  });

  it('reports error for negative weight capacity', () => {
    const row = makeValidRow({ weightCapacity: -5 });
    const { record, errors } = validateVehicleRecord(row, 4);

    expect(record).toBeNull();
    expect(errors[0].field).toBe('weightCapacity');
    expect(errors[0].row).toBe(4);
  });

  it('reports error for non-numeric weight capacity', () => {
    const row = makeValidRow({ weightCapacity: 'abc' });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(record).toBeNull();
    expect(errors.some(e => e.field === 'weightCapacity')).toBe(true);
  });

  it('reports error for zero platform length', () => {
    const row = makeValidRow({ platformLength: 0 });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(record).toBeNull();
    expect(errors.some(e => e.field === 'platformLength')).toBe(true);
  });

  it('reports error for negative platform width', () => {
    const row = makeValidRow({ platformWidth: -2 });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(record).toBeNull();
    expect(errors.some(e => e.field === 'platformWidth')).toBe(true);
  });

  it('reports error for invalid condition code', () => {
    const row = makeValidRow({ conditionCode: 'XX' });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(record).toBeNull();
    expect(errors.some(e => e.field === 'conditionCode')).toBe(true);
  });

  it('reports error for empty condition code', () => {
    const row = makeValidRow({ conditionCode: '' });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(record).toBeNull();
    expect(errors.some(e => e.field === 'conditionCode')).toBe(true);
  });

  it('accepts all valid condition codes', () => {
    for (const code of ['ZN', 'ZO', 'ZB', 'ZA', 'ZF']) {
      const row = makeValidRow({ conditionCode: code });
      const { record, errors } = validateVehicleRecord(row, 1);
      expect(errors).toHaveLength(0);
      expect(record!.conditionCode).toBe(code);
    }
  });

  it('normalizes condition code to uppercase', () => {
    const row = makeValidRow({ conditionCode: 'zn' });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(errors).toHaveLength(0);
    expect(record!.conditionCode).toBe('ZN');
  });

  it('trims whitespace from string fields', () => {
    const row = makeValidRow({
      vehicleId: '  VH-001  ',
      vehicleType: ' Camión ',
      licensePlate: ' ABC-123 ',
    });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(errors).toHaveLength(0);
    expect(record!.vehicleId).toBe('VH-001');
    expect(record!.vehicleType).toBe('Camión');
    expect(record!.licensePlate).toBe('ABC-123');
  });

  it('parses numeric strings for weight/dimension fields', () => {
    const row = makeValidRow({
      weightCapacity: '30',
      platformLength: '13.5',
      platformWidth: '2.6',
    });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(errors).toHaveLength(0);
    expect(record!.weightCapacity).toBe(30);
    expect(record!.platformLength).toBe(13.5);
    expect(record!.platformWidth).toBe(2.6);
  });

  it('parses comma-formatted numbers', () => {
    const row = makeValidRow({ weightCapacity: '1,500' });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(errors).toHaveLength(0);
    expect(record!.weightCapacity).toBe(1500);
  });

  it('reports multiple errors for row with multiple invalid fields', () => {
    const row = makeValidRow({
      vehicleId: '',
      weightCapacity: -1,
      conditionCode: 'INVALID',
    });
    const { record, errors } = validateVehicleRecord(row, 5);

    expect(record).toBeNull();
    expect(errors.length).toBeGreaterThanOrEqual(3);
    expect(errors.every(e => e.row === 5)).toBe(true);
    const fields = errors.map(e => e.field);
    expect(fields).toContain('vehicleId');
    expect(fields).toContain('weightCapacity');
    expect(fields).toContain('conditionCode');
  });

  // ─── Validation Edge Cases: Zero-Capacity, Negative Dimensions, Empty Strings ─

  it('reports error for zero-capacity vehicle (all dimensions)', () => {
    const row = makeValidRow({ weightCapacity: 0, platformLength: 0, platformWidth: 0 });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(record).toBeNull();
    expect(errors.some(e => e.field === 'weightCapacity')).toBe(true);
    expect(errors.some(e => e.field === 'platformLength')).toBe(true);
    expect(errors.some(e => e.field === 'platformWidth')).toBe(true);
  });

  it('reports error for negative platformLength', () => {
    const row = makeValidRow({ platformLength: -10 });
    const { record, errors } = validateVehicleRecord(row, 2);

    expect(record).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('platformLength');
    expect(errors[0].row).toBe(2);
  });

  it('reports error for negative platformWidth', () => {
    const row = makeValidRow({ platformWidth: -3.5 });
    const { record, errors } = validateVehicleRecord(row, 6);

    expect(record).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('platformWidth');
    expect(errors[0].row).toBe(6);
  });

  it('reports error when all string fields are empty', () => {
    const row = makeValidRow({
      vehicleId: '',
      vehicleType: '',
      licensePlate: '',
      conditionCode: '' as any,
    });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(record).toBeNull();
    expect(errors.some(e => e.field === 'vehicleId')).toBe(true);
    expect(errors.some(e => e.field === 'vehicleType')).toBe(true);
    expect(errors.some(e => e.field === 'licensePlate')).toBe(true);
    expect(errors.some(e => e.field === 'conditionCode')).toBe(true);
  });

  it('reports error when string fields are only whitespace', () => {
    const row = makeValidRow({
      vehicleId: '   ',
      vehicleType: '\t',
      licensePlate: ' \n ',
    });
    const { record, errors } = validateVehicleRecord(row, 7);

    expect(record).toBeNull();
    expect(errors.some(e => e.field === 'vehicleId')).toBe(true);
    expect(errors.some(e => e.field === 'vehicleType')).toBe(true);
    expect(errors.some(e => e.field === 'licensePlate')).toBe(true);
  });

  it('reports error for NaN weight capacity', () => {
    const row = makeValidRow({ weightCapacity: NaN });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(record).toBeNull();
    expect(errors.some(e => e.field === 'weightCapacity')).toBe(true);
  });

  it('reports error for Infinity dimensions', () => {
    const row = makeValidRow({ platformLength: Infinity });
    const { record, errors } = validateVehicleRecord(row, 1);

    expect(record).toBeNull();
    expect(errors.some(e => e.field === 'platformLength')).toBe(true);
  });
});

// ─── parseFleetFile Tests ────────────────────────────────────────────────────

describe('parseFleetFile', () => {
  it('parses multiple valid rows correctly', () => {
    const rows = [
      makeValidRow({ vehicleId: 'VH-001' }),
      makeValidRow({ vehicleId: 'VH-002', licensePlate: 'DEF-456' }),
      makeValidRow({ vehicleId: 'VH-003', licensePlate: 'GHI-789', conditionCode: 'ZA' }),
    ];
    const mappings = makeDirectMappings();

    const result = parseFleetFile(rows, mappings);

    expect(result.records).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
    expect(result.records[0].vehicleId).toBe('VH-001');
    expect(result.records[2].conditionCode).toBe('ZA');
  });

  it('separates valid records from invalid rows', () => {
    const rows = [
      makeValidRow({ vehicleId: 'VH-001' }),
      makeValidRow({ vehicleId: '', weightCapacity: -5 }), // invalid
      makeValidRow({ vehicleId: 'VH-003' }),
    ];
    const mappings = makeDirectMappings();

    const result = parseFleetFile(rows, mappings);

    expect(result.records).toHaveLength(2);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every(e => e.row === 2)).toBe(true);
  });

  it('detects duplicate vehicle IDs', () => {
    const rows = [
      makeValidRow({ vehicleId: 'VH-001' }),
      makeValidRow({ vehicleId: 'VH-002', licensePlate: 'DEF-456' }),
      makeValidRow({ vehicleId: 'VH-001', licensePlate: 'GHI-789' }),
    ];
    const mappings = makeDirectMappings();

    const result = parseFleetFile(rows, mappings);

    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].vehicleId).toBe('VH-001');
    expect(result.duplicates[0].rows).toEqual([1, 3]);
  });

  it('detects multiple groups of duplicates', () => {
    const rows = [
      makeValidRow({ vehicleId: 'VH-001' }),
      makeValidRow({ vehicleId: 'VH-002', licensePlate: 'DEF' }),
      makeValidRow({ vehicleId: 'VH-001', licensePlate: 'GHI' }),
      makeValidRow({ vehicleId: 'VH-002', licensePlate: 'JKL' }),
    ];
    const mappings = makeDirectMappings();

    const result = parseFleetFile(rows, mappings);

    expect(result.duplicates).toHaveLength(2);
    const dupIds = result.duplicates.map(d => d.vehicleId).sort();
    expect(dupIds).toEqual(['VH-001', 'VH-002']);
  });

  it('maps source columns to target fields using the mappings', () => {
    const rows = [
      {
        'ID Vehículo': 'VH-001',
        'Tipo': 'Camión',
        'Placa': 'ABC-123',
        'Capacidad (t)': 30,
        'Largo (m)': 13.5,
        'Ancho (m)': 2.6,
        'Zona': 'ZN',
      },
    ];
    const mappings: FieldMapping[] = [
      { targetField: 'vehicleId', label: 'Vehicle ID', required: true, sourceColumn: 'ID Vehículo', confidence: 0.9 },
      { targetField: 'vehicleType', label: 'Vehicle Type', required: true, sourceColumn: 'Tipo', confidence: 0.9 },
      { targetField: 'licensePlate', label: 'License Plate', required: true, sourceColumn: 'Placa', confidence: 0.9 },
      { targetField: 'weightCapacity', label: 'Weight Capacity', required: true, sourceColumn: 'Capacidad (t)', confidence: 0.8 },
      { targetField: 'platformLength', label: 'Platform Length', required: true, sourceColumn: 'Largo (m)', confidence: 0.8 },
      { targetField: 'platformWidth', label: 'Platform Width', required: true, sourceColumn: 'Ancho (m)', confidence: 0.8 },
      { targetField: 'conditionCode', label: 'Condition Code', required: true, sourceColumn: 'Zona', confidence: 0.85 },
    ];

    const result = parseFleetFile(rows, mappings);

    expect(result.records).toHaveLength(1);
    expect(result.records[0].vehicleId).toBe('VH-001');
    expect(result.records[0].vehicleType).toBe('Camión');
    expect(result.records[0].licensePlate).toBe('ABC-123');
    expect(result.records[0].weightCapacity).toBe(30);
  });

  it('handles empty rows array', () => {
    const result = parseFleetFile([], makeDirectMappings());

    expect(result.records).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(result.duplicates).toHaveLength(0);
  });

  it('handles unmapped fields by treating them as missing', () => {
    const rows = [makeValidRow()];
    // Only map vehicleId — all other fields are unmapped
    const partialMappings: FieldMapping[] = [
      { targetField: 'vehicleId', label: 'Vehicle ID', required: true, sourceColumn: 'vehicleId', confidence: 1 },
      { targetField: 'vehicleType', label: 'Vehicle Type', required: true, sourceColumn: null, confidence: 0 },
      { targetField: 'licensePlate', label: 'License Plate', required: true, sourceColumn: null, confidence: 0 },
      { targetField: 'weightCapacity', label: 'Weight Capacity', required: true, sourceColumn: null, confidence: 0 },
      { targetField: 'platformLength', label: 'Platform Length', required: true, sourceColumn: null, confidence: 0 },
      { targetField: 'platformWidth', label: 'Platform Width', required: true, sourceColumn: null, confidence: 0 },
      { targetField: 'conditionCode', label: 'Condition Code', required: true, sourceColumn: null, confidence: 0 },
    ];

    const result = parseFleetFile(rows, partialMappings);

    expect(result.records).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('reports 1-based row numbers in errors', () => {
    const rows = [
      makeValidRow({ vehicleId: 'VH-001' }), // row 1 valid
      makeValidRow({ vehicleId: 'VH-002' }), // row 2 valid
      makeValidRow({ vehicleId: '', weightCapacity: 'bad' }), // row 3 invalid
    ];
    const mappings = makeDirectMappings();

    const result = parseFleetFile(rows, mappings);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every(e => e.row === 3)).toBe(true);
  });
});
