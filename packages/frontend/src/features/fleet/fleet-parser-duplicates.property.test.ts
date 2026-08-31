// ─── Property-Based Tests for Fleet Parser Duplicate Detection ──────────────
// Feature: daily-fleet-load-planner
// Property 3: Duplicate vehicle IDs are detected
// Validates: Requirements 1.4

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseFleetFile } from './fleet-parser';
import type { FieldMapping } from '../import/smartMapper';
import type { ConditionCode } from './types';

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_CONDITION_CODES: ConditionCode[] = ['ZN', 'ZO', 'ZB', 'ZA', 'ZF'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates direct field mappings where source column names match target field names.
 * This bypasses fuzzy matching and lets us test the parser logic directly.
 */
function createDirectMappings(): FieldMapping[] {
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

// ─── Custom Generators ───────────────────────────────────────────────────────

/**
 * Generates a valid vehicle row as a Record<string, unknown> with all required fields.
 * Uses the given vehicleId so we can control duplicates.
 */
function arbitraryValidVehicleRow(vehicleId: string): fc.Arbitrary<Record<string, unknown>> {
  return fc.record({
    vehicleType: fc.constantFrom('Camión', 'Trailer c/Plataforma', 'Grúa'),
    licensePlate: fc.string({ minLength: 3, maxLength: 10 }).filter(s => s.trim().length > 0),
    weightCapacity: fc.double({ min: 1, max: 50, noNaN: true }),
    platformLength: fc.double({ min: 2, max: 20, noNaN: true }),
    platformWidth: fc.double({ min: 1, max: 4, noNaN: true }),
    conditionCode: fc.constantFrom(...VALID_CONDITION_CODES),
  }).map(fields => ({
    vehicleId,
    ...fields,
  }));
}

/**
 * Generates a unique vehicle ID string (non-empty, trimmed).
 */
function arbitraryVehicleId(): fc.Arbitrary<string> {
  return fc.stringMatching(/^[A-Z0-9]{3,10}$/).filter(s => s.trim().length >= 3);
}

// ─── Property 3: Duplicate vehicle IDs are detected ──────────────────────────

describe('Feature: daily-fleet-load-planner, Property 3: Duplicate vehicle IDs are detected', () => {
  const mappings = createDirectMappings();

  /**
   * **Validates: Requirements 1.4**
   *
   * For any fleet file containing two or more rows with the same vehicle ID,
   * the fleet parser should report a duplicate entry listing all affected row numbers.
   */
  it('every vehicleId appearing more than once is reported in duplicates', () => {
    fc.assert(
      fc.property(
        // Generate 2-8 unique vehicle IDs
        fc.array(arbitraryVehicleId(), { minLength: 2, maxLength: 8 })
          .chain((uniqueIds) => {
            // Pick at least 1 ID to duplicate
            const numToDuplicate = Math.max(1, Math.floor(uniqueIds.length / 2));
            const idsToDuplicate = uniqueIds.slice(0, numToDuplicate);

            // Build row list: for each unique ID, generate 1 row.
            // For IDs to duplicate, generate 2+ rows.
            const rowArbitraries: fc.Arbitrary<{ rows: Record<string, unknown>[]; duplicatedIds: string[] }> =
              fc.tuple(
                // Rows for unique IDs (not duplicated): 1 row each
                ...uniqueIds.map(id => arbitraryValidVehicleRow(id)),
                // Extra rows for duplicated IDs (1 extra row each)
                ...idsToDuplicate.map(id => arbitraryValidVehicleRow(id)),
              ).map((allRows) => ({
                rows: allRows as Record<string, unknown>[],
                duplicatedIds: idsToDuplicate,
              }));

            return rowArbitraries;
          }),
        ({ rows, duplicatedIds }) => {
          const result = parseFleetFile(rows, mappings);

          // Every duplicated ID must appear in the duplicates array
          for (const dupId of duplicatedIds) {
            const dupEntry = result.duplicates.find(d => d.vehicleId === dupId);
            expect(dupEntry).toBeDefined();
            // Must report at least 2 rows
            expect(dupEntry!.rows.length).toBeGreaterThanOrEqual(2);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.4**
   *
   * The reported row numbers for each duplicate ID must match the actual
   * positions (1-based) where that ID appears in the input rows.
   */
  it('reported row numbers match actual positions of duplicated IDs in input', () => {
    fc.assert(
      fc.property(
        // Generate 2-6 unique vehicle IDs
        fc.array(arbitraryVehicleId(), { minLength: 2, maxLength: 6 })
          .chain((uniqueIds) => {
            // Pick 1-3 IDs to duplicate
            const numToDuplicate = Math.max(1, Math.min(3, Math.floor(uniqueIds.length / 2)));
            const idsToDuplicate = uniqueIds.slice(0, numToDuplicate);

            // Build rows: unique rows + extra duplicates
            const rowArbitraries =
              fc.tuple(
                ...uniqueIds.map(id => arbitraryValidVehicleRow(id)),
                ...idsToDuplicate.map(id => arbitraryValidVehicleRow(id)),
              ).map((allRows) => ({
                rows: allRows as Record<string, unknown>[],
                duplicatedIds: idsToDuplicate,
              }));

            return rowArbitraries;
          }),
        ({ rows, duplicatedIds }) => {
          const result = parseFleetFile(rows, mappings);

          for (const dupId of duplicatedIds) {
            // Find the actual positions (1-based) of this ID in the input
            const actualPositions: number[] = [];
            for (let i = 0; i < rows.length; i++) {
              const rowId = rows[i]['vehicleId'];
              if (typeof rowId === 'string' && rowId.trim() === dupId) {
                actualPositions.push(i + 1); // 1-based row numbering
              }
            }

            // Parser must report this ID as duplicate
            const dupEntry = result.duplicates.find(d => d.vehicleId === dupId);
            expect(dupEntry).toBeDefined();

            // Reported rows must match actual positions
            expect(dupEntry!.rows.sort()).toEqual(actualPositions.sort());
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.4**
   *
   * IDs that appear exactly once should NOT be in the duplicates array.
   */
  it('unique IDs (appearing once) are not reported as duplicates', () => {
    fc.assert(
      fc.property(
        // Generate 3-8 unique vehicle IDs
        fc.array(arbitraryVehicleId(), { minLength: 3, maxLength: 8 })
          .chain((uniqueIds) => {
            // Duplicate first ID, keep rest unique
            const dupId = uniqueIds[0];
            const nonDupIds = uniqueIds.slice(1);

            return fc.tuple(
              ...uniqueIds.map(id => arbitraryValidVehicleRow(id)),
              arbitraryValidVehicleRow(dupId), // one extra row for the duplicated ID
            ).map((allRows) => ({
              rows: allRows as Record<string, unknown>[],
              nonDupIds,
            }));
          }),
        ({ rows, nonDupIds }) => {
          const result = parseFleetFile(rows, mappings);

          // None of the non-duplicated IDs should appear in duplicates
          for (const uniqueId of nonDupIds) {
            const dupEntry = result.duplicates.find(d => d.vehicleId === uniqueId);
            expect(dupEntry).toBeUndefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
