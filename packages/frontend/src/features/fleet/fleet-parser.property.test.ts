// ─── Property-Based Tests for Fleet File Parser ──────────────────────────────
// Feature: daily-fleet-load-planner
// Property 1: Fleet file parsing round trip
// Validates: Requirements 1.1

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseFleetFile } from './fleet-parser';
import { FLEET_REQUIRED_FIELDS } from './fleet-smart-mapper';
import type { VehicleRecord, ConditionCode } from './types';
import type { FieldMapping } from '../import/smartMapper';

// ─── Custom Generators ───────────────────────────────────────────────────────

/** Valid condition codes for Peru fleet */
const VALID_CONDITION_CODES: ConditionCode[] = ['ZN', 'ZO', 'ZB', 'ZA', 'ZF'];

/**
 * Generates an arbitrary valid VehicleRecord.
 * String fields are non-empty and trimmed (parser trims on read).
 * Numeric fields are positive finite numbers.
 */
function arbitraryVehicleRecord(): fc.Arbitrary<VehicleRecord> {
  // Non-empty alphanumeric strings that are already trimmed
  const nonEmptyString = fc
    .stringMatching(/^[A-Za-z0-9][A-Za-z0-9 _-]{0,18}[A-Za-z0-9]$/)
    .filter((s) => s.trim().length > 0 && s.trim() === s);

  // Positive number with limited precision to avoid floating-point round-trip issues
  const positiveFloat = fc
    .integer({ min: 1, max: 9999900 })
    .map((n) => n / 100); // produces values from 0.01 to 99999.00

  return fc.record({
    vehicleId: nonEmptyString,
    vehicleType: nonEmptyString,
    licensePlate: nonEmptyString,
    weightCapacity: positiveFloat,
    platformLength: positiveFloat,
    platformWidth: positiveFloat,
    conditionCode: fc.constantFrom(...VALID_CONDITION_CODES),
    status: fc.constant('active' as const),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Serialize VehicleRecord objects to raw rows using target field names as keys.
 * This simulates what a parsed spreadsheet would look like after reading.
 */
function serializeToRows(records: VehicleRecord[]): Record<string, unknown>[] {
  return records.map((rec) => ({
    vehicleId: rec.vehicleId,
    vehicleType: rec.vehicleType,
    licensePlate: rec.licensePlate,
    weightCapacity: rec.weightCapacity,
    platformLength: rec.platformLength,
    platformWidth: rec.platformWidth,
    conditionCode: rec.conditionCode,
  }));
}

/**
 * Create direct field mappings where sourceColumn === targetField.
 * This represents a 1:1 mapping with perfect confidence.
 */
function createDirectMappings(): FieldMapping[] {
  return FLEET_REQUIRED_FIELDS.map((field) => ({
    targetField: field,
    label: field,
    required: true,
    sourceColumn: field,
    confidence: 1.0,
  }));
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Fleet File Parser — Property Tests', () => {
  // Feature: daily-fleet-load-planner, Property 1: Fleet file parsing round trip
  // **Validates: Requirements 1.1**
  it('Property 1: parsing valid VehicleRecords serialized to rows produces equivalent output', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryVehicleRecord(), { minLength: 1, maxLength: 20 }),
        (inputRecords) => {
          // Ensure unique vehicle IDs to avoid duplicate detection interference
          const uniqueRecords = deduplicateByVehicleId(inputRecords);
          if (uniqueRecords.length === 0) return; // skip empty after dedup

          // Serialize to raw rows (source columns = target field names)
          const rows = serializeToRows(uniqueRecords);

          // Create direct mappings (sourceColumn === targetField)
          const mappings = createDirectMappings();

          // Parse through parseFleetFile
          const result = parseFleetFile(rows, mappings);

          // Assert no errors and no duplicates
          expect(result.errors).toHaveLength(0);
          expect(result.duplicates).toHaveLength(0);

          // Assert output records count matches input
          expect(result.records).toHaveLength(uniqueRecords.length);

          // Assert each output record matches the corresponding input
          for (let i = 0; i < uniqueRecords.length; i++) {
            const input = uniqueRecords[i];
            const output = result.records[i];

            expect(output.vehicleId).toBe(input.vehicleId.trim());
            expect(output.vehicleType).toBe(input.vehicleType.trim());
            expect(output.licensePlate).toBe(input.licensePlate.trim());
            expect(output.weightCapacity).toBe(input.weightCapacity);
            expect(output.platformLength).toBe(input.platformLength);
            expect(output.platformWidth).toBe(input.platformWidth);
            expect(output.conditionCode).toBe(input.conditionCode);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Remove records with duplicate vehicleIds, keeping the first occurrence.
 * This ensures the property test focuses on parsing correctness without
 * triggering the duplicate detection logic.
 */
function deduplicateByVehicleId(records: VehicleRecord[]): VehicleRecord[] {
  const seen = new Set<string>();
  return records.filter((rec) => {
    const id = rec.vehicleId.trim();
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
